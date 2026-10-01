"""Review one fixed ended parent failure; export numeric evidence only."""
import hashlib,io,json,sys,zipfile
EXPECTED='228dbb93491cd97660dd8de5dffb00953bb541ad0093e1ad25c8b61dbe4e4663'
def review(data):
    assert hashlib.sha256(data).hexdigest()==EXPECTED,'TAIL_LOG_IDENTITY'
    summaries={};performance={};errors=set()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert sum(i.file_size for i in z.infolist())<=256*1024*1024,'TAIL_LOG_BOUND'
        for name in z.namelist():
            if not name.endswith('.txt'):continue
            for line in z.read(name).decode('utf-8','replace').splitlines():
                at=line.find('{')
                if at<0:continue
                try:v=json.loads(line[at:])
                except ValueError:continue
                if not isinstance(v,dict):continue
                if v.get('error'):errors.add(v['error'])
                if v.get('gameId')!=32799:continue
                if v.get('outcome'):
                    worker=v['shardId'];assert worker not in summaries or summaries[worker]==v,'TAIL_CONFLICT'
                    summaries[worker]=v
                if v.get('schema')=='sg-capture-performance-v1' and v.get('reason')=='final':
                    worker=v['shardId'];assert worker not in performance or performance[worker]==v,'TAIL_CONFLICT'
                    performance[worker]=v
    workers=set(range(20))|set(range(40,60))
    assert set(summaries)==workers and set(performance)==workers,'TAIL_WORKER_MISSING'
    assert errors=={'ERR_ASSERTION'},'TAIL_OTHER_ERROR'
    assert all(v['outcome']=='success' and not v.get('error') for v in summaries.values()),'TAIL_CHILD_FAILURE'
    assert all(v['sourceErrors']==0 for v in performance.values()),'TAIL_SOURCE_ERROR'
    complete=sum(v['completedThisRun'] for v in performance.values())
    assert complete==10374 and complete==sum(v['completedThisRun'] for v in summaries.values()),'TAIL_COUNT'
    return dict(schema='sg-known-parent-tail-failure-v1',sourceRun='36835017232:1',sourceCommit='47f2a64680d021e244f8fe8f4500edd9c6742458',logSha256=EXPECTED,distinctWorkers=40,childComplete=complete,sourceErrors=0,parentError='CONCURRENT_PARENT_GATEWAY_READ',limitation='Requires independent settled pool and full record verification; grants no source allowance.')
if __name__=='__main__':print(json.dumps(review(sys.stdin.buffer.read()),sort_keys=True))
