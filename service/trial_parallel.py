"""Twenty independent demo sessions with disjoint, immutable sequence quotas.

Only the operator can activate this mode. Public RPC cannot change quotas or
reopen a stopped source. The legacy prefix remains immutable and auditable.
"""
import json
import re
import sqlite3
import time
from pathlib import Path
from store import require, Rejected, file_lock, canonical, sync_dir
from trial_store import TrialStore, TRIAL, SCHEMA, PLAN


def allocation(prefix):
    require(type(prefix) is int and 0 <= prefix <= PLAN['target']-20, 'BAD_PREFIX')
    size, extra = divmod(PLAN['target']-prefix,20)
    start=prefix+1
    shards=[]
    for i in range(20):
        end=start+size+(i<extra)-1
        shards.append({'id':i,'start':start,'end':end})
        start=end+1
    return shards


class ParallelTrial:
    def __init__(self,root,mongo_factory,clock=time.time):
        self.base=Path(root).resolve()
        self.root=self.base/'trials'/TRIAL
        self.plan=json.loads((self.root/'parallel.json').read_text())
        require(self.plan['shards']==allocation(self.plan['prefix']), 'PARALLEL_PLAN_CHANGED')
        self.clock=clock
        self.mongo_factory=mongo_factory
        self.store=None
        self.db=sqlite3.connect(self.root/'parallel.sqlite3',isolation_level=None,timeout=30)
        self.db.row_factory=sqlite3.Row
        self.db.execute('PRAGMA synchronous=FULL')

    def close(self):
        if self.store:self.store.close()
        self.db.close()

    def allowed(self):
        s=self.db.execute('SELECT * FROM control WHERE id=1').fetchone()
        return bool(s['enabled']) and s['failure'] is None and s['cooldown_until']<=self.clock()

    def halt(self,reason,cooldown=0):
        self.db.execute('UPDATE control SET enabled=0,failure=COALESCE(failure,?),cooldown_until=MAX(cooldown_until,?) WHERE id=1',
                        (reason,cooldown))

    def shard_store(self,shard):
        if self.store:
            require(self.store.shard['id']==shard, 'CONNECTION_SHARD_CHANGED')
        else:
            spec=self.plan['shards'][shard]
            self.store=TrialStore(self.base,self.mongo_factory((spec['start'],spec['end'])),self.clock,
                                  shard=spec,source_allowed=self.allowed)
        return self.store

    def bind(self,shard,fingerprint):
        require(isinstance(fingerprint,str) and re.fullmatch('[a-f0-9]{64}',fingerprint), 'BAD_SESSION_HASH')
        require(fingerprint!=self.plan['legacySessionHash'], 'LEGACY_SESSION_FORBIDDEN')
        self.db.execute('BEGIN IMMEDIATE')
        try:
            row=self.db.execute('SELECT session_hash FROM sessions WHERE shard=?',(shard,)).fetchone()
            require(not row or row[0]==fingerprint, 'TRIAL_SESSION_CHANGED')
            require(not self.db.execute('SELECT 1 FROM sessions WHERE session_hash=? AND shard<>?',(fingerprint,shard)).fetchone(), 'SHARED_SESSION_FORBIDDEN')
            self.db.execute('INSERT OR IGNORE INTO sessions(shard,session_hash) VALUES(?,?)',(shard,fingerprint))
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK');raise

    def dispatch(self,req):
        require(isinstance(req,dict) and req.get('schema')==SCHEMA and req.get('trialId')==TRIAL, 'TRIAL_NOT_ALLOWED')
        require(len(canonical(req))<=1048576, 'REQUEST_TOO_LARGE')
        shard=req.get('shardId')
        if shard is None:
            require(req.get('op') in {'status','audit','ping'}, 'PARALLEL_SHARD_REQUIRED')
            if req['op']=='ping':return {'ok':True,'pong':True}
            return self.audit(req) if req['op']=='audit' else self.status()
        require(type(shard) is int and 0<=shard<20, 'BAD_SHARD')
        require(req.get('op') not in {'exchange','runner_register','runner_select'}, 'PARALLEL_OP_FORBIDDEN')
        store=self.shard_store(shard)
        if req.get('op')=='claim':
            require(self.allowed(), 'GLOBAL_SOURCE_STOPPED')
            self.bind(shard,req.get('sessionHash'))
        try:
            result=store.dispatch(req)
        except Rejected:
            if store.state()['status']=='halted':self.halt('SHARD_HALTED')
            raise
        if req.get('op')=='fail' and (req.get('category','').startswith('source_') or result['status']=='halted'):
            self.halt(req.get('category','SHARD_HALTED'),req.get('cooldownUntil',0))
        if req.get('op')=='status':result['globalSourceEnabled']=self.allowed()
        return result

    def status(self):
        shards=[]
        for spec in self.plan['shards']:
            db=sqlite3.connect(self.root/'shards'/str(spec['id'])/'state.sqlite3')
            db.row_factory=sqlite3.Row
            try:
                s=dict(db.execute('SELECT * FROM trial WHERE id=1').fetchone())
                journaled=db.execute('SELECT COALESCE(MAX(sequence),?) FROM receipts',(spec['start']-1,)).fetchone()[0]
                p=db.execute('SELECT sequence,awaiting IS NOT NULL AS awaitingResponse FROM pending').fetchone()
                shards.append({'shardId':spec['id'],'start':spec['start'],'end':spec['end'],'status':s['status'],
                  'journaled':journaled-spec['start']+1,'durable':s['durable']-spec['start']+1,
                  'checkpoint':s['checkpoint']-spec['start']+1,'leaseUntil':s['lease_until'],
                  'failure':s['failure'],'pending':dict(p) if p else None})
            finally:db.close()
        totals={k:self.plan['prefix']+sum(s[k] for s in shards) for k in ('journaled','durable','checkpoint')}
        control=self.db.execute('SELECT * FROM control WHERE id=1').fetchone()
        status='complete' if totals['checkpoint']==PLAN['target'] else 'halted' if control['failure'] else 'claimed' if any(s['status']=='claimed' for s in shards) else 'pending'
        return {'ok':True,'schema':SCHEMA,'trialId':TRIAL,'fixtureOnly':False,'mode':'parallel-20',
          'target':PLAN['target'],'status':status,'legacyPrefix':self.plan['prefix'],**totals,'shards':shards,
          'globalSourceEnabled':self.allowed(),'failure':control['failure'],'cooldownUntil':control['cooldown_until'],
          'distinctBoundSessions':self.db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0],
          'countSemantics':'sum of confirmed rounds, not maximum sequence'}

    def audit(self,req):
        before=self.status()
        require(all(s['status']!='claimed' and s['pending'] is None for s in before['shards']), 'TRIAL_NOT_QUIESCENT')
        reports=[]
        ranges=[(None,(1,self.plan['prefix']))]+[(s,(s['start'],s['end'])) for s in self.plan['shards']]
        for spec,scope in ranges:
            store=TrialStore(self.base,self.mongo_factory(scope),self.clock,shard=spec,source_allowed=self.allowed)
            try:reports.append(store.dispatch({**req,'op':'audit'}))
            finally:store.close()
        result=self.status()
        require(result['checkpoint']==before['checkpoint'] and all(s['status']!='claimed' for s in result['shards']), 'AUDIT_CONCURRENT_CAPTURE')
        result['verifiedFileRounds']=sum(r['verifiedFileRounds'] for r in reports)
        result['statistics']={k:sum(r['statistics'][k] for r in reports) for k in ('count','stakeRaw','winRaw','sourceFrames','freeRounds','zeroWinRounds')}
        result['statistics']['maxMul']=max(r['statistics']['maxMul'] for r in reports)
        result['mongoPerBatchContentVerified']=True
        result['productionGamePoolWrites']=False
        result['shardAudits']=[{'shardId':r.get('shardId'),'verifiedFileRounds':r['verifiedFileRounds'],'mongo':r['mongo']} for r in reports]
        require(result['verifiedFileRounds']==result['statistics']['count']==result['checkpoint'], 'PARALLEL_AUDIT_COUNT')
        return result


def activate(root,mongo_factory,expected_prefix):
    root=Path(root).resolve();path=root/'trials'/TRIAL
    with file_lock(path/'trial.lock'):
        require(not (path/'parallel.json').exists(), 'PARALLEL_ALREADY_ACTIVE')
        old=TrialStore(root,mongo_factory(None))
        try:
            require(old.db.execute("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='trial_maintenance_before_bet'").fetchone(), 'LEGACY_GATE_REQUIRED')
            # Already hold the legacy lock; no nested dispatch lock.
            audit=old._audit({})
            require(audit['checkpoint']==expected_prefix, 'PREFIX_CHANGED')
            plan={'schema':'sg-parallel-allocation-v1','prefix':expected_prefix,'target':PLAN['target'],
                  'shards':allocation(expected_prefix),'legacySessionHash':old.state()['session_hash'],
                  'activated':time.time(),'legacyAudit':audit}
        finally:old.close()
        for spec in plan['shards']:
            s=TrialStore(root,mongo_factory((spec['start'],spec['end'])),shard=spec)
            s.close()
        db=sqlite3.connect(path/'parallel.sqlite3',isolation_level=None)
        try:
            db.execute('PRAGMA journal_mode=WAL');db.execute('PRAGMA synchronous=FULL')
            db.executescript('''CREATE TABLE control(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL,failure TEXT,cooldown_until REAL NOT NULL DEFAULT 0);
              INSERT INTO control(id,enabled) VALUES(1,1);
              CREATE TABLE sessions(shard INTEGER PRIMARY KEY,session_hash TEXT NOT NULL UNIQUE);''')
        finally:db.close()
        import os
        with (path/'parallel.json.tmp').open('xb') as f:
            f.write(canonical(plan));f.flush();os.fsync(f.fileno())
        os.replace(path/'parallel.json.tmp',path/'parallel.json')
        sync_dir(path)
        return {'activated':True,'prefix':expected_prefix,'shards':20,'remaining':PLAN['target']-expected_prefix}
