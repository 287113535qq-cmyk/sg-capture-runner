import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishCaptureFailure} from './work-line-mailbox.mjs';
import {capturePreparationBinding} from './capture-preparation-binding.mjs';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import fs from 'node:fs';import path from 'node:path';

// Read-only native export -> local offline queues. Export acquisition stays
// separate; this cannot read credentials, clear a hold or resume the source.
export function validateCaptureFault(root,envelope){
 assert(envelope?.schema==='sg-capture-fault-export-v1'&&envelope.sourceAllowance===0,'CAPTURE_FAULT_EXPORT_SCOPE');
 const {receipt,plan,batch,archive,publication}=envelope;
 assert(hash(captureFaultReceipt({plan,batch,archiveKey:receipt.archiveKey,archive,group:receipt.group}))===hash(receipt),
  'CAPTURE_FAULT_EXPORT_CHANGED');
 const countBinding=envelope.countBinding;
 if(plan.countAllocation){
  const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
  const name=`formal-prepared-count-${plan.gameId}-${plan.countAllocation}.json`;
  const authorization=preparedCountAuthorization(name,read);
  assert(countBinding&&hash(countBinding.authorization)===hash(authorization)
   &&hash(countBinding.profile)===hash(read('config/'+name))
   &&hash(countBinding.basePlan)===hash(read('config/round-one-plans.json')[plan.gameId]),
   'CAPTURE_COUNT_LOCAL_AUTHORIZATION');
 }
 const binding=capturePreparationBinding({plan,group:receipt.group,publication,countBinding});
 return binding;
}

export function deliverCaptureFault(root,envelope){
 const binding=validateCaptureFault(root,envelope);
 const {receipt,plan,archive}=envelope;
 const ids=publishCaptureFailure(root,{gameId:receipt.gameId,proofHash:binding.proofHash,
  reason:receipt.reason,evidence:{receipt,plan,raw:archive.pending.raw}});
 return {schema:'sg-capture-fault-delivery-v1',gameId:receipt.gameId,receiptHash:hash(receipt),
  status:'repair-and-analysis-delivered',mailboxes:ids,sourceAllowance:0,sourceRequests:0,dispatched:false};
}
