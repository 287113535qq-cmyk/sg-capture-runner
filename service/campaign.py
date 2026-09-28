"""First-round controller. Phase two cannot be enabled by this service."""
import json
from pathlib import Path
import shutil
import sqlite3
import time
from store import require, canonical, digest, file_lock
from work_pool import WorkPool

CONFIG=Path(__file__).resolve().parents[1]/'config'


class Campaign:
    def __init__(self, root, disk_free=None, clock=time.time, _group_mode=False):
        self.root=Path(root).resolve();self.clock=clock
        self.config=json.loads((CONFIG/'round-one.json').read_text(encoding='utf-8'))
        self.plans=json.loads((CONFIG/'round-one-plans.json').read_text(encoding='utf-8'))
        require(self.config['phase']==1 and self.config['buy']==0 and self.config['secondRoundEnabled'] is False,'SECOND_ROUND_FORBIDDEN')
        self.directory=self.root/'campaigns'/self.config['campaignId'];self.directory.mkdir(parents=True,exist_ok=True)
        require(_group_mode or not (self.directory/'independent-groups.json').exists(), 'GROUP_OPERATOR_REQUIRED')
        self.disk_free=disk_free or (lambda:shutil.disk_usage(self.root).free)
        self.db=sqlite3.connect(self.directory/'queue.sqlite3',isolation_level=None,timeout=30)
        self.db.row_factory=sqlite3.Row;self.db.execute('PRAGMA journal_mode=WAL');self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''CREATE TABLE IF NOT EXISTS control(id INTEGER PRIMARY KEY CHECK(id=1),
          enabled INTEGER NOT NULL DEFAULT 0, active_game INTEGER, reason TEXT, audit_owner TEXT,
          audit_until REAL NOT NULL DEFAULT 0, config_hash TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS games(game_id INTEGER PRIMARY KEY,status TEXT NOT NULL,baseline INTEGER NOT NULL,
          confirmed INTEGER NOT NULL DEFAULT 0,completed REAL);
        ''')
        signature=digest(self.config)
        self.db.execute('INSERT OR IGNORE INTO control(id,config_hash) VALUES(1,?)',(signature,))
        require(self.db.execute('SELECT config_hash FROM control').fetchone()[0]==signature,'CAMPAIGN_CONFIG_CHANGED')
        self.db.executemany('INSERT OR IGNORE INTO games(game_id,status,baseline,confirmed) VALUES(?,?,?,?)',
            [(g['gameId'],g['status'],g['creditedHistoricalRounds'],g['creditedHistoricalRounds']) for g in self.config['games']])

    def close(self):self.db.close()

    def _state(self):
        return self.db.execute('SELECT * FROM control WHERE id=1').fetchone()

    def _update(self, fields, values=()):
        self.db.execute('UPDATE control SET '+fields+' WHERE id=1',values)

    def _record_owner(self, gid):pass

    def _assign(self, gid):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            if gid is None:
                old=self._state()['active_game']
                self.db.execute("UPDATE games SET status='complete',confirmed=300000,completed=? WHERE game_id=?",(self.clock(),old))
                self._update('active_game=NULL,audit_owner=NULL,audit_until=0')
            else:
                self._record_owner(gid)
                self.db.execute("UPDATE games SET status='active' WHERE game_id=?",(gid,))
                self._update('active_game=?',(gid,))
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK');raise

    def pause(self, reason):
        self._update('enabled=0,reason=COALESCE(reason,?)',(reason,))

    def allowed(self, new_round=False):
        state=self._state()
        # Already-authorized free continuations may finish into the lower reserve,
        # while no new BET is armed after the 30 GiB soft stop.
        if new_round:
            if self.disk_free()<self.config['diskReserveBytes']:
                self.pause('DISK_RESERVE_REACHED');return False
            return bool(state['enabled'])
        if self.disk_free()<self.config['diskFinishReserveBytes']:
            self.pause('DISK_CRITICAL_RESERVE_REACHED');return False
        return bool(state['enabled']) or state['reason']=='DISK_RESERVE_REACHED'

    def enable_by_operator(self):
        require(self.disk_free()>=self.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
        state=self._state()
        require(state['reason'] is None,'CAMPAIGN_REVIEW_REQUIRED')
        self._update('enabled=1')

    def status(self):
        state=dict(self._state())
        counts={r['status']:r['n'] for r in self.db.execute('SELECT status,COUNT(*) n FROM games GROUP BY status')}
        return {'campaignId':self.config['campaignId'],'phase':1,'secondRoundEnabled':False,
            'enabled':bool(state['enabled']),'reason':state['reason'],'activeGame':state['active_game'],
            'counts':counts,'games':178,'targetPerGame':300000,'diskFreeBytes':self.disk_free(),
            'diskReserveBytes':self.config['diskReserveBytes'],'status':'complete' if counts.get('complete')==178
                else 'running' if state['enabled'] else 'paused'}

    def select(self, owner):
        require(isinstance(owner,str) and 1<=len(owner)<=100,'BAD_OWNER')
        with file_lock(self.directory/'selection.lock'):
            if not self.allowed(new_round=True):return {'action':'stop',**self.status()}
            state=self._state()
            gid=state['active_game']
            if gid is not None:
                plan=self.plans[str(gid)];pool=WorkPool(self.root/'trials'/plan['trialId'],plan['trialId'],plan['target'])
                try:progress=pool.status()
                finally:pool.close()
                if progress['failure']:
                    self.pause('ACTIVE_GAME_REQUIRES_REVIEW');return {'action':'stop',**self.status()}
                if progress['complete']:
                    receipt=self.root/'trials'/plan['trialId']/'campaign-audit.json'
                    if receipt.exists():
                        audit=json.loads(receipt.read_text())
                        require(audit['planHash']==digest(plan) and audit['verifiedFileRounds']==plan['target'],'CAMPAIGN_AUDIT_MISMATCH')
                        self._assign(None);gid=None
                    else:
                        if state['audit_until']<=self.clock() or state['audit_owner']==owner:
                            self._update('audit_owner=?,audit_until=?',(owner,self.clock()+1800))
                            return {'action':'audit','plan':plan}
                        return {'action':'wait','gameId':gid}
                else:return {'action':'capture','plan':plan}
            next_game=self.db.execute("SELECT game_id FROM games WHERE status='ready' ORDER BY game_id LIMIT 1").fetchone()
            if next_game is None:
                done=self.db.execute("SELECT COUNT(*) FROM games WHERE status<>'complete'").fetchone()[0]==0
                self.pause('FIRST_ROUND_COMPLETE' if done else 'PROTOCOL_ADAPTERS_PENDING')
                return {'action':'stop',**self.status()}
            gid=next_game['game_id'];plan=self.plans[str(gid)]
            require(plan['phase']==1 and plan['buy']==0,'SECOND_ROUND_FORBIDDEN')
            pool=WorkPool(self.root/'trials'/plan['trialId'],plan['trialId'],plan['target'])
            try:pool.enable_by_operator()
            finally:pool.close()
            self._assign(gid)
            return {'action':'capture','plan':plan}

    def dispatch(self, req):
        require(req.get('schema')=='sg-round-one-v1' and req.get('trialId')==self.config['campaignId'],'CAMPAIGN_REQUIRED')
        require(req.get('op') in {'status','select'},'CAMPAIGN_OP_FORBIDDEN')
        result=self.status() if req['op']=='status' else self.select(req.get('owner'))
        return {'ok':True,**result}


def for_group(root, runner_group='primary', **kwargs):
    from runner_federation import CAMPAIGN
    if (Path(root)/'campaigns'/CAMPAIGN/'independent-groups.json').exists():
        from group_campaign import GroupCampaign
        return GroupCampaign(root,runner_group=runner_group,**kwargs)
    return Campaign(root,**kwargs)
