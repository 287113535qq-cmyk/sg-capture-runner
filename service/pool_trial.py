"""Repository-scoped stable sessions pull batches through the existing journal.

All SG I/O stays on the Runner. This service only assigns work and stores,
validates, and audits responses. There is no RPC that enables collection.
"""
import json
import os
from pathlib import Path
import re
import sqlite3
import time

from pool_plan import validate_pool_plan
from store import require, Rejected, canonical, digest, file_lock, sync_dir
from trial_store import TrialStore
from work_pool import WorkPool
from runner_federation import group_range, worker_count


class PoolTrial:
    def __init__(self, root, plan, mongo_factory, clock=time.time, audit_executor=None, runner_group='primary'):
        self.plan = validate_pool_plan(plan)
        self.base, self.clock = Path(root).resolve(), clock
        self.root = self.base / 'trials' / self.plan['trialId']
        self.root.mkdir(parents=True, exist_ok=True)
        self.runner_group = runner_group
        self.worker_range = group_range(runner_group, worker_count(self.root, self.plan['trialId']))
        with file_lock(self.root / 'pool-init.lock'):
            manifest = self.root / 'pool-plan.json'
            if manifest.exists():
                require(json.loads(manifest.read_text(encoding='utf-8')) == self.plan, 'POOL_PLAN_CHANGED')
            else:
                staging = self.root / 'pool-plan.json.tmp'
                with staging.open('wb') as stream:
                    stream.write(canonical(self.plan)); stream.flush(); os.fsync(stream.fileno())
                os.replace(staging, manifest)
                sync_dir(self.root)
            self.pool = WorkPool(self.root, self.plan['trialId'], self.plan['target'], clock)
            self.pool.db.execute('CREATE TABLE IF NOT EXISTS startup(id INTEGER PRIMARY KEY CHECK(id=1))')
            self.pool.db.execute('CREATE TABLE IF NOT EXISTS group_startup(name TEXT PRIMARY KEY)')
        self.mongo_factory = mongo_factory
        self.audit_executor = audit_executor
        self.store = None
        self.identity = None
        self.worker_lease = None
        self.chunk_lease = None
        self.campaign=None
        if self.plan.get('campaignId'):
            from campaign import Campaign
            self.campaign=Campaign(self.base)

    def close(self):
        if self.worker_lease is not None:
            try:
                if self.pool.owned(self.worker_lease)['active_batch'] is None:
                    self.pool.release_worker(self.worker_lease)
            except Rejected:
                pass
        if self.store:
            self.store.close()
        self.pool.close()
        if self.campaign:self.campaign.close()

    def allowed(self):
        row = self.pool.db.execute('SELECT enabled,failure FROM control').fetchone()
        return bool(row['enabled']) and row['failure'] is None and (self.campaign is None or self.campaign.allowed())

    def open_batch(self, batch):
        if self.store and self.store.batch['id'] == batch['id']:
            return self.store
        if self.store:
            self.store.close()
        spec = {key: batch[key] for key in ('id', 'worker', 'start', 'end')}
        self.store = TrialStore(self.base, self.mongo_factory((batch['start'], batch['end'])),
            self.clock, source_allowed=self.allowed, plan=self.plan, batch=spec)
        if self.campaign:self.store.new_round_allowed=lambda:self.allowed() and self.campaign.allowed(new_round=True)
        self.chunk_lease = None
        return self.store

    def check_worker(self, req):
        require(self.identity is not None and req.get('shardId') == self.identity['worker']
            and req.get('owner') == self.identity['owner']
            and req.get('workerEpoch') == self.worker_lease['epoch'], 'POOL_WORKER_MISMATCH')
        self.pool.heartbeat(self.worker_lease)

    def proof(self, batch):
        require(self.store.batch['id'] == batch['id'], 'BATCH_CHANGED')
        status = self.store.dispatch({'schema': self.plan['schema'], 'trialId': self.plan['trialId'], 'op': 'status'})
        return {**status, 'confirmedCount': status['statistics']['count']}

    def next_batch(self, req):
        if self.campaign and not self.campaign.allowed(new_round=True):
            return {'paused':True,'reason':self.campaign.status()['reason']}
        if self.pool.status()['complete']:
            self.pool.release_worker(self.worker_lease)
            return {'done': True}
        require(self.allowed(), 'GLOBAL_SOURCE_STOPPED')
        started = self.pool.db.execute('SELECT 1 FROM group_startup WHERE name=?', (self.runner_group,)).fetchone()
        if self.runner_group == 'primary':
            started = started or self.pool.db.execute('SELECT 1 FROM startup WHERE id=1').fetchone()
        if not started:
            live = self.pool.db.execute('SELECT COUNT(*) FROM workers WHERE lease_until>? AND id>=? AND id<?',
                (self.clock(), self.worker_range.start, self.worker_range.stop)).fetchone()[0]
            if live != 20:
                return {'waitingForWorkers': True, 'readyWorkers': live}
            self.pool.db.execute('INSERT OR IGNORE INTO group_startup(name) VALUES(?)', (self.runner_group,))
        while True:
            batch = self.pool.take(self.worker_lease)
            if batch is None:
                self.pool.release_worker(self.worker_lease)
                return {'done': True}
            store = self.open_batch(batch)
            if store.state()['status'] == 'complete':
                # A reply may have been lost after storage finished this batch.
                self.pool.complete(self.worker_lease, batch['id'], self.proof)
                if self.pool.status()['complete']:
                    self.pool.release_worker(self.worker_lease)
                    return {'done': True}
                continue
            if self.chunk_lease is None:
                self.chunk_lease = store.dispatch({**req, 'op': 'claim',
                    'sessionHash': self.identity['sessionHash'], 'commitSha': self.identity['commitSha']})
            return {**self.chunk_lease, 'batchId': batch['id'], 'done': False}

    def dispatch(self, req):
        require(isinstance(req, dict) and req.get('schema') == self.plan['schema']
            and req.get('trialId') == self.plan['trialId'], 'POOL_TRIAL_MISMATCH')
        require(len(canonical(req)) <= 1048576, 'REQUEST_TOO_LARGE')
        started, op = time.perf_counter(), req.get('op')
        try:
            if op == 'status':
                result = self.status()
            elif op == 'audit':
                result = self.audit(req)
            elif op == 'ping':
                result = {'pong': True}
            elif op == 'register':
                require(type(req.get('shardId')) is int and req['shardId'] in self.worker_range, 'RUNNER_GROUP_MISMATCH')
                require(req.get('planHash') == digest(self.plan), 'RUNNER_POOL_PLAN_MISMATCH')
                if self.pool.status()['complete']:
                    # Another resumed worker may reconcile the final durable
                    # batch between this worker's status read and registration.
                    return {'ok':True,'schema':self.plan['schema'],'fixtureOnly':False,'done':True,
                        'serverWorkMs':round((time.perf_counter()-started)*1000,3)}
                require(self.allowed(), 'GLOBAL_SOURCE_STOPPED')
                require(isinstance(req.get('commitSha'), str) and re.fullmatch('[a-f0-9]{40}', req['commitSha']), 'BAD_COMMIT_SHA')
                identity = {'worker': req.get('shardId'), 'owner': req.get('owner'),
                    'sessionHash': req.get('sessionHash'), 'commitSha': req['commitSha']}
                require(self.identity is None or self.identity == identity, 'CONNECTION_WORKER_CHANGED')
                self.worker_lease = self.pool.register(identity['worker'], identity['sessionHash'], identity['owner'])
                self.identity = identity
                result = {'workerEpoch': self.worker_lease['epoch']}
            else:
                require(op in {'next', 'begin', 'intent', 'exchange_journal', 'flush', 'release', 'fail'}, 'POOL_OP_FORBIDDEN')
                self.check_worker(req)
                if op == 'next':
                    result = self.next_batch(req)
                else:
                    require(self.store is not None and req.get('batchId') == self.store.batch['id'], 'POOL_BATCH_MISMATCH')
                    result = self.store.dispatch(req)
                    if op == 'release' and result['status'] == 'complete':
                        self.pool.complete(self.worker_lease, self.store.batch['id'], self.proof)
                        self.chunk_lease = None
                    elif op == 'release' and result['status']=='pending':
                        self.pool.suspend_worker(self.worker_lease,result)
                    if op == 'fail' and (req.get('category', '').startswith('source_') or result['status'] == 'halted'):
                        self.pool.halt('SOURCE_OR_SESSION_FAILURE')
        except Rejected:
            if self.store and self.store.state()['status'] == 'halted':
                self.pool.halt('BATCH_HALTED')
            raise
        return {'ok': True, 'schema': self.plan['schema'], 'fixtureOnly': False,
            'serverWorkMs': round((time.perf_counter() - started) * 1000, 3), **result}

    def status(self):
        allocation = self.pool.status()
        completed = allocation['completedBatchRounds']
        totals = {key: completed for key in ('journaled', 'durable', 'checkpoint')}
        workers = {i: {'shardId': i, 'checkpoint': 0, 'journaled': 0, 'durable': 0, 'pending': None,
            'activeBatch': None, 'leaseUntil': 0, 'failure': None} for i in range(self.pool.worker_count)}
        for row in self.pool.db.execute('SELECT worker,SUM(end-start+1) AS n FROM batches WHERE completed IS NOT NULL GROUP BY worker'):
            workers[row['worker']].update({key: row['n'] for key in totals})
        for batch in self.pool.db.execute('SELECT * FROM batches WHERE completed IS NULL'):
            worker = workers[batch['worker']]
            worker['activeBatch'] = batch['id']
            path = self.root / 'batches' / str(batch['id']) / 'state.sqlite3'
            if not path.exists():
                continue  # Assignment is durable before its journal is opened.
            db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
            db.row_factory = sqlite3.Row
            try:
                tables={r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if not {'trial','receipts','pending'}.issubset(tables):
                    continue
                state = db.execute('SELECT * FROM trial WHERE id=1').fetchone()
                if state is None:
                    continue
                journaled = db.execute('SELECT COALESCE(MAX(sequence),?) FROM receipts', (batch['start'] - 1,)).fetchone()[0]
                pending = db.execute('SELECT sequence,awaiting IS NOT NULL AS awaitingResponse FROM pending').fetchone()
                for key, value in (('journaled', journaled), ('durable', state['durable']), ('checkpoint', state['checkpoint'])):
                    n = value - batch['start'] + 1
                    worker[key] += n; totals[key] += n
                worker.update(pending=dict(pending) if pending else None, leaseUntil=state['lease_until'], failure=state['failure'])
            finally:
                db.close()
        status = 'complete' if allocation['complete'] else 'halted' if allocation['failure'] else 'claimed' if allocation['unfinishedBatches'] else 'pending'
        return {'trialId': self.plan['trialId'], 'mode': f'dynamic-{self.pool.worker_count}',
            'workerCapacity': self.pool.worker_count, 'target': self.plan['target'],
            'status': status, **totals, 'shards': list(workers.values()), 'globalSourceEnabled': self.allowed(),
            'failure': allocation['failure'], 'unassigned': allocation['unassigned'],
            'unfinishedBatches': allocation['unfinishedBatches'], 'distinctBoundSessions': self.pool.db.execute('SELECT COUNT(*) FROM workers').fetchone()[0],
            'countSemantics': 'sum of complete rounds; never maximum sequence'}

    def audit(self, req):
        shard = req.get('shardId')
        require(shard is None or type(shard) is int and shard in self.worker_range, 'BAD_WORKER')
        require(shard is not None or self.pool.status()['complete'] or not self.allowed(), 'POOL_NOT_QUIESCENT')
        reports = []
        batches = self.pool.db.execute('SELECT * FROM batches WHERE (? IS NULL OR worker=?) ORDER BY start', (shard, shard)).fetchall()
        require(all(batch['completed'] is not None for batch in batches), 'POOL_NOT_QUIESCENT')
        timing = None
        if self.audit_executor and batches:
            # Only the trusted service supplies this executor. RPC callers
            # cannot raise parallelism or replace verification with sampling.
            with file_lock(self.root / 'pool-audit.lock'):
                reports, timing = self.audit_executor(self.base, self.plan, batches,
                    {'schema':self.plan['schema'], 'trialId':self.plan['trialId'], 'op':'audit'})
        else:
            for batch in batches:
                spec = {key: batch[key] for key in ('id', 'worker', 'start', 'end')}
                store = TrialStore(self.base, self.mongo_factory((batch['start'], batch['end'])), self.clock,
                    source_allowed=self.allowed, plan=self.plan, batch=spec)
                try:
                    reports.append(store.dispatch(req))
                finally:
                    store.close()
        result = self.status()
        if timing is not None:result['auditExecution'] = timing
        result['verifiedFileRounds'] = sum(report['verifiedFileRounds'] for report in reports)
        result['statistics'] = {key: sum(r['statistics'][key] for r in reports)
            for key in ('count', 'stakeRaw', 'winRaw', 'sourceFrames', 'freeRounds', 'zeroWinRounds')}
        result['statistics']['maxMul'] = max((r['statistics']['maxMul'] for r in reports), default=0)
        result['productionGamePoolWrites'] = False
        result['mongoPerBatchContentVerified'] = True
        if shard is None:
            require(all(a['end'] + 1 == b['start'] for a, b in zip(batches, batches[1:])), 'POOL_SEQUENCE_GAP')
            require(not batches or batches[0]['start'] == 1, 'POOL_SEQUENCE_START')
            require(result['verifiedFileRounds'] == result['checkpoint'], 'POOL_AUDIT_COUNT')
            if self.campaign and result['status']=='complete':
                temporary=self.root/'campaign-audit.tmp'
                with temporary.open('wb') as stream:
                    stream.write(canonical({'planHash':digest(self.plan),'verifiedFileRounds':result['verifiedFileRounds']}))
                    stream.flush();os.fsync(stream.fileno())
                os.replace(temporary,self.root/'campaign-audit.json');sync_dir(self.root)
        return result
