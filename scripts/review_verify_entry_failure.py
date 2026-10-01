"""Fixed ended verify-entry failure; child captures remain independently checked."""
import hashlib,io,json,sys,zipfile
EXPECTED='f94b062a08e35975e2a78da424ac787d986171a529f5e4a5e514dcbc757074a7'
def review(data):
    assert hashlib.sha256(data).hexdigest()==EXPECTED,'VERIFY_ENTRY_LOG_IDENTITY'
    summaries={};performance={};codes=[]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert sum(i.file_size for i in z.infolist())<=256*1024*1024,'VERIFY_ENTRY_LOG_BOUND'
        for name in z.namelist():
            if not name.endswith('.txt'):continue
            for line in z.read(name).decode('utf-8','replace').splitlines():
                if 'verify' in name.lower() and 'Error: COUNT_SESSION_WINDOW_PERMISSION' in line:codes.append('COUNT_SESSION_WINDOW_PERMISSION')
                at=line.find('{')
                if at<0:continue
                try:v=json.loads(line[at:])
                except ValueError:continue
                if not isinstance(v,dict) or v.get('gameId')!=32799:continue
                if v.get('outcome'):
                    worker=v['shardId'];assert worker not in summaries or summaries[worker]==v,'VERIFY_ENTRY_CONFLICT';summaries[worker]=v
                if v.get('schema')=='sg-capture-performance-v1' and v.get('reason')=='final':
                    worker=v['shardId'];assert worker not in performance or performance[worker]==v,'VERIFY_ENTRY_CONFLICT';performance[worker]=v
    workers=set(range(20))|set(range(40,60))
    assert set(summaries)==set(performance)==workers and codes,'VERIFY_ENTRY_CHILD_SCOPE'
    assert all(v['outcome']=='success' and not v.get('error') for v in summaries.values()),'VERIFY_ENTRY_CHILD_FAILURE'
    assert all(v['sourceErrors']==0 for v in performance.values()),'VERIFY_ENTRY_SOURCE_ERROR'
    count=sum(v['completedThisRun'] for v in performance.values())
    assert count==17028==sum(v['completedThisRun'] for v in summaries.values()),'VERIFY_ENTRY_COUNT'
    return dict(schema='sg-known-verify-entry-failure-v1',sourceRun='36839677352:1',sourceCommit='ca9ea3f9c5f00718ea496a44b33c2d1b857c3a96',logSha256=EXPECTED,distinctWorkers=40,childComplete=count,sourceErrors=0,verifyError='COUNT_SESSION_WINDOW_PERMISSION')
if __name__=='__main__':print(json.dumps(review(sys.stdin.buffer.read()),sort_keys=True))
