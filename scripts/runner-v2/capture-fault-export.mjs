import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Bounded read-only export of one fixed trial. Cursor is a batch id, not a
// completed count. No full-database scan, quota writes or online source calls.
export async function exportCaptureFaultPage({store,plan,publication,afterBatchId=0,limit=100}){
 assert(Number.isSafeInteger(afterBatchId)&&afterBatchId>=0&&Number.isSafeInteger(limit)
  &&limit>=1&&limit<=100,'CAPTURE_FAULT_EXPORT_PAGE');
 const campaign=(await store.get('state','campaign'))?.value;
 assert(campaign?.games?.some(g=>g.game_id===plan.gameId),'CAPTURE_FAULT_EXPORT_GAME');
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(Number.isSafeInteger(pool?.nextBatchId)&&pool.nextBatchId>=1,'CAPTURE_FAULT_EXPORT_POOL');
 const end=Math.min(afterBatchId+limit,pool.nextBatchId-1);
 assert(afterBatchId<=pool.nextBatchId-1,'CAPTURE_FAULT_EXPORT_CURSOR');
 const keys=Array.from({length:end-afterBatchId},(_,i)=>`batch:${plan.trialId}:${afterBatchId+i+1}`);
 const batches=keys.length?await store.getMany('state',keys):[];
 assert(batches.length===keys.length&&batches.every((r,i)=>r?.value?.id===afterBatchId+i+1),'CAPTURE_FAULT_EXPORT_ROWS');
 const exports=[];
 for(const stored of batches){
  const b=stored?.value;if(!b?.workLineFault)continue;
  assert(b.workLineFault.startsWith('capture-fault:'+plan.trialId+':'+b.id+':'),'CAPTURE_FAULT_EXPORT_KEY');
  const receipt=(await store.get('journal',b.workLineFault))?.value;
  assert(receipt?.trialId===plan.trialId&&receipt.batchId===b.id,'CAPTURE_FAULT_EXPORT_RECEIPT');
  const archive=(await store.get('journal',receipt.archiveKey))?.value;
  const batch={id:b.id,checkpoint:receipt.checkpoint,journaled:receipt.journaled,pending:archive?.pending};
  assert(hash(captureFaultReceipt({plan,batch,archiveKey:receipt.archiveKey,archive,group:receipt.group}))===hash(receipt),'CAPTURE_FAULT_EXPORT_CHANGED');
  exports.push({schema:'sg-capture-fault-export-v1',sourceAllowance:0,plan,batch,receipt,archive,publication});
 }
 return {exports,nextBatchId:end,hasMore:end<pool.nextBatchId-1,sourceRequests:0,sourceAllowance:0};
}
