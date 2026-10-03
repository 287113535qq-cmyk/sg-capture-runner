"""Preserve an unsupported natural game, then make its group available again.

No source calls, replay, deletion or restoration. Only an operator-installed
policy enables this path. Unknown source results and non-protocol faults stop
the campaign instead. Caller holds selection.lock before inspection/parking.
"""
from contextlib import ExitStack, closing
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import xml.etree.ElementTree as ET

from pending_discard import backup_database
from round_fields import FieldError, params, amount
from store import canonical, digest, require, file_lock, sync_dir

POLICY={'schema':'sg-protocol-parking-v1','campaignId':'sg_round_one_20260928',
        'preserveOwner':True,'resumeParkedAutomatically':False,'unknownOutcome':'stop-all'}
UNSUPPORTED={'UNKNOWN_TRIAL_FEATURE','HUFF_FEATURE_NOT_ADAPTED',
             'HUFF_UNKNOWN_FEATURE_ID','HUFF_UNREVIEWED_FEATURE_PROTOCOL',
             'HUFF_ACTION_UNREVIEWED_ROUTE','HUFF_ACTION_UNREVIEWED_TRANSITION','HUFF_ACTION_UNREVIEWED_EXIT'}


def enabled(c):
    if not c.db.execute("SELECT 1 FROM sqlite_master WHERE name='parking_policy'").fetchone():return False
    row=c.db.execute('SELECT payload FROM parking_policy WHERE id=1').fetchone()
    if row is None:return False
    require(json.loads(row[0])==POLICY,'PARKING_POLICY_CHANGED')
    return True


def readonly(path):
    db=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
    db.row_factory=sqlite3.Row
    return db


def write(path,data):
    with path.open('xb') as stream:
        stream.write(data);stream.flush();os.fsync(stream.fileno())
    path.chmod(0o600);sync_dir(path.parent)


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda:stream.read(1024*1024),b''):h.update(data)
    return h.hexdigest()


def adapter(plan):
    from native_nextgen_fields import NativeNextgenFields
    from huff_fields import HuffFields,SOURCE as HUFF
    from squid_fields import SquidFields,SOURCE as SQUID
    return ({HUFF:HuffFields,SQUID:SquidFields}.get(plan['sourceKey'],NativeNextgenFields))(plan)


def successful_chain(plan,raw):
    """Independently validate the envelope before treating an unknown ID as a hold."""
    require(raw.get('sourceKey')==plan['sourceKey'] and raw.get('protocol')=='nextgen'
            and raw.get('fixtureOnly') is False,'PARKING_RAW_PROFILE')
    steps=raw.get('steps');require(isinstance(steps,list) and 0<len(steps)<=plan['maxSteps'],'PARKING_RAW_STEPS')
    pid=None;fields=adapter(plan)
    for index,step in enumerate(steps):
        msg=step.get('msgId');require(msg==('BET' if index==0 else 'FREE_GAME'),'PARKING_UNREVIEWED_MESSAGE')
        request=fields.request_params(step['requestPayload'],msg)
        require(pid is None or pid==request['PID'],'PARKING_SESSION_CHANGED');pid=request['PID']
        payload=params(step['responsePayload']);text=step['responseXml']
        require(isinstance(text,str) and len(text)<262144 and '<!DOCTYPE' not in text.upper()
                and '<!ENTITY' not in text.upper(),'PARKING_XML_REJECTED')
        xml=ET.fromstring(text)
        require(xml.tag.upper()=='GDMRESPONSE' and str(xml.findtext('SUCCESS')).lower()=='true'
                and xml.findtext('PAYLOAD')==step['responsePayload'] and payload.get('MSGID')==msg,
                'PARKING_SOURCE_NOT_SUCCESSFUL')
        for key in ('B','AB','TW'):amount(payload.get(key))
        require(payload.get('IFG') in {'0','1'} and (msg!='FREE_GAME' or payload['IFG']=='1'),
                'PARKING_BAD_FREE_STATE')
    return fields


def inspect(c,locks):
    state=dict(c._state());gid=state['active_game']
    require(gid is not None and not state['enabled'] and state['reason']=='ACTIVE_GAME_REQUIRES_REVIEW'
            and state['audit_until']<=c.clock(),'PARKING_GROUP_NOT_PAUSED')
    require(c.db.execute('SELECT enabled FROM dispatch_control').fetchone()[0], 'PARKING_GLOBAL_STOP')
    require(c.disk_free()>=c.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
    plan=c.plans[str(gid)];directory=c.root/'trials'/plan['trialId']
    require(c.db.execute('SELECT group_name FROM game_owners WHERE game_id=?',(gid,)).fetchone()[0]==c.runner_group,
            'PARKING_OWNER_CHANGED')
    game=dict(c.db.execute('SELECT * FROM games WHERE game_id=?',(gid,)).fetchone())
    require(game['status']=='active' and game['completed'] is None,'PARKING_GAME_STATE')
    require(json.loads((directory/'pool-plan.json').read_text())==plan,'PARKING_PLAN_CHANGED')
    locks.enter_context(file_lock(directory/'pool-init.lock'))
    locks.enter_context(file_lock(directory/'protocol-review.lock'))
    pool=locks.enter_context(closing(readonly(directory/'work-pool.sqlite3')))
    require(tuple(pool.execute('SELECT enabled,failure FROM control').fetchone())==(0,'BATCH_HALTED'),'PARKING_POOL_FAILURE')
    workers=[dict(r) for r in pool.execute('SELECT * FROM workers ORDER BY id')]
    require(all((0<=w['id']<20 if c.runner_group=='primary' else 20<=w['id']<40) for w in workers),'PARKING_WORKER_GROUP')
    if any(w['lease_until']>c.clock() for w in workers):return None
    databases={'work-pool.sqlite3':directory/'work-pool.sqlite3'};journals={};pending=[];complete=committed=0;unsupported=0
    for batch in pool.execute('SELECT * FROM batches ORDER BY id'):
        folder=directory/'batches'/str(batch['id']);path=folder/'state.sqlite3'
        require(path.exists(),'PARKING_MISSING_BATCH')
        # All worker leases have drained and the pool is halted. No legal
        # writer can renew a batch; inspect journals one at a time so a late
        # feature after thousands of batches does not exhaust file handles.
        db=readonly(path)
        try:
            journal=read_journal(c,plan,batch,db,workers)
        finally:db.close()
        if journal is None:return None
        trial,n,written,p,code,rows_hash=journal
        if trial['failure']=='PROTOCOL_VALIDATION_FAILED':unsupported+=1
        if p:
            pending.append({'batch':batch['id'],'worker':batch['worker'],'sequence':p['sequence'],
                            'rawHash':digest(p['raw']),'pendingHash':digest(p),'reason':code})
        complete+=n;committed+=written
        journals[str(batch['id'])]={'state':trial,'receiptsHash':rows_hash,'complete':n,'committed':written,
                                   'pendingHash':digest(p)}
        databases['batches/'+str(batch['id'])+'/state.sqlite3']=path
    require(unsupported>0,'PARKING_NO_PROTOCOL_EVIDENCE')
    files={str(p.relative_to(directory)).replace('\\','/'):p for p in directory.rglob('*')
           if p.is_file() and not p.name.endswith(('.lock','.sqlite3','.sqlite3-wal','.sqlite3-shm'))}
    snapshot={'group':state,'game':game,'planHash':digest(plan),'workers':workers,
              'pool':dict(pool.execute('SELECT * FROM control').fetchone()),
              'batches':[dict(r) for r in pool.execute('SELECT * FROM batches ORDER BY id')],
              'journals':journals,'files':{k:sha(p) for k,p in files.items()},'pending':pending,
              'complete':complete,'committed':committed}
    return snapshot,databases,files


def read_journal(c,plan,batch,db,workers):
    trial=dict(db.execute('SELECT * FROM trial').fetchone())
    if trial['lease_until']>c.clock():return None
    require(trial['cooldown_until']<=c.clock(),'PARKING_SOURCE_COOLDOWN')
    spec={k:batch[k] for k in ('id','worker','start','end')}
    require(trial['plan_hash']==digest({'plan':plan,'batch':spec}),'PARKING_BATCH_PLAN')
    worker=next((w for w in workers if w['id']==batch['worker']),None)
    require(worker and trial['session_hash']==worker['session_hash'],'PARKING_SESSION_BINDING')
    require(trial['failure'] in {None,'storage','PROTOCOL_VALIDATION_FAILED'},'PARKING_NON_PROTOCOL_FAILURE')
    require(trial['status']!='halted' or trial['failure']=='PROTOCOL_VALIDATION_FAILED','PARKING_NON_PROTOCOL_HALT')
    rows=hashlib.sha256();n=written=0
    for row in db.execute('SELECT * FROM receipts ORDER BY sequence'):
        require(row['sequence']==batch['start']+n and row['filed']==row['committed'],'PARKING_RECEIPT_BOUNDARY')
        rows.update(canonical(dict(row))+b'\n');n+=1;written+=row['committed']
    require(trial['durable']==trial['checkpoint']==batch['start']-1+written,'PARKING_CHECKPOINT')
    p=db.execute('SELECT * FROM pending').fetchone()
    if p:
        p={**dict(p),'raw':json.loads(p['raw'])}
        require(p['awaiting'] is None,'PARKING_UNKNOWN_SOURCE_OUTCOME')
        require(p['sequence']==batch['start']+n,'PARKING_PENDING_SEQUENCE')
        fields=successful_chain(plan,p['raw']);code=None
        try:
            if fields.next_request(p['raw']) is None:fields.settled(p['raw'])
        except FieldError as error:code=str(error)
        if trial['failure']=='PROTOCOL_VALIDATION_FAILED':
            require(code in UNSUPPORTED,'PARKING_NOT_UNSUPPORTED_FEATURE')
        else:require(code is None or code in UNSUPPORTED,'PARKING_UNREVIEWED_PENDING')
    else:require(trial['failure']!='PROTOCOL_VALIDATION_FAILED','PARKING_MISSING_FAILURE_EVIDENCE')
    return trial,n,written,p,code if p else None,rows.hexdigest()


def backup(c,review,destination):
    snapshot,databases,files=review
    size=sum(p.stat().st_size for p in files.values())
    size+=sum(p.stat().st_size+(p.with_name(p.name+'-wal').stat().st_size if p.with_name(p.name+'-wal').exists() else 0) for p in databases.values())
    require(c.disk_free()-size>=c.config['diskReserveBytes'],'DISK_RESERVE_REACHED')
    destination.mkdir(parents=True,mode=0o700)
    backup_database(c.db,destination/'queue-before.sqlite3')
    for name,source in databases.items():
        path=destination/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with closing(readonly(source)) as db:backup_database(db,path)
    for name,src in files.items():
        path=destination/name;path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with src.open('rb') as source,path.open('xb') as out:
            for data in iter(lambda:source.read(1024*1024),b''):out.write(data)
            out.flush();os.fsync(out.fileno())
        path.chmod(0o600)
        require(sha(path)==snapshot['files'][name],'PARKING_COPY_CHANGED')
    write(destination/'evidence.json',canonical(snapshot))
    manifest={str(p.relative_to(destination)).replace('\\','/'):sha(p) for p in destination.rglob('*') if p.is_file()}
    for directory in sorted((p for p in destination.rglob('*') if p.is_dir()),key=lambda p:len(p.parts),reverse=True):sync_dir(directory)
    write(destination/'manifest.json',canonical(manifest))
    return {'evidenceHash':digest(snapshot),'manifestHash':digest(manifest),'backup':str(destination),
            'gameId':snapshot['game']['game_id'],'runnerGroup':c.runner_group,
            'completePreserved':snapshot['complete'],'committedPreserved':snapshot['committed'],
            'pendingPreserved':len(snapshot['pending']),'planHash':snapshot['planHash'],
            'deletedRecords':0,'replayedBets':0,'countedAsComplete':False}


def install_tables(c):
    c.db.execute('CREATE TABLE IF NOT EXISTS parking_policy(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT NOT NULL,proof TEXT NOT NULL)')
    c.db.execute('CREATE TABLE IF NOT EXISTS parked_games(game_id INTEGER PRIMARY KEY,group_name TEXT NOT NULL,'
                 'evidence_hash TEXT NOT NULL,payload TEXT NOT NULL,created REAL NOT NULL)')


def commit_park(c,result):
    gid=result['gameId']
    require(c._state()['active_game']==gid,'PARKING_ACTIVE_GAME_CHANGED')
    require(c.db.execute('SELECT enabled FROM dispatch_control').fetchone()[0],'PARKING_GLOBAL_STOP')
    c.db.execute('INSERT INTO parked_games VALUES(?,?,?,?,?)',
                 (gid,c.runner_group,result['evidenceHash'],canonical(result).decode(),c.clock()))
    c.db.execute("UPDATE games SET status='parked-protocol' WHERE game_id=? AND status='active'",(gid,))
    c._update('enabled=1,active_game=NULL,reason=NULL,audit_owner=NULL,audit_until=0')


def park(c):
    require(enabled(c),'PARKING_NOT_ENABLED')
    with ExitStack() as locks:
        review=inspect(c,locks)
        if review is None:return False
        gid=review[0]['game']['game_id'];key=digest(review[0])
        dest=c.root/'reviews'/('parked-'+str(gid)+'-'+key[:20])
        if dest.exists():
            # A crash after backup but before queue commit must never bypass
            # verification or erase the preserved attempt; operator review.
            require(False,'PARKING_INCOMPLETE_TRANSACTION')
        result=backup(c,review,dest)
        c.db.execute('BEGIN IMMEDIATE')
        try:commit_park(c,result);c.db.execute('COMMIT')
        except BaseException:c.db.execute('ROLLBACK');raise
        write(dest/'result.json',canonical(result));return True
