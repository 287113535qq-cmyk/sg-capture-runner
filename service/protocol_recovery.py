"""Operator-only, evidence-bound recovery of the reviewed 32651 protocol stop.

No source traffic, new session, quota edits, or new BETs. Original responses and
failure states are retained in an immutable review event before state changes.
The ordinary claim path flushes receipts and resumes the same pending round.
"""
import json
import time
from contextlib import ExitStack
from pathlib import Path
from campaign import Campaign
from pool_trial import PoolTrial
from store import require, digest, canonical, file_lock

REVIEW='squid-jackpot-32651-v1'


def verify_pending(store, expected):
    pending=store.pending()
    require(pending and pending['awaiting'] is None, 'RECOVERY_UNKNOWN_SOURCE_OUTCOME')
    require(digest(pending['raw'])==expected['rawHash'], 'RECOVERY_RAW_CHANGED')
    following=store.field_next(pending['raw'])
    require(following and following['MSGID']==expected['expectedNext'] and following['MSGID']!='BET',
            'RECOVERY_CONTINUATION_UNVERIFIED')
    return {'sequence':pending['sequence'],'rawHash':expected['rawHash'],'next':following}


def recover(root, proof, mongo_factory, apply=False, clock=time.time):
    require(proof['trialId']=='sg_r1_20260928_32651', 'RECOVERY_TRIAL_REQUIRED')
    campaign=Campaign(root)
    plan=campaign.plans['32651']
    pool=PoolTrial(root,plan,mongo_factory,clock)
    handles=[]
    try:
        with ExitStack() as locks:
            locks.enter_context(file_lock(campaign.directory/'selection.lock'))
            locks.enter_context(file_lock(pool.root/'protocol-review.lock'))
            state=campaign.status();control=dict(pool.pool.db.execute('SELECT * FROM control').fetchone())
            require(state['activeGame']==32651 and state['enabled'] is False
                    and state['reason']=='ACTIVE_GAME_REQUIRES_REVIEW', 'RECOVERY_CAMPAIGN_NOT_PAUSED')
            require(not control['enabled'] and control['failure']=='BATCH_HALTED','RECOVERY_POOL_NOT_PAUSED')
            require(campaign.disk_free()>=campaign.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
            workers=[dict(r) for r in pool.pool.db.execute('SELECT * FROM workers ORDER BY id')]
            require(all(w['lease_until']<=clock() for w in workers),'RECOVERY_ACTIVE_WORKERS')
            batches=[dict(r) for r in pool.pool.db.execute('SELECT * FROM batches ORDER BY id')]
            require({str(b['id']) for b in batches}==set(proof['batches']),'RECOVERY_BATCHES_CHANGED')
            checked=[];pending_checked=[];count=committed=0;halted=[]
            for batch in batches:
                spec={k:batch[k] for k in ('id','worker','start','end')}
                from trial_store import TrialStore
                store=TrialStore(root,mongo_factory((batch['start'],batch['end'])),clock,plan=plan,batch=spec)
                handles.append(store);locks.enter_context(file_lock(store.root/'trial.lock'))
                previous=dict(store.state());bound=proof['batches'][str(batch['id'])]
                require(previous['lease_until']<=clock() and previous['cooldown_until']<=clock(),'RECOVERY_ACTIVE_LEASE')
                require(previous['status'] in {'pending','halted'},'RECOVERY_UNEXPECTED_STATUS')
                require(previous['plan_hash']==bound['planHash'] and previous['session_hash']==bound['sessionHash'],
                        'RECOVERY_BINDING_CHANGED')
                worker=next(w for w in workers if w['id']==batch['worker'])
                require(worker['session_hash']==previous['session_hash'] and worker['active_batch']==batch['id'],
                        'RECOVERY_BINDING_CHANGED')
                rows=store.db.execute('SELECT payload,committed FROM receipts ORDER BY sequence').fetchall()
                records=[json.loads(r['payload']) for r in rows]
                require(digest(records)==bound['receiptsHash'],'RECOVERY_RECEIPTS_CHANGED')
                for record in records:
                    require(store.field_settled(record['raw'])==record['normalized']
                            and digest(record['raw'])==record['rawHash']
                            and digest(record['normalized'])==record['normalizedHash']
                            and digest({k:v for k,v in record.items() if k!='contentHash'})==record['contentHash'],
                            'RECOVERY_RECORD_MISMATCH')
                durable=[json.loads(r['payload']) for r in rows if r['committed']]
                if durable:require(store.mongo.verify(durable)==len(durable),'RECOVERY_MONGO_MISMATCH')
                count+=len(records);committed+=len(durable)
                pending=store.pending()
                if pending:
                    expected=proof['pending'].get(str(pending['sequence']))
                    require(expected and expected['batch']==batch['id'],'RECOVERY_UNEXPECTED_PENDING')
                    pending_checked.append(verify_pending(store,expected))
                if previous['status']=='halted':
                    require(previous['failure']=='PROTOCOL_VALIDATION_FAILED' and pending and pending['sequence']==424,
                            'RECOVERY_UNREVIEWED_FAILURE')
                    halted.append(batch['id'])
                else:require(previous['failure'] in {None,'storage'},'RECOVERY_UNREVIEWED_FAILURE')
                checked.append({'batch':spec,'previousState':previous,'receiptsHash':bound['receiptsHash']})
            require(count==proof['expectedComplete'] and committed==proof['expectedCommitted']
                    and len(pending_checked)==len(proof['pending']) and halted==[5], 'RECOVERY_COUNT_MISMATCH')
            event={'review':REVIEW,'at':clock(),'proofHash':digest(proof),'planHash':digest(plan),
                   'previousPool':control,'previousCampaign':state,'batches':checked,'pending':pending_checked,
                   'verifiedComplete':count,'mongoVerified':committed,'sourceRequests':0,'quotaChanges':0}
            if apply:
                db=pool.pool.db
                db.execute('CREATE TABLE IF NOT EXISTS protocol_reviews(id TEXT PRIMARY KEY,payload TEXT NOT NULL,applied INTEGER NOT NULL DEFAULT 0)')
                require(db.execute('SELECT 1 FROM protocol_reviews WHERE id=?',(REVIEW,)).fetchone() is None,
                        'RECOVERY_ALREADY_RECORDED')
                # First persist all original failures and bindings. If interrupted,
                # source gates stay closed and another review is required.
                db.execute('INSERT INTO protocol_reviews(id,payload) VALUES(?,?)',(REVIEW,canonical(event).decode()))
                for store in handles:
                    if store.batch['id'] in halted:
                        store.db.execute('CREATE TABLE IF NOT EXISTS protocol_reviews(id TEXT PRIMARY KEY,payload TEXT NOT NULL)')
                        store.db.execute('INSERT INTO protocol_reviews VALUES(?,?)',(REVIEW,canonical(event).decode()))
                        store.db.execute("UPDATE trial SET status='pending',failure=NULL WHERE id=1")
                db.execute('UPDATE control SET failure=NULL WHERE id=1')
                campaign.db.execute('UPDATE control SET reason=NULL WHERE id=1')
                db.execute('UPDATE protocol_reviews SET applied=1 WHERE id=?',(REVIEW,))
                # These two normal operator gates remain the sole enable path.
                pool.pool.enable_by_operator();campaign.enable_by_operator()
            return {'review':REVIEW,'proofHash':digest(proof),'applied':apply,'verifiedComplete':count,
                    'mongoVerified':committed,'pending':pending_checked,'sourceRequests':0,
                    'originalEvidencePreserved':True,'quotaChanges':0,'newSessions':0}
    finally:
        for store in handles:store.close()
        pool.close();campaign.close()
