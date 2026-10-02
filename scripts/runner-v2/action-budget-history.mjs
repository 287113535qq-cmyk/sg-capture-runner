import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger,auditCountBatch} from './complete-count.mjs';

// Immutable full readback may be reused; current batches and settlements must
// still be freshly read. This never claims fresh Mongo or Python verification.
export async function reviewActionBudgetHistory({store,plan,pool,spec,profile,closed,now=Date.now}){
 assert(hash(closed)===profile.retirementHash&&closed.schema==='sg-count-shared-close-v1'
  &&closed.trialId===plan.trialId&&closed.activation===spec.activation
  &&closed.completePreserved===profile.completePreserved&&closed.recordsHash===profile.recordsHash
  &&closed.sourceRun===profile.sourceRun&&closed.sourceCommit===profile.sourceCommit
  &&closed.profileHash===profile.closureProfileHash&&closed.retirementHash===profile.nativeRetirementHash
  &&closed.abandonedAttempts===(profile.schema==='sg-formal-direct-action-profile-v2'?3:profile.schema==='sg-formal-direct-action-profile-v1'?1:5)&&closed.unknownAttempts===0&&closed.requiresNewSession===true
  &&closed.sourceRequests===0&&closed.newBetAllowance===0,'ACTION_BUDGET_CLOSURE');
 assert(!pool.enabled&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.retiredCount===closed.retirement
  &&pool.countSharedClosure+':complete'===profile.retirementKey,'ACTION_BUDGET_CLOSED_POOL');
 const native=(await store.get('journal',closed.retirement+':complete'))?.value;
 assert(native?.schema==='sg-retired-count-result-v1'&&hash(native)===closed.retirementHash
  &&native.completePreserved===closed.completePreserved&&native.recordsHash===closed.recordsHash
  &&native.sourceRequests===0&&native.newBetAllowance===0,'ACTION_BUDGET_NATIVE_RETIREMENT');
 assert(checkLedger(pool,plan,spec).reserved===0&&pool.confirmed===closed.completePreserved
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'ACTION_BUDGET_UNSETTLED');
 const baseline=[];let complete=0,pages=0;
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'ACTION_BUDGET_HISTORY_MISSING');
  const cache=new Map(rows.map((r,i)=>[`batch:${plan.trialId}:${ids[i]}`,r.value]));
  const keys=ids.filter(id=>id>spec.baselineBatchCount).map(id=>pool.countAllocation.batches[id]?.settlementKey);
  assert(keys.every(k=>typeof k==='string'),'ACTION_BUDGET_SETTLEMENT_REQUIRED');
  if(keys.length){const receipts=await store.getMany('journal',keys);
   assert(receipts.length===keys.length&&receipts.every(Boolean),'ACTION_BUDGET_SETTLEMENT_MISSING');
   receipts.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));}
  for(const id of ids){const b=cache.get(`batch:${plan.trialId}:${id}`),item=pool.countAllocation.batches[id];
   assert(item?.closed&&b&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now(),'ACTION_BUDGET_HISTORY_UNSAFE');
   await auditCountBatch({store,pool,plan,spec,record:{batchId:id},cache});
   complete+=item.complete;baseline.push({id:b.id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,
    closed:true,complete:item.complete,evidenceHash:hash(b)});
  }pages++;
 }
 assert(complete===profile.completePreserved,'ACTION_BUDGET_HISTORY_COUNT');
 return {baseline,review:{schema:'sg-action-budget-history-review-v1',complete,pages,baselineHash:hash(baseline),
  closureHash:hash(closed),nativeRetirementHash:hash(native),recordsHash:closed.recordsHash,
  preservedReadbackReused:true,historicalReadbackFresh:false,rawRecordsRead:0,sourceRequests:0}};
}
