"""Durable small-batch allocator behind PoolTrial's fixed-session capture RPC.

This module makes no source requests. Enabling remains an operator-only action.
Only unassigned sequences are distributed. A reserved batch stays attached to
its original worker/session across recovery; unknown BETs are never reassigned.
The caller must validate the batch's durable storage before completing it.
"""
import contextlib
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import time

from store import Rejected, require


class WorkPool:
    def __init__(self, directory, trial_id, target, clock=time.time):
        require(isinstance(trial_id, str) and re.fullmatch(r'[a-z0-9_]{1,100}', trial_id), 'BAD_TRIAL_ID')
        require(type(target) is int and 20 <= target <= 300000, 'BAD_TARGET')
        self.clock, self.target = clock, target
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(directory / 'work-pool.sqlite3', isolation_level=None, timeout=30)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS control(
            id INTEGER PRIMARY KEY CHECK(id=1), plan_hash TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 0, failure TEXT,
            next_sequence INTEGER NOT NULL DEFAULT 1);
          CREATE TABLE IF NOT EXISTS workers(
            id INTEGER PRIMARY KEY CHECK(id>=0 AND id<20),
            session_hash TEXT NOT NULL UNIQUE, owner TEXT NOT NULL, epoch INTEGER NOT NULL,
            lease_until REAL NOT NULL, active_batch INTEGER, observed_rate REAL);
          CREATE TABLE IF NOT EXISTS batches(
            id INTEGER PRIMARY KEY, worker INTEGER NOT NULL,
            start INTEGER NOT NULL UNIQUE, end INTEGER NOT NULL UNIQUE,
            created REAL NOT NULL, completed REAL,
            CHECK(start<=end));
        ''')
        signature = hashlib.sha256(json.dumps({'trialId': trial_id, 'target': target, 'workers': 20,
            'version': 1}, sort_keys=True).encode()).hexdigest()
        self.db.execute('INSERT OR IGNORE INTO control(id,plan_hash) VALUES(1,?)', (signature,))
        if self.db.execute('SELECT plan_hash FROM control').fetchone()[0] != signature:
            self.db.close()
            raise Rejected('POOL_PLAN_CHANGED')

    def close(self):
        self.db.close()

    @contextlib.contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def enable_by_operator(self):
        # No RPC operation exposes this method. A failed pool cannot reopen.
        with self.transaction():
            require(self.db.execute('SELECT failure FROM control').fetchone()[0] is None, 'POOL_HALTED')
            self.db.execute('UPDATE control SET enabled=1 WHERE id=1')

    def halt(self, reason):
        require(isinstance(reason, str) and re.fullmatch('[A-Z_]{1,80}', reason), 'BAD_REASON')
        self.db.execute('UPDATE control SET enabled=0,failure=COALESCE(failure,?) WHERE id=1', (reason,))

    def register(self, worker, session_hash, owner):
        require(type(worker) is int and 0 <= worker < 20, 'BAD_WORKER')
        require(isinstance(session_hash, str) and re.fullmatch('[a-f0-9]{64}', session_hash), 'BAD_SESSION_HASH')
        require(isinstance(owner, str) and re.fullmatch('[a-zA-Z0-9:_-]{1,100}', owner), 'BAD_OWNER')
        with self.transaction():
            old = self.db.execute('SELECT * FROM workers WHERE id=?', (worker,)).fetchone()
            require(not old or old['session_hash'] == session_hash, 'SESSION_CHANGED')
            require(not self.db.execute('SELECT 1 FROM workers WHERE session_hash=? AND id<>?',
                (session_hash, worker)).fetchone(), 'SHARED_SESSION')
            if old and old['owner'] == owner and old['lease_until'] > self.clock():
                return {'worker': worker, 'owner': owner, 'epoch': old['epoch']}
            require(not old or old['lease_until'] <= self.clock(), 'WORKER_BUSY')
            epoch = old['epoch'] + 1 if old else 1
            if old:
                self.db.execute('UPDATE workers SET owner=?,epoch=?,lease_until=? WHERE id=?',
                    (owner, epoch, self.clock() + 600, worker))
            else:
                self.db.execute('INSERT INTO workers(id,session_hash,owner,epoch,lease_until) VALUES(?,?,?,?,?)',
                    (worker, session_hash, owner, epoch, self.clock() + 600))
            return {'worker': worker, 'owner': owner, 'epoch': epoch}

    def owned(self, lease):
        row = self.db.execute('SELECT * FROM workers WHERE id=?', (lease['worker'],)).fetchone()
        require(row and row['owner'] == lease['owner'] and row['epoch'] == lease['epoch']
            and row['lease_until'] > self.clock(), 'LEASE_LOST')
        return row

    def heartbeat(self, lease):
        if self.owned(lease)['lease_until'] - self.clock() > 570:
            return
        with self.transaction():
            self.owned(lease)
            self.db.execute('UPDATE workers SET lease_until=? WHERE id=?', (self.clock() + 600, lease['worker']))

    def release_worker(self, lease):
        with self.transaction():
            worker = self.owned(lease)
            require(worker['active_batch'] is None, 'WORKER_HAS_BATCH')
            self.db.execute('UPDATE workers SET lease_until=0 WHERE id=?', (lease['worker'],))

    def suspend_worker(self, lease, proof):
        require(proof.get('status')=='pending' and proof.get('pending') is None
            and proof.get('journaled')==proof.get('durable')==proof.get('checkpoint'),'BATCH_NOT_DURABLE')
        with self.transaction():
            worker=self.owned(lease)
            require(worker['active_batch'] is not None,'WORKER_HAS_NO_BATCH')
            # Keep both the range and session binding; only release the owner.
            self.db.execute('UPDATE workers SET lease_until=0 WHERE id=?',(lease['worker'],))

    def take(self, lease):
        with self.transaction():
            worker = self.owned(lease)
            control = self.db.execute('SELECT * FROM control').fetchone()
            if not control['enabled'] and control['failure'] is None and self.status()['complete']:
                return None
            require(control['enabled'] and control['failure'] is None, 'POOL_STOPPED')
            if worker['active_batch'] is not None:
                # The capture layer must recover the same journal/session.
                # This returns an assignment, never permission to resend BET.
                result = dict(self.db.execute('SELECT * FROM batches WHERE id=?', (worker['active_batch'],)).fetchone())
                result['resumeRequired'] = True
                return result
            remaining = self.target - control['next_sequence'] + 1
            if remaining <= 0:
                return None
            # Aim for eight seconds per batch, and shrink near the finish so
            # fast runners do not exit with large quotas stranded on slow ones.
            size = 100 if worker['observed_rate'] is None else round(worker['observed_rate'] * 8)
            size = min(max(20, size), 400, math.ceil(remaining / 20), remaining)
            start, end = control['next_sequence'], control['next_sequence'] + size - 1
            cursor = self.db.execute('INSERT INTO batches(worker,start,end,created) VALUES(?,?,?,?)',
                (lease['worker'], start, end, self.clock()))
            self.db.execute('UPDATE control SET next_sequence=? WHERE id=1', (end + 1,))
            self.db.execute('UPDATE workers SET active_batch=? WHERE id=?', (cursor.lastrowid, lease['worker']))
            result = dict(self.db.execute('SELECT * FROM batches WHERE id=?', (cursor.lastrowid,)).fetchone())
            result['resumeRequired'] = False
            return result

    def complete(self, lease, batch_id, verify_storage):
        """verify_storage is a trusted server reader, never an RPC-supplied ack.

        Read storage outside the central write transaction; twenty collectors
        must not block one another while a Mongo acknowledgement is checked.
        Caller still owns the separate per-session/batch storage fence.
        """
        worker = self.owned(lease)
        row = self.db.execute('SELECT * FROM batches WHERE id=?', (batch_id,)).fetchone()
        require(row and row['worker'] == lease['worker'], 'BATCH_OWNER_MISMATCH')
        if row['completed'] is not None:
            return  # Durable completion acknowledgement may be delivered twice.
        require(worker['active_batch'] == batch_id, 'BATCH_NOT_ACTIVE')
        proof = verify_storage(dict(row))
        require(proof.get('status') == 'complete' and proof.get('pending') is None
            and proof.get('journaled') == proof.get('durable') == proof.get('checkpoint') == row['end']
            and proof.get('confirmedCount') == row['end'] - row['start'] + 1, 'BATCH_NOT_DURABLE')
        with self.transaction():
            worker = self.owned(lease)  # Fence again after potentially slow I/O.
            current = self.db.execute('SELECT * FROM batches WHERE id=?', (batch_id,)).fetchone()
            if current['completed'] is not None:
                return
            require(worker['active_batch'] == batch_id, 'BATCH_NOT_ACTIVE')
            rate = (row['end'] - row['start'] + 1) / max(0.001, self.clock() - row['created'])
            previous = worker['observed_rate']
            observed = rate if previous is None else previous * 0.5 + rate * 0.5
            self.db.execute('UPDATE batches SET completed=? WHERE id=?', (self.clock(), batch_id))
            self.db.execute('UPDATE workers SET active_batch=NULL,observed_rate=? WHERE id=?',
                (observed, lease['worker']))
            if self.db.execute('SELECT COALESCE(SUM(end-start+1),0) FROM batches WHERE completed IS NOT NULL').fetchone()[0] == self.target:
                self.db.execute('UPDATE control SET enabled=0 WHERE id=1')

    def status(self):
        control = dict(self.db.execute('SELECT * FROM control').fetchone())
        completed = self.db.execute('SELECT COALESCE(SUM(end-start+1),0) FROM batches WHERE completed IS NOT NULL').fetchone()[0]
        active = self.db.execute('SELECT COUNT(*) FROM batches WHERE completed IS NULL').fetchone()[0]
        return {'target': self.target, 'completedBatchRounds': completed, 'assigned': control['next_sequence'] - 1,
            'unassigned': self.target - control['next_sequence'] + 1, 'unfinishedBatches': active,
            'enabled': bool(control['enabled']), 'failure': control['failure'],
            'complete': completed == self.target and active == 0}
