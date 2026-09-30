"""Read GitHub log ZIP bytes; emit only zero-source worker evidence."""
import hashlib,io,json,re,sys,zipfile
rows=[]
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    for name in z.namelist():
        m=re.fullmatch(r'fresh-capture-(\d+)/\d+_Capture complete rounds with independent sessions.txt',name)
        if not m:continue
        data=z.read(name);found=[]
        for line in data.decode('utf-8').splitlines():
            at=line.find('{"schema":"sg-work-pool-v1"')
            if at>=0:found.append(json.loads(line[at:]))
        assert len(found)==1
        v=found[0];assert v['shardId']==int(m[1])
        row={k:v[k] for k in ('shardId','trialId','gameId','runtimeGameId','sourceRequests','paidRoundRequests','completedThisRun','error')}
        assert row['sourceRequests']==row['paidRoundRequests']==row['completedThisRun']==0 and row['error']=='ERR_ASSERTION'
        row['logHash']=hashlib.sha256(data).hexdigest();rows.append(row)
assert sorted(r['shardId'] for r in rows)==list(range(20))
print(json.dumps(sorted(rows,key=lambda r:r['shardId']),separators=(',',':')))
