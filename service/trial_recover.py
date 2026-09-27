"""Operator-only recovery of the one proven, uncharged bootstrap rejection.

No official calls. Archive the original evidence before reopening sequence 1.
Never resolves a timeout, an accepted bet, or any nonzero checkpoint.
"""
import json
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path
from store import file_lock, require, canonical
from round_fields import params
from trial_store import TRIAL

def recover(directory):
    root=Path(directory).resolve()
    with file_lock(root/'trial.lock'):
        db=sqlite3.connect(root/'state.sqlite3',isolation_level=None)
        db.row_factory=sqlite3.Row
        try:
            state=db.execute('SELECT * FROM trial WHERE id=1').fetchone()
            pending=db.execute('SELECT * FROM pending WHERE id=1').fetchone()
            require(state['status']=='halted' and state['durable']==state['checkpoint']==0, 'RECOVERY_NOT_ALLOWED')
            require(pending and pending['sequence']==1 and pending['awaiting'] is None, 'RECOVERY_NOT_ALLOWED')
            require(db.execute('SELECT COUNT(*) FROM receipts').fetchone()[0]==0, 'RECOVERY_NOT_ALLOWED')
            raw=json.loads(pending['raw'])
            require(len(raw['steps'])==1 and raw['steps'][0]['msgId']=='BET', 'RECOVERY_NOT_ALLOWED')
            step=raw['steps'][0];p=params(step['responsePayload']);xml=ET.fromstring(step['responseXml'])
            require(xml.findtext('PAYLOAD')==step['responsePayload'] and xml.findtext('SUCCESS').lower()=='true','RECOVERY_NOT_ALLOWED')
            require(p.get('MSGID')=='ERROR' and p.get('EID')=='ERROR_PROTOCOL_SEQUENCE'
                    and p.get('AB')==str(raw['startBalanceRaw']), 'RECOVERY_NOT_ALLOWED')
            db.execute('CREATE TABLE IF NOT EXISTS rejected_attempts(attempt TEXT PRIMARY KEY,sequence INTEGER NOT NULL,raw TEXT NOT NULL,reason TEXT NOT NULL)')
            db.execute('BEGIN IMMEDIATE')
            try:
                db.execute('INSERT INTO rejected_attempts VALUES(?,?,?,?)',(pending['attempt'],1,pending['raw'],'explicit-uncharged-bootstrap-protocol-rejection'))
                db.execute('DELETE FROM pending WHERE id=1')
                db.execute("UPDATE trial SET status='pending',owner=NULL,lease_until=0,failure=NULL WHERE id=1")
                db.execute('UPDATE runs SET ended=COALESCE(ended,started),end_checkpoint=0 WHERE end_checkpoint IS NULL')
                db.execute('COMMIT')
            except BaseException:
                db.execute('ROLLBACK');raise
            return {'archivedRejectedAttempts':1,'confirmedRounds':0,'sourceRequests':0,'status':'pending'}
        finally:db.close()

if __name__=='__main__':
    try:print(json.dumps(recover('/var/lib/sg-capture-runner/trials/'+TRIAL)))
    except Exception:raise SystemExit('Trial recovery rejected; private evidence retained')
