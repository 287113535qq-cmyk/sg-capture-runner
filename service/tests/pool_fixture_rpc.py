"""Offline test transport, restricted to a newly-created system temp directory.

Uses SQLite as a content-checking Mongo fixture. Never opens a network socket.
Not installed as an SSH entrypoint or used by the production RPC router.
"""
import json
import os
from pathlib import Path
import socket
import sqlite3
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pool_trial import PoolTrial
from store import Rejected, canonical
from test_trial import MemoryMongo


def forbidden(*args, **kwargs):
    raise RuntimeError('NETWORK_FORBIDDEN_IN_FIXTURE')


class FixtureMongo:
    def __init__(self, root, plan, scope):
        self.plan, self.scope = plan, scope
        self.db = sqlite3.connect(root / 'fixture-mongo.sqlite3', timeout=30)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,trial TEXT,sequence INTEGER,body TEXT,UNIQUE(trial,sequence))')
    def ensure(self): pass
    def put(self, rows):
        inserted = 0
        with self.db:
            for row in rows:
                assert row['trialId'] == self.plan['trialId'] and self.scope[0] <= row['sequence'] <= self.scope[1]
                encoded = canonical(row).decode()
                inserted += self.db.execute('INSERT OR IGNORE INTO records VALUES(?,?,?,?)',
                    (row['_id'], row['trialId'], row['sequence'], encoded)).rowcount
                actual = self.db.execute('SELECT body FROM records WHERE id=?', (row['_id'],)).fetchone()
                assert actual and actual[0] == encoded
        for row in rows:
            assert json.loads(self.db.execute('SELECT body FROM records WHERE id=?', (row['_id'],)).fetchone()[0]) == row
        return inserted
    def summary(self):
        selected = MemoryMongo()
        selected.rows = {row[0]: json.loads(row[1]) for row in self.db.execute(
            'SELECT id,body FROM records WHERE trial=? AND sequence>=? AND sequence<=?',
            (self.plan['trialId'], *self.scope))}
        return selected.summary()
    def verify(self, rows):
        for row in rows:
            actual=self.db.execute('SELECT body FROM records WHERE id=?',(row['_id'],)).fetchone()
            assert actual and json.loads(actual[0]) == row
        return len(rows)
    def close(self): self.db.close()


def main():
    assert os.environ.get('SG_OFFLINE_POOL_TEST') == '1'
    root = Path(sys.argv[1]).resolve()
    assert root.parent == Path(tempfile.gettempdir()).resolve() and root.name.startswith('sg-pool-e2e-fixture-')
    socket.socket = forbidden
    socket.create_connection = forbidden
    plan = json.loads((root / 'fixture-plan.json').read_text())
    assert plan['trialId'] == 'bookofsevens_pool_e2e_fixture'
    service = PoolTrial(root, plan, lambda scope: FixtureMongo(root, plan, scope))
    try:
        if len(sys.argv) > 2 and sys.argv[2] == 'init':
            service.pool.enable_by_operator()
            return
        if len(sys.argv) > 2 and sys.argv[2] == 'audit':
            audit = service.dispatch({'schema': plan['schema'], 'trialId': plan['trialId'], 'op': 'audit'})
            db = sqlite3.connect(root / 'fixture-mongo.sqlite3')
            try:
                sequences = [r[0] for r in db.execute('SELECT sequence FROM records ORDER BY sequence')]
                assert sequences == list(range(1, plan['target'] + 1))
                unique = db.execute("SELECT COUNT(DISTINCT json_extract(body,'$.sourceSessionHash')) FROM records").fetchone()[0]
                batches = service.pool.db.execute('SELECT COUNT(*) FROM batches').fetchone()[0]
                print(json.dumps({'fixtureOnly': True, 'officialSourceRequests': 0, 'status': audit['status'],
                    'verifiedFileRounds': audit['verifiedFileRounds'], 'statistics': audit['statistics'],
                    'uniqueContinuousSequences': len(sequences), 'distinctSessions': unique, 'completedBatches': batches,
                    'sourceEnabled': audit['globalSourceEnabled'], 'mongoBackend': 'SQLite content-check fixture; not real Mongo'}))
            finally: db.close()
            return
        for line in sys.stdin:
            try:
                response = service.dispatch(json.loads(line))
            except Rejected as error:
                response = {'ok': False, 'error': str(error)}
            print(json.dumps(response, separators=(',', ':')), flush=True)
    finally:
        service.close()


if __name__ == '__main__': main()
