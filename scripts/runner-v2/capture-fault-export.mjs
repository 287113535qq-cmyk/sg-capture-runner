import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Bounded read-only export of one fixed trial. Cursor is a batch id, not a
// completed count. No full-database scan, quota writes or online source calls.
export async function exportCaptureFaultPage({store,plan,publication,afterBatchId=0,limit=100,revisitBatchIds=[]}){
 assert(Number.isSafeInteger(afterBatchId)&&afterBatchId>=0&&Number.isSafeInteger(limit)
  &&limit>=1&&limit<=100,'CAPTURE_FAULT_EXPORT_PAGE');
 const campaign=(await store.get('state','campaign'))?.value;
 assert(campaign?.games?.some(g=>g.game_id===plan.gameId),'CAPTURE_FAULT_EXPORT_GAME');
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(Number.isSafeInteger(pool?.nextBatchId)&&pool.nextBatchId>=1,'CAPTURE_FAULT_EXPORT_POOL');
 const end=Math.min(afterBatchId+limit,pool.nextBatchId-1);
 assert(afterBatchId<=pool.nextBatchId-1,'CAPTURE_FAULT_EXPORT_CURSOR');
 assert(Array.isArray(revisitBatchIds)&&revisitBatchIds.length<=100&&new Set(revisitBatchIds).size===revisitBatchIds.length
  &&revisitBatchIds.every(id=>Number.isSafeInteger(id)&&id>=1&&id<=afterBatchId),'CAPTURE_FAULT_EXPORT_REVISIT');
 const ids=[...revisitBatchIds,...Array.from({length:end-afterBatchId},(_,i)=>afterBatchId+i+1)],batches=[];
 for(let i=0;i<ids.length;i+=100){
  const wanted=ids.slice(i,i+100),rows=await store.getMany('state',wanted.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===wanted.length&&rows.every((r,j)=>r?.value?.id===wanted[j]),'CAPTURE_FAULT_EXPORT_ROWS');batches.push(...rows);
 }
 const unresolvedBatchIds=[];
 const exports=[];
 for(const stored of batches){
  const b=stored?.value;if(!b?.workLineFault){
   // A batch can fail after its first scan. Keep unfinished batches in the
   // next read set; never lose a later durable fault by advancing the cursor.
   if(!b.retiredDemo&&!b.bootstrapRetired&&!pool.countAllocation?.batches?.[b.id]?.closed
    &&(b.pending||b.pendingOriginal||b.bootstrapAwaiting||b.journaled!==b.end))unresolvedBatchIds.push(b.id);
   continue;
  }
  assert(b.workLineFault.startsWith('capture-fault:'+plan.trialId+':'+b.id+':'),'CAPTURE_FAULT_EXPORT_KEY');
  const receipt=(await store.get('journal',b.workLineFault))?.value;
  assert(receipt?.trialId===plan.trialId&&receipt.batchId===b.id,'CAPTURE_FAULT_EXPORT_RECEIPT');
  const archive=(await store.get('journal',receipt.archiveKey))?.value;
  const batch={id:b.id,checkpoint:receipt.checkpoint,journaled:receipt.journaled,pending:archive?.pending};
  assert(hash(captureFaultReceipt({plan,batch,archiveKey:receipt.archiveKey,archive,group:receipt.group}))===hash(receipt),'CAPTURE_FAULT_EXPORT_CHANGED');
  exports.push({schema:'sg-capture-fault-export-v1',sourceAllowance:0,plan,batch,receipt,archive,publication});
 }
 assert(unresolvedBatchIds.length<=100,'CAPTURE_FAULT_EXPORT_OPEN_BOUND');
 return {exports,nextBatchId:end,unresolvedBatchIds,hasMore:end<pool.nextBatchId-1,sourceRequests:0,sourceAllowance:0};
}
