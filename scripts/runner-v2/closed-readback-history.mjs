import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger,auditCountBatch} from './complete-count.mjs';

// Reuse only independently frozen full-readback receipts. This does not read
// or reinterpret raw records, and open/unknown batches are never included.
export async function reviewClosedReadbacks({store,plan,pool,spec,now=Date.now}){
 checkLedger(pool,plan,spec);
 let complete=0;const ranges=[];
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'CLOSED_READBACK_MISSING');
  const cache=new Map(rows.map((r,i)=>[`batch:${plan.trialId}:${ids[i]}`,r.value]));
  const keys=ids.filter(id=>pool.countAllocation.batches[id]?.closed&&id>spec.baselineBatchCount)
   .map(id=>pool.countAllocation.batches[id].settlementKey);
  assert(keys.every(k=>typeof k==='string'),'CLOSED_READBACK_KEY');
  if(keys.length){const receipts=await store.getMany('journal',keys);
   assert(receipts.length===keys.length&&receipts.every(Boolean),'CLOSED_READBACK_RECEIPT');
   receipts.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));}
  for(const id of ids){
   const item=pool.countAllocation.batches[id],b=cache.get(`batch:${plan.trialId}:${id}`);
   if(!item.closed)continue;
   assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now()
    &&(id<=spec.baselineBatchCount||!b.failure),'CLOSED_READBACK_UNSETTLED');
   await auditCountBatch({store,plan,pool,spec,record:{batchId:id},cache});
   complete+=item.complete;ranges.push({id,batchHash:hash(b),evidenceHash:item.evidenceHash});
  }
 }
 assert(complete===pool.confirmed,'CLOSED_READBACK_COUNT');
 return {schema:'sg-closed-readback-history-v1',complete,batchCount:ranges.length,
  rangesHash:hash(ranges),fullReadbacksReused:true,rawRecordsRead:0,sourceRequests:0};
}

export function reviewFrozenSettlement({receipt,batch,item,plan,spec}){
 assert(!item.closed&&receipt?.schema==='sg-count-batch-settlement-v1'
  &&receipt.activation===spec.activation&&receipt.trialId===plan.trialId&&receipt.fullReadback===true
  &&hash(receipt.batch)===hash(batch)&&!batch.pending&&!batch.pendingOriginal&&!batch.bootstrapAwaiting
  &&!batch.failure&&batch.leaseUntil===0&&batch.checkpoint===batch.journaled
  &&batch.id===item.id&&batch.worker===item.worker&&batch.sessionHash===item.sessionHash
  &&batch.start===item.start&&batch.end===item.end,'FROZEN_SETTLEMENT_CHANGED');
 return receipt;
}
