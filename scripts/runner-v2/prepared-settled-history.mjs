import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger,auditCountBatch} from './complete-count.mjs';

// Reuse immutable full readbacks, while freshly checking every allocated range.
// This is a settled boundary review, not fresh Mongo or gameplay analysis.
export async function preparedSettledHistory({store,plan,pool,spec,now=Date.now}){
 const ledger=checkLedger(pool,plan,spec);
 assert(ledger.reserved===0&&Object.values(pool.workers??{}).every(w=>!w.activeBatch&&w.leaseUntil<=now()),
  'PREPARED_HISTORY_ACTIVE');
 let pages=0,complete=0;const ranges=[];
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'PREPARED_HISTORY_MISSING');
  const cache=new Map(rows.map((r,i)=>[`batch:${plan.trialId}:${ids[i]}`,r.value]));
  const keys=ids.filter(id=>id>spec.baselineBatchCount).map(id=>pool.countAllocation.batches[id]?.settlementKey);
  assert(keys.every(k=>typeof k==='string'),'PREPARED_HISTORY_SETTLEMENT');
  if(keys.length){
   const receipts=await store.getMany('journal',keys);
   assert(receipts.length===keys.length&&receipts.every(Boolean),'PREPARED_HISTORY_RECEIPT');
   receipts.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));
  }
  for(const id of ids){
   const b=cache.get(`batch:${plan.trialId}:${id}`),item=pool.countAllocation.batches[id];
   assert(item?.closed&&b&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now()
    &&(id<=spec.baselineBatchCount||!b.failure),'PREPARED_HISTORY_UNSETTLED');
   await auditCountBatch({store,pool,plan,spec,record:{batchId:id},cache});
   complete+=item.complete;ranges.push({id,batchHash:hash(b),evidenceHash:item.evidenceHash});
  }
  pages++;
 }
 assert(complete===pool.confirmed,'PREPARED_HISTORY_COUNT');
 return {schema:'sg-prepared-settled-history-v1',complete,pages,rangesHash:hash(ranges),
  preservedReadbackReused:true,historicalReadbackFresh:false,rawRecordsRead:0,sourceRequests:0};
}
