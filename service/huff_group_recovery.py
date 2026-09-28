"""Operator-only recovery of the pinned primary 32714 protocol stop.

Both groups are inspected and backed up. Only primary is reopened. This exact
profile also reviews the old 32717 protocol-exit misclassification; it cannot
clear a different source/storage/disk failure or discard/replay either BET.
No RPC imports or exposes this operation.
"""
from contextlib import ExitStack, closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time

from campaign import for_group
from huff_fields import HuffFields
from native_nextgen_fields import NativeNextgenFields
from pending_discard import backup_database
from store import canonical, digest, file_lock, require, sync_dir

REVIEW = 'primary-hard-hat-32714-group-recovery-v1'
BOUNDARIES = {
    'primary': {'game':32714, 'complete':2, 'committed':1, 'batch':5, 'worker':14, 'sequence':402,
                'rawHash':'67d1e0dae3eab7e26ac6d5706798fc1ceef5b10f86d57e14e402e404952b47b7'},
    'secondary': {'game':32717, 'complete':244, 'committed':228, 'batch':5, 'worker':37, 'sequence':427,
                  'rawHash':'3a74bab9f1861122a38c626355a1ab293d25ae9762de3b496f5cfc9209b98e91'},
}


def readonly(path):
    db=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
    db.row_factory=sqlite3.Row
    return db


def save(path, value):
    with path.open('xb') as stream:
        stream.write(canonical(value));stream.flush();os.fsync(stream.fileno())
    path.chmod(0o600);sync_dir(path.parent)


def recover(root, mongo_factory, backup_dir, proof=None, apply=False, clock=time.time):
    root=Path(root).resolve();backup=Path(backup_dir).resolve()
    require(backup.is_relative_to(root/'reviews') and backup!=root/'reviews','HUFF_BACKUP_PATH')
    campaign=for_group(root,'primary',clock=clock)
    try:
        require(hasattr(campaign,'runner_group'),'HUFF_GROUP_MODE_REQUIRED')
        with ExitStack() as locks:
            locks.enter_context(file_lock(campaign.directory/'selection.lock'))
            require(campaign.disk_free()>=campaign.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
            exists=campaign.db.execute("SELECT 1 FROM sqlite_master WHERE name='group_protocol_reviews'").fetchone()
            require(not exists or not campaign.db.execute('SELECT 1 FROM group_protocol_reviews WHERE id=?',(REVIEW,)).fetchone(),
                    'HUFF_RECOVERY_ALREADY_RECORDED')
            tables={name:[dict(r) for r in campaign.db.execute('SELECT * FROM '+name+' ORDER BY rowid')]
                    for name in ('control','group_control','dispatch_control','games','game_owners')}
            groups={r['name']:r for r in tables['group_control']}
            require(set(groups)==set(BOUNDARIES),'HUFF_GROUPS_CHANGED')
            require(tables['dispatch_control']==[{'id':1,'enabled':0,'reason':'SOURCE_OR_STORAGE_REQUIRES_REVIEW'}],
                    'HUFF_GLOBAL_PAUSE_CHANGED')
            databases={'queue.sqlite3':campaign.db};files={};snapshots={};primary_batch_path=None;primary_pool_path=None
            for group,expected in BOUNDARIES.items():
                state=groups[group];gid=expected['game'];plan=campaign.plans[str(gid)]
                require(state['active_game']==gid and not state['enabled'] and state['reason']=='ACTIVE_GAME_REQUIRES_REVIEW'
                        and state['audit_until']<=clock(), 'HUFF_GROUP_NOT_PAUSED')
                owner=campaign.db.execute('SELECT group_name FROM game_owners WHERE game_id=?',(gid,)).fetchone()
                require(owner and owner[0]==group,'HUFF_GROUP_OWNER_CHANGED')
                directory=root/'trials'/plan['trialId']
                require(json.loads((directory/'pool-plan.json').read_text())==plan,'HUFF_PLAN_CHANGED')
                locks.enter_context(file_lock(directory/'pool-init.lock'))
                locks.enter_context(file_lock(directory/'protocol-review.lock'))
                pool_path=directory/'work-pool.sqlite3'
                pool=locks.enter_context(closing(readonly(pool_path)))
                control=dict(pool.execute('SELECT * FROM control').fetchone())
                require(control['enabled']==0 and control['failure']=='BATCH_HALTED','HUFF_POOL_NOT_PAUSED')
                workers=[dict(r) for r in pool.execute('SELECT * FROM workers ORDER BY id')]
                require(all(w['lease_until']<=clock() for w in workers),'HUFF_ACTIVE_WORKER')
                require(all((w['id']<20 if group=='primary' else 20<=w['id']<40) for w in workers),'HUFF_WRONG_WORKER_GROUP')
                batches=[dict(r) for r in pool.execute('SELECT * FROM batches ORDER BY id')]
                require(0<len(batches)<=40,'HUFF_REVIEW_BATCH_LIMIT')
                databases[group+'/work-pool.sqlite3']=pool
                adapter=HuffFields(plan) if group=='primary' else NativeNextgenFields(plan)
                journals={};count=committed=0;pending_count=0
                for batch in batches:
                    folder=directory/'batches'/str(batch['id']);path=folder/'state.sqlite3'
                    locks.enter_context(file_lock(folder/'trial.lock'))
                    db=locks.enter_context(closing(readonly(path)))
                    trial=dict(db.execute('SELECT * FROM trial').fetchone())
                    require(trial['lease_until']<=clock() and trial['cooldown_until']<=clock(),'HUFF_ACTIVE_BATCH')
                    spec={k:batch[k] for k in ('id','worker','start','end')}
                    require(trial['plan_hash']==digest({'plan':plan,'batch':spec}),'HUFF_BATCH_PLAN_CHANGED')
                    worker=next((w for w in workers if w['id']==batch['worker']),None)
                    require(worker and worker['session_hash']==trial['session_hash'] and worker['active_batch']==batch['id'],
                            'HUFF_SESSION_BINDING_CHANGED')
                    rows=[dict(r) for r in db.execute('SELECT * FROM receipts ORDER BY sequence')]
                    require([r['sequence'] for r in rows]==list(range(batch['start'],batch['start']+len(rows))), 'HUFF_RECEIPT_GAP')
                    require(all(r['filed']==r['committed'] for r in rows),'HUFF_STORAGE_BOUNDARY_CHANGED')
                    records=[json.loads(r['payload']) for r in rows]
                    durable=[json.loads(r['payload']) for r in rows if r['committed']]
                    require(trial['durable']==trial['checkpoint']==batch['start']-1+len(durable),'HUFF_CHECKPOINT_CHANGED')
                    for record in records:
                        require(adapter.settled(record['raw'])==record['normalized'] and digest(record['raw'])==record['rawHash']
                                and digest(record['normalized'])==record['normalizedHash']
                                and digest({k:v for k,v in record.items() if k!='contentHash'})==record['contentHash'],
                                'HUFF_RECORD_MISMATCH')
                    mongo=locks.enter_context(closing(mongo_factory(plan,(batch['start'],batch['end']))))
                    for offset in range(0,len(durable),100):
                        require(mongo.verify(durable[offset:offset+100])==len(durable[offset:offset+100]),'HUFF_MONGO_MISMATCH')
                    require(mongo.summary()['count']==len(durable),'HUFF_MONGO_COUNT')
                    for name,values in [('raw.jsonl',[{'_id':r['_id'],'contentHash':r['contentHash'],'rawHash':r['rawHash'],'raw':r['raw']} for r in durable]),
                                        ('rounds.jsonl',[{k:v for k,v in r.items() if k!='raw'} for r in durable])]:
                        data=(folder/name).read_bytes() if (folder/name).exists() else b''
                        require(data==b''.join(canonical(v)+b'\n' for v in values),'HUFF_FILE_MISMATCH')
                    pending=db.execute('SELECT * FROM pending').fetchall()
                    require(len(pending)<=1,'HUFF_PENDING_COUNT')
                    parsed=None
                    if pending:
                        parsed={**dict(pending[0]),'raw':json.loads(pending[0]['raw'])}
                        require(parsed['awaiting'] is None,'HUFF_UNKNOWN_SOURCE_OUTCOME')
                        require(batch['id']==expected['batch'] and batch['worker']==expected['worker']
                                and parsed['sequence']==expected['sequence']==batch['start']+len(rows)
                                and digest(parsed['raw'])==expected['rawHash'],'HUFF_PENDING_CHANGED')
                        require(trial['status']=='halted' and trial['failure']=='PROTOCOL_VALIDATION_FAILED',
                                'HUFF_FAILURE_CHANGED')
                        if group=='primary':
                            require(adapter.next_request(parsed['raw'])=={'MSGID':'FREE_GAME'},'HUFF_NEXT_NOT_VERIFIED')
                            primary_batch_path=path
                        pending_count+=1
                    else:
                        require(trial['status']=='pending' and trial['failure'] in {None,'storage'},'HUFF_UNREVIEWED_FAILURE')
                    count+=len(rows);committed+=len(durable)
                    journals[str(batch['id'])]={'state':trial,'pendingHash':digest(parsed),'receiptsHash':digest(rows)}
                    databases[f'{group}/batches/{batch["id"]}/state.sqlite3']=db
                require(count==expected['complete'] and committed==expected['committed'] and pending_count==1,'HUFF_COUNT_CHANGED')
                snapshots[group]={'planHash':digest(plan),'control':control,'workers':workers,'batches':batches,'journals':journals,
                                  'complete':count,'committed':committed}
                for path in directory.rglob('*'):
                    if path.is_file() and not path.name.endswith(('.lock','.sqlite3','.sqlite3-wal','.sqlite3-shm')):
                        files[group+'/'+str(path.relative_to(directory)).replace('\\','/')]=path
                if group=='primary':primary_pool_path=pool_path
            file_hashes={k:hashlib.sha256(v.read_bytes()).hexdigest() for k,v in files.items()}
            source=Path(__file__).parent
            code_hash=digest({name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in
                             ('huff_group_recovery.py','huff_fields.py','huff_feature_review.py','round_fields.py','round_types.json','pool_trial.py')})
            snapshot={'queue':tables,'groups':snapshots,'files':file_hashes,'codeHash':code_hash}
            prepared={'review':REVIEW,'createdAt':clock(),'stateHash':digest(snapshot),'codeHash':code_hash}
            if not apply:return {**prepared,'applied':False,'primaryComplete':snapshots['primary']['complete'],
                                  'secondaryComplete':snapshots['secondary']['complete'],'next':'FREE_GAME'}
            require(proof and proof.get('review')==REVIEW and 0<=clock()-proof.get('createdAt',0)<=300,'HUFF_PROOF_EXPIRED')
            require(proof.get('stateHash')==prepared['stateHash'] and proof.get('codeHash')==code_hash,'HUFF_PROOF_CHANGED')
            backup.mkdir(parents=True,mode=0o700)
            for name,db in databases.items():
                path=backup/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700);backup_database(db,path)
            for name,source_path in files.items():
                path=backup/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
                with path.open('xb') as out:out.write(source_path.read_bytes());out.flush();os.fsync(out.fileno())
                path.chmod(0o600)
            save(backup/'before.json',snapshot)
            manifest={str(p.relative_to(backup)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in backup.rglob('*') if p.is_file()}
            for directory in sorted((p for p in backup.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):
                sync_dir(directory)
            save(backup/'manifest.json',manifest)
            event={'proof':proof,'snapshot':snapshot,'backupManifestHash':digest(manifest),'originalFailurePreserved':True,
                   'sourceRequests':0,'newSessions':0,'deletedRecords':0,'replayedBets':0}
            campaign.db.execute('CREATE TABLE IF NOT EXISTS group_protocol_reviews(id TEXT PRIMARY KEY,payload TEXT NOT NULL,applied INTEGER NOT NULL)')
            campaign.db.execute('INSERT INTO group_protocol_reviews VALUES(?,?,0)',(REVIEW,canonical(event).decode()))
            # Source stays globally closed until all batch/pool changes are
            # durable. A crash before the final queue transaction fails closed.
            with closing(sqlite3.connect(primary_batch_path,isolation_level=None)) as db:
                db.execute('PRAGMA synchronous=FULL')
                db.execute("UPDATE trial SET status='pending',failure=NULL WHERE id=1")
            with closing(sqlite3.connect(primary_pool_path,isolation_level=None)) as db:
                db.execute('PRAGMA synchronous=FULL')
                db.execute('UPDATE control SET failure=NULL,enabled=1 WHERE id=1')
            campaign.db.execute('BEGIN IMMEDIATE')
            try:
                campaign.db.execute('UPDATE dispatch_control SET enabled=1,reason=NULL WHERE id=1')
                campaign.db.execute("UPDATE group_control SET enabled=1,reason=NULL WHERE name='primary'")
                campaign.db.execute('UPDATE group_protocol_reviews SET applied=1 WHERE id=?',(REVIEW,))
                campaign.db.execute('COMMIT')
            except BaseException:
                campaign.db.execute('ROLLBACK');raise
            result={**prepared,'proofHash':digest(proof),'applied':True,'primaryEnabled':True,'secondaryEnabled':False,
                    'primaryComplete':snapshots['primary']['complete'],'secondaryComplete':snapshots['secondary']['complete'],
                    'next':'FREE_GAME','backupManifestHash':digest(manifest),'sourceRequests':0,'deletedRecords':0,'replayedBets':0}
            save(backup/'result.json',result)
            return result
    finally:campaign.close()
