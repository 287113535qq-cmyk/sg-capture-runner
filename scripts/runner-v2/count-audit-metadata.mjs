import assert from 'node:assert/strict';
import {auditAllocatedRecord,auditCountBatch} from './complete-count.mjs';

// This cache belongs to one final audit of an idle pool. It contains batch
// evidence, never a mutable source permission or a resource allowed flag.
export function countAuditMetadata({store,plan,pool,spec}){
 const cache=new Map(),loaded=new Set(),verified=new Set(),started=performance.now();let allocatedRecords=0,bulkReads=0;
 const review=async record=>{
  auditAllocatedRecord({pool,plan,spec,record});
  allocatedRecords++;
  if(verified.has(record.batchId))return;
  const first=1+100*Math.floor((record.batchId-1)/100);
  if(typeof store.getMany==='function'&&!loaded.has(first)){
   const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
   assert(ids.length>0&&ids.includes(record.batchId),'COUNT_AUDIT_METADATA_RANGE');
   const batchKeys=ids.map(id=>`batch:${plan.trialId}:${id}`);bulkReads++;const rows=await store.getMany('state',batchKeys);
   assert(rows.length===ids.length&&rows.every(Boolean),'COUNT_AUDIT_METADATA_MISSING');
   rows.forEach((r,i)=>cache.set(batchKeys[i],r.value));
   if(spec.sessionRotation==='closed-batches-v1'){
    const keys=ids.filter(id=>id>spec.baselineBatchCount).map(id=>{
     const item=pool.countAllocation.batches[id];
     assert(item?.closed&&item.settlementKey===`count-settlement:${plan.trialId}:${spec.activation}:${id}`,'COUNT_AUDIT_SETTLEMENT');
     return item.settlementKey;
    });
    if(keys.length){
     bulkReads++;const proofs=await store.getMany('journal',keys);
     assert(proofs.length===keys.length&&proofs.every(Boolean),'COUNT_AUDIT_SETTLEMENT_MISSING');
     proofs.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));
    }
   }
   loaded.add(first);
  }
  await auditCountBatch({store,plan,pool,spec,record,cache});
  verified.add(record.batchId);
 };
 review.summary=()=>({schema:'sg-count-audit-metadata-v1',allocatedRecords,verifiedBatches:verified.size,metadataBlocks:loaded.size,bulkReads,elapsedMs:performance.now()-started,sourceRequests:0,observationOnly:true});
 return review;
}
