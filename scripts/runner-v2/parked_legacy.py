"""Pure offline/GitHub decoder for one frozen parked trial; no transport writes."""
import contextlib
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import sqlite3
import tempfile
from record_fields import execute
from store import digest


def convert_directory(base, plan, mongo_records, archive_hash, checked_at):
    def ro(p):
     c=sqlite3.connect(p.resolve().as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;return c
    with contextlib.closing(ro(base/'work-pool.sqlite3')) as c:
     control=dict(c.execute('select * from control').fetchone());workers=[dict(r) for r in c.execute('select * from workers')];batches=[dict(r) for r in c.execute('select * from batches order by id')]
    assert control['plan_hash']==hashlib.sha256(json.dumps({'trialId':plan['trialId'],'target':plan['target'],'workers':20,'version':1},sort_keys=True).encode()).hexdigest()
    assert 0 < len(batches) <= 100
    assert [b['id'] for b in batches]==list(range(1,len(batches)+1))
    assert all(w['lease_until']<checked_at for w in workers)
    assert len({w['id'] for w in workers}) == len(workers) and all(0 <= w['id'] < 20 for w in workers)
    assert all(0 <= b['worker'] < 20 and b['start'] == i*100+1 and b['end'] == (i+1)*100 for i,b in enumerate(batches))
    assert control['next_sequence'] == batches[-1]['end']+1
    ranges={b['id']:{k:b[k] for k in ['id','worker','start','end']} for b in batches}
    pool={'schema':'sg-github-pool-v2','enabled':False,'failure':'LEGACY_IMPORT_REQUIRES_RETIREMENT','planHash':digest(plan),'legacyArchiveHash':archive_hash,'nextSequence':control['next_sequence'],'nextBatchId':len(batches)+1,'confirmed':0,'legacyBatches':ranges,'workers':{str(w['id']):{'sessionHash':w['session_hash'],'owner':None,'epoch':w['epoch'],'leaseUntil':0,'activeBatch':ranges.get(w['active_batch'])} for w in workers}}
    states=[{'key':'pool:'+plan['trialId'],'value':pool}];records=[];pending=[];missing=[];matched=0;mongo={r['_id']:r for r in mongo_records};committed=0
    assert len(mongo) == len(mongo_records)
    for b in batches:
     with contextlib.closing(ro(base/'batches'/str(b['id'])/'state.sqlite3')) as c:
      state=dict(c.execute('select * from trial').fetchone());assert state['plan_hash']==digest({'plan':plan,'batch':ranges[b['id']]});assert state['lease_until']<checked_at
      rs=[]
      for row in c.execute('select * from receipts order by sequence'):
       r=json.loads(row['payload']);assert execute({'op':'verify','plan':plan,'raw':r['raw'],'record':r})=={'verified':True}
       assert r['sequence']==row['sequence']==b['start']+len(rs) and r['batchId']==b['id'] and r['shardId']==b['worker'] and r['sourceSessionHash']==state['session_hash'];rs.append(r);records.append(r)
       if r['_id'] in mongo:assert mongo[r['_id']]==r;matched+=1
       else:assert not row['committed'];missing.append(r['_id'])
       assert row['committed'] in (0,1) and (not row['committed'] or r['sequence'] <= state['checkpoint'])
       committed+=bool(row['committed'])
      q=c.execute('select * from pending').fetchone();q=None if q is None else dict(q)
      if q:q['raw']=json.loads(q['raw']);assert q['sequence']==b['start']+len(rs);pending.append({'batch':b['id'],**q})
      value={**ranges[b['id']],'owner':None,'epoch':state['epoch'],'leaseUntil':0,'sessionHash':state['session_hash'],'journaled':b['start']-1+len(rs),'checkpoint':state['checkpoint'],'legacyDurable':state['durable'],'pending':None,'pendingOriginal':q,'failure':'LEGACY_IMPORT_REQUIRES_RETIREMENT','legacyFailure':state['failure'],'legacyArchiveHash':archive_hash}
      assert b['start']-1<=value['checkpoint']<=value['journaled']<=b['end'];states.append({'key':f"batch:{plan['trialId']}:{b['id']}",'value':value})
    assert len(records) <= 1000
    assert len({r['_id'] for r in records})==len(records) and set(mongo)<=set(r['_id'] for r in records)

    return {"states":states,"records":records,"pending":pending,"committed":committed,"mongoMatched":matched,"missingMongo":missing,"archiveHash":archive_hash}


def decode_archive(data, plan, mongo_records, expected_hash, checked_at):
    import tarfile
    assert len(data) <= 40 * 1024 * 1024 and hashlib.sha256(data).hexdigest() == expected_hash
    assert plan['phase'] == 1 and plan['buy'] == 0 and len(mongo_records) <= 1000
    with tempfile.TemporaryDirectory(prefix='sg-parked-') as directory:
        base = Path(directory)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            members = archive.getmembers()
            assert 0 < len(members) <= 501 and sum(m.size for m in members) <= 40 * 1024 * 1024
            assert len({m.name for m in members}) == len(members)
            for member in members:
                name = member.name
                assert member.isfile() and not member.issym() and not member.islnk()
                assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
                assert re.fullmatch(r'(work-pool\.sqlite3(?:-wal)?|pool-plan\.json|batches/[1-9][0-9]*/(?:state\.sqlite3(?:-wal)?|[a-z-]+\.jsonl?))', name)
                target = base / name
                assert target.resolve().is_relative_to(base.resolve())
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as output:
                    output.write(archive.extractfile(member).read())
        return convert_directory(base, plan, mongo_records, expected_hash, checked_at)


if __name__ == '__main__':
    import base64
    import sys
    try:
        request = json.loads(sys.stdin.buffer.read(64 * 1024 * 1024 + 1))
        result = decode_archive(base64.b64decode(request['archive'], validate=True),
            request['plan'], request['rounds'], request['archiveHash'], request['checkedAt'])
        print(json.dumps({'ok': True, 'result': result}, separators=(',', ':')))
    except Exception:
        # Original records and connection/session fields must never enter logs.
        print(json.dumps({'ok': False, 'error': 'PARKED_LEGACY_INVALID'}))
        sys.exit(2)
