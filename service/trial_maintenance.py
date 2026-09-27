"""Operator-only gate: finish the current round, refuse the next BET intent.

This does not cancel a Runner or interrupt an official request. It works with
the original already-running service process, before new code is activated.
"""
import argparse
import json
import sqlite3
import time
from pathlib import Path
from store import file_lock, require
from trial_store import TRIAL

def gate(root, enabled):
    root=Path(root).resolve()
    with file_lock(root/'trial.lock'):
        db=sqlite3.connect(root/'state.sqlite3',isolation_level=None)
        db.row_factory=sqlite3.Row
        try:
            s=db.execute('SELECT * FROM trial WHERE id=1').fetchone()
            db.execute('CREATE TABLE IF NOT EXISTS maintenance_events(id INTEGER PRIMARY KEY,at REAL NOT NULL,enabled INTEGER NOT NULL,durable INTEGER NOT NULL,checkpoint INTEGER NOT NULL)')
            if enabled:
                require(s['status'] in {'claimed','pending'},'MAINTENANCE_STATE_REJECTED')
                db.execute("CREATE TRIGGER IF NOT EXISTS trial_maintenance_before_bet BEFORE INSERT ON pending BEGIN SELECT RAISE(ABORT,'TRIAL_MAINTENANCE_STOP'); END")
            else:
                require(s['status']=='pending' and s['owner'] is None and db.execute('SELECT COUNT(*) FROM pending').fetchone()[0]==0,'TRIAL_NOT_DRAINED')
                db.execute('DROP TRIGGER IF EXISTS trial_maintenance_before_bet')
            db.execute('INSERT INTO maintenance_events(at,enabled,durable,checkpoint) VALUES(?,?,?,?)',(time.time(),int(enabled),s['durable'],s['checkpoint']))
            return {'maintenanceGate':enabled,'durable':s['durable'],'checkpoint':s['checkpoint'],'status':s['status']}
        finally:db.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['drain','resume'])
    args=parser.parse_args()
    print(json.dumps(gate('/var/lib/sg-capture-runner/trials/'+TRIAL,args.action=='drain')))
