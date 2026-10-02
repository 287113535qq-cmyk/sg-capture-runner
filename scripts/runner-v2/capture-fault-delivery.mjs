import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishCaptureFailure} from './work-line-mailbox.mjs';
import {validatePreparationProof} from './work-line-events.mjs';

// Read-only native export -> local offline queues. Export acquisition stays
// separate; this cannot read credentials, clear a hold or resume the source.
export function deliverCaptureFault(root,envelope){
 assert(envelope?.schema==='sg-capture-fault-export-v1'&&envelope.sourceAllowance===0,'CAPTURE_FAULT_EXPORT_SCOPE');
 const {receipt,plan,batch,archive,publication}=envelope;
 assert(hash(captureFaultReceipt({plan,batch,archiveKey:receipt.archiveKey,archive,group:receipt.group}))===hash(receipt),
  'CAPTURE_FAULT_EXPORT_CHANGED');
 const binding=publication?.bindings?.[String(receipt.gameId)],task=publication?.inventory?.tasks?.find(t=>t.gameId===receipt.gameId);
 assert(publication?.schema==='sg-prepared-publication-v1'&&publication.sourceAllowance===0
  &&binding?.group===receipt.group&&binding.planHash===receipt.planHash
  &&task?.status==='prepared'&&task.proofHash===binding.proofHash&&hash(task.proof)===binding.proofHash,
  'CAPTURE_FAULT_ORIGINAL_PREPARATION');
 assert(validatePreparationProof(task.proof,receipt.gameId)===binding.proofHash,'CAPTURE_FAULT_ORIGINAL_PROOF');
 const ids=publishCaptureFailure(root,{gameId:receipt.gameId,proofHash:binding.proofHash,
  reason:receipt.reason,evidence:{receipt,plan,raw:archive.pending.raw}});
 return {schema:'sg-capture-fault-delivery-v1',gameId:receipt.gameId,receiptHash:hash(receipt),
  status:'repair-and-analysis-delivered',mailboxes:ids,sourceAllowance:0,sourceRequests:0,dispatched:false};
}
