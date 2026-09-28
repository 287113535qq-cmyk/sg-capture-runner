"""Read frozen SQLite and verify historical fields on a GitHub Runner only."""
import contextlib
import json
import os
import pathlib
import sqlite3
import sys
from record_fields import execute
from store import digest


def emit(value):
    print(json.dumps(value, separators=(',', ':')), flush=True)


def ro(path):
    c=sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True,timeout=3)
    c.row_factory=sqlite3.Row
    return c


def assigned_games(games, owners):
    assert len(games)==178 and len({x['game_id'] for x in games})==178
    assert sum(x['status']=='complete' for x in games)==6
    assert set(owners)<=set(x['game_id'] for x in games)
    assert all(x in ('primary','secondary') for x in owners.values())
    owners=dict(owners)
    unowned=sorted(x['game_id'] for x in games if x['game_id'] not in owners)
    owners.update({g:('primary' if i%2==0 else 'secondary') for i,g in enumerate(unowned)})
    return owners


def import_snapshot(directory,group,emit=emit):
    assert group in ('primary','secondary')
    cfg=json.loads(pathlib.Path('config/github-migration-v2.json').read_text())
    plans=json.loads(pathlib.Path('config/round-one-plans.json').read_text())
    gid=cfg['groups'][group];plan=plans[str(gid)];trial=plan['trialId']
    with contextlib.closing(ro(directory/'queue-before.sqlite3')) as c:
        games=[dict(x) for x in c.execute('SELECT * FROM games ORDER BY game_id')]
        owners={x['game_id']:x['group_name'] for x in c.execute('SELECT * FROM game_owners')}
        groups=[dict(x) for x in c.execute('SELECT * FROM group_control')]
    # Existing ownership always wins. Remaining games get one deterministic
    # owner, calculated on GitHub; no duplicate campaign target is created.
    owners=assigned_games(games,owners)
    active=next(x for x in groups if x['name']==group)
    assert active['active_game']==gid and owners[gid]==group
    emit({'kind':'state','key':'campaign','value':{'schema':'sg-github-campaign-v2','group':group,
          'migration':cfg['manifestHash'],'enabled':False,'reason':'LEGACY_STORAGE_REVIEW_REQUIRED',
          'activeGame':gid,'configHash':active['config_hash'],
          'games':[x for x in games if owners[x['game_id']]==group]}})
    with contextlib.closing(ro(directory/trial/'work-pool.sqlite3')) as c:
        control=dict(c.execute('SELECT * FROM control').fetchone())
        batches=[dict(x) for x in c.execute('SELECT * FROM batches ORDER BY id')]
        workers=[dict(x) for x in c.execute('SELECT * FROM workers ORDER BY id')]
    assert control['plan_hash']==digest(plan)
    assert all(w['lease_until']<__import__('time').time() for w in workers)
    ranges={x['id']:{k:x[k] for k in ('id','worker','start','end')} for x in batches}
    emit({'kind':'state','key':'pool:'+trial,'value':{'schema':'sg-github-pool-v2','migration':cfg['manifestHash'],
          'enabled':False,'failure':'LEGACY_STORAGE_REVIEW_REQUIRED','planHash':control['plan_hash'],
          'nextSequence':control['next_sequence'],'nextBatchId':max(ranges,default=0)+1,'confirmed':0,
          'legacyBatches':ranges,'workers':{str(w['id']):{'sessionHash':w['session_hash'],'owner':None,
           'epoch':w['epoch'],'leaseUntil':0,'activeBatch':ranges.get(w['active_batch'])} for w in workers}}})
    complete=committed=pending=unknown=0
    pending_hashes=[]
    for batch in batches:
        path=directory/trial/'batches'/str(batch['id'])/'state.sqlite3'
        if not path.exists():
            continue
        with contextlib.closing(ro(path)) as c:
            state=dict(c.execute('SELECT * FROM trial').fetchone())
            pending_row=c.execute('SELECT * FROM pending').fetchone()
            pending_doc=None if pending_row is None else dict(pending_row)
            if pending_doc:
                pending_doc['raw']=json.loads(pending_doc['raw']);pending+=1
                unknown+=int(pending_doc['awaiting'] is not None)
            assert state['lease_until']<__import__('time').time()
            count=c.execute('SELECT COUNT(*) FROM receipts').fetchone()[0]
            value={**ranges[batch['id']],'migration':cfg['manifestHash'],'owner':None,'epoch':state['epoch'],
                   'leaseUntil':0,'sessionHash':state['session_hash'],'journaled':batch['start']-1+count,
                   'checkpoint':state['checkpoint'],'legacyDurable':state['durable'],
                   'pendingOriginal':pending_doc,'failure':'LEGACY_STORAGE_REVIEW_REQUIRED',
                   'legacyFailure':state['failure'],'legacyComplete':batch['completed'] is not None}
            if pending_doc:
                pending_hashes.append({'batchId':batch['id'],'worker':batch['worker'],
                    'sequence':pending_doc['sequence'],'pendingHash':digest(pending_doc)})
            emit({'kind':'state','key':f'batch:{trial}:{batch["id"]}','value':value})
            chunk=[];expected_sequence=batch['start']
            for row in c.execute('SELECT sequence,payload,committed FROM receipts ORDER BY sequence'):
                record=json.loads(row['payload'])
                assert record['sequence']==row['sequence'] and record['batchId']==batch['id']
                assert row['sequence']==expected_sequence and row['sequence']<=batch['end']
                expected_sequence+=1
                execute({'op':'verify','plan':plan,'raw':record['raw'],'record':record})
                chunk.append({'record':record,'committed':bool(row['committed'])})
                complete+=1;committed+=int(row['committed'])
                if len(chunk)==100:
                    emit({'kind':'records','rows':chunk});chunk=[]
            if chunk:emit({'kind':'records','rows':chunk})
    emit({'kind':'summary','trialId':trial,'gameId':gid,'complete':complete,'committed':committed,
          'pending':pending,'unknownIntents':unknown,'pendingEvidence':pending_hashes,
          'sourceRequests':0,'oldRecordsChanged':0})


def main():
    assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
    import_snapshot(pathlib.Path(sys.argv[1]),sys.argv[2])


if __name__=='__main__':
    try:main()
    except Exception:
        print('Frozen migration validation failed; private payload suppressed',file=sys.stderr)
        sys.exit(2)
