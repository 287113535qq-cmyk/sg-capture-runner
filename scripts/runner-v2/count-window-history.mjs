import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger,auditCountBatch} from './complete-count.mjs';
// Reuse immutable historical readback proofs. Old Mongo rows are not claimed freshly read.
export function countHistoryBoundary({pool,plan,spec}){
 const ledger=checkLedger(pool,plan,spec);
 assert(ledger.reserved===0&&pool.enabled&&!pool.failure&&Object.values(pool.workers??{}).every(w=>!w.activeBatch&&w.leaseUntil<=Date.now()),'HISTORY_SOURCE_NOT_IDLE');
 const prefix=Array.from({length:pool.nextBatchId-1},(_,i)=>pool.countAllocation.batches[i+1]);
 assert(prefix.every(b=>b?.closed),'HISTORY_SOURCE_NOT_CLOSED');
 return {schema:'sg-count-history-boundary-v1',nextBatchId:pool.nextBatchId,nextSequence:pool.nextSequence,
  complete:pool.confirmed,ledgerHash:hash(prefix)};
}
export async function reviewHistoryPrefix({store,plan,pool,spec,permit}){
 const ledger=checkLedger(pool,plan,spec),h=permit?.historyBoundary;
 assert(permit?.schema==='sg-count-run-v1'&&/^\d+:1$/.test(permit.run??'')&&/^[a-f0-9]{40}$/.test(permit.commit??'')&&permit.profileHash===spec.profileHash,'HISTORY_SOURCE_BINDING');
 assert(ledger.reserved===0&&pool.enabled&&!pool.failure,'HISTORY_POOL_NOT_SETTLED');
 assert(h?.schema==='sg-count-history-boundary-v1'&&Number.isSafeInteger(h.nextBatchId)&&h.nextBatchId>spec.baselineBatchCount
  &&h.nextBatchId<=pool.nextBatchId&&Number.isSafeInteger(h.nextSequence)&&h.nextSequence>0
  &&permit.activation===spec.activation&&permit.completeBefore===h.complete,'HISTORY_PERMISSION');
 const prefix=Array.from({length:h.nextBatchId-1},(_,i)=>pool.countAllocation.batches[i+1]);
 assert(prefix.every(b=>b?.closed)&&hash(prefix)===h.ledgerHash&&(prefix.at(-1)?.end??0)+1===h.nextSequence,'HISTORY_PREFIX_CHANGED');
 const digest=createHash('sha256');let complete=0,pages=0;
 for(let first=1;first<h.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,h.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'HISTORY_BATCH_MISSING');
  const cache=new Map();rows.forEach((row,i)=>cache.set(`batch:${plan.trialId}:${ids[i]}`,row.value));
  const keys=ids.filter(id=>id>spec.baselineBatchCount).map(id=>pool.countAllocation.batches[id].settlementKey);
  assert(keys.every(k=>typeof k==='string'),'HISTORY_PROOF_REQUIRED');
  if(keys.length){const receipts=await store.getMany('journal',keys);assert(receipts.length===keys.length&&receipts.every(Boolean),'HISTORY_PROOF_MISSING');receipts.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));}
  for(const id of ids){const item=pool.countAllocation.batches[id],b=cache.get(`batch:${plan.trialId}:${id}`);
   assert(b&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil===0,'HISTORY_BATCH_CHANGED');
   await auditCountBatch({store,plan,pool,spec,record:{batchId:id},cache});
   complete+=item.complete;digest.update(hash([id,item.complete,item.evidenceHash])+'\n');
  }pages++;
 }
 assert(complete===h.complete,'HISTORY_COUNT_CHANGED');
 return {schema:'sg-window-history-reuse-review-v1',complete,after:h.nextSequence-1,batchCount:h.nextBatchId-1,
  ledgerHash:h.ledgerHash,sourcePermitHash:hash(permit),proofHash:digest.digest('hex'),pages,preservedReadbackReused:true,
  historicalReadbackFresh:false,rawRecordsRead:0,sourceRequests:0,databaseWrites:0};
}
