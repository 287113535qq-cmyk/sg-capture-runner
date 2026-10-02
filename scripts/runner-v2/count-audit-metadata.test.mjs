import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countAuditMetadata} from './count-audit-metadata.mjs';
function fixture(){
 const plan={trialId:'trial'},spec={activation:'a',maxSequence:30000,baselineBatchCount:1,sessionRotation:'closed-batches-v1'},pool={nextBatchId:202,countAllocation:{batches:{}}},docs=new Map(),calls=[];
 for(let id=1;id<=201;id++){
  const start=(id-1)*100+1,batch={id,worker:20,start,end:start+99,sessionHash:'session',pending:null,bootstrapAwaiting:null,checkpoint:start+99,journaled:start+99};
  const key=`count-settlement:trial:a:${id}`,receipt={schema:'sg-count-batch-settlement-v1',activation:'a',trialId:'trial',batch,fullReadback:true};
  pool.countAllocation.batches[id]={id,worker:20,start,end:batch.end,sessionHash:'session',complete:100,closed:true,evidenceHash:hash(id===1?batch:receipt),...(id===1?{}:{settlementKey:key})};
  docs.set('state/batch:trial:'+id,batch);if(id>1)docs.set('journal/'+key,receipt);
 }
 const store={get:async(c,k)=>{throw Error('UNBATCHED_READ');},getMany:async(c,keys)=>{assert(keys.length<=100&&new Set(keys).size===keys.length);calls.push([c,keys.length]);return keys.map(k=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null);}};
 const record=(id,offset=0)=>({trialId:'trial',buy:0,fixtureOnly:false,batchId:id,sequence:(id-1)*100+1+offset,shardId:20,sourceSessionHash:'session'});
 return {plan,spec,pool,docs,calls,store,record};
}
test('one audit reads 201 closed batches in bounded blocks and checks all 20100 record allocations',async()=>{
 const f=fixture(),review=countAuditMetadata(f),before=hash([...f.docs]);
 for(let id=1;id<=201;id++)for(let i=0;i<100;i++)await review(f.record(id,i));
 assert.deepEqual(f.calls,[['state',100],['journal',99],['state',100],['journal',100],['state',1],['journal',1]]);
 assert.equal(hash([...f.docs]),before);
 assert.equal(review.summary().allocatedRecords,20100);assert.equal(review.summary().verifiedBatches,201);assert.equal(review.summary().bulkReads,6);
 // Reusing a batch proof never bypasses per-record session, sequence or buy checks.
 for(const bad of [{...f.record(1),sourceSessionHash:'wrong'},{...f.record(1),sequence:101},{...f.record(1),buy:1}])await assert.rejects(review(bad));
});
test('missing metadata, changed closed receipt or batch blocks audit without writes',async()=>{
 for(const change of [f=>f.docs.delete('state/batch:trial:2'),f=>f.docs.delete('journal/count-settlement:trial:a:2'),f=>f.docs.get('journal/count-settlement:trial:a:2').fullReadback=false,f=>f.docs.get('state/batch:trial:2').checkpoint--,f=>f.pool.countAllocation.batches[2].closed=false]){
  const f=fixture();change(f);const before=hash([...f.docs]);await assert.rejects(countAuditMetadata(f)(f.record(2)));assert.equal(hash([...f.docs]),before);
 }
});
