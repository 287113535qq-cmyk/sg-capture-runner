import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewActionBudgetHistory} from './action-budget-history.mjs';
function fixture(){
 const trial='fixture',activation='a'.repeat(64),retirement='retired-count:fixture:proof',docs=new Map();
 const plan={trialId:trial,target:10};
 const batches=[1,2].map(id=>({id,worker:20,start:(id-1)*100+1,end:id*100,sessionHash:'b'.repeat(64),
  pending:null,checkpoint:(id-1)*100+1,journaled:(id-1)*100+1,leaseUntil:0}));
 const items=batches.map(b=>({...b,closed:true,complete:1,evidenceHash:hash(b)}));
 const receipt={schema:'sg-count-batch-settlement-v1',activation,trialId:trial,batch:batches[1],fullReadback:true};
 items[1].settlementKey='count-settlement:fixture:'+activation+':2';items[1].evidenceHash=hash(receipt);
 const spec={schema:'sg-complete-count-v1',trialId:trial,target:10,activation,maxSequence:1000,firstSequence:101,
  baselineBatchCount:1,baselineHash:hash([items[0]]),sessionRotation:'closed-batches-v1'};
 const native={schema:'sg-retired-count-result-v1',completePreserved:2,recordsHash:'c'.repeat(64),sourceRequests:0,newBetAllowance:0};
 const closed={schema:'sg-count-shared-close-v1',trialId:trial,activation,completePreserved:2,recordsHash:native.recordsHash,
  sourceRun:'1:1',sourceCommit:'d'.repeat(40),profileHash:'e'.repeat(64),retirementHash:hash(native),retirement,
  abandonedAttempts:5,unknownAttempts:0,requiresNewSession:true,sourceRequests:0,newBetAllowance:0};
 const pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',retiredCount:retirement,countSharedClosure:'closure',confirmed:2,
  nextBatchId:3,nextSequence:201,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:{1:items[0],2:items[1]}}};
 const profile={retirementHash:hash(closed),retirementKey:'closure:complete',completePreserved:2,recordsHash:native.recordsHash,
  sourceRun:closed.sourceRun,sourceCommit:closed.sourceCommit,closureProfileHash:closed.profileHash,nativeRetirementHash:hash(native)};
 for(const b of batches)docs.set('batch:fixture:'+b.id,{value:b});
 docs.set(items[1].settlementKey,{value:receipt});docs.set(retirement+':complete',{value:native});
 const store={get:async(c,k)=>docs.get(k),getMany:async(c,keys)=>{assert(keys.length<=100);return keys.map(k=>docs.get(k));}};
 return {store,plan,pool,spec,profile,closed,docs};
}
test('retirement proof reuse audits current metadata and never claims fresh record reads',async()=>{
 const f=fixture(),r=await reviewActionBudgetHistory(f);assert.equal(r.baseline.length,2);
 assert.equal(r.review.rawRecordsRead,0);assert.equal(r.review.historicalReadbackFresh,false);
 for(const kind of ['native','settlement','pending','legacy','lease','closure']){
  const x=fixture();
  if(kind==='native')x.docs.get(x.closed.retirement+':complete').value.recordsHash='f'.repeat(64);
  if(kind==='settlement')x.docs.get(x.pool.countAllocation.batches[2].settlementKey).value.fullReadback=false;
  if(kind==='pending')x.docs.get('batch:fixture:2').value.pending={};
  if(kind==='legacy')x.docs.get('batch:fixture:1').value.extra='changed';
  if(kind==='lease')x.pool.workers['20']={leaseUntil:Date.now()+60000,activeBatch:null};
  if(kind==='closure')x.closed.requiresNewSession=false;
  await assert.rejects(reviewActionBudgetHistory(x),undefined,kind);
 }
});
