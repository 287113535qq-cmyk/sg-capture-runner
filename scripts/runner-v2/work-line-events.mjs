import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationGates} from './preparation-inventory.mjs';

// Cross-lane receipts carry evidence, never quota, credentials or raw sessions.
// Each lane remains the sole writer of its inventory. Immutable inbox events
// are consumed idempotently, so a crash cannot duplicate a transition.
export function validatePreparationProof(proof,gameId){
 assert(proof?.schema==='sg-reusable-preparation-v1'&&proof.gameId===gameId
  &&proof.sourceAllowance===0&&/^[a-f0-9]{64}$/.test(proof.revisionHash),'WORK_LINE_PROOF_SCOPE');
 for(const gate of preparationGates)assert(proof.gates?.[gate]?.verified===true
  &&/^[a-f0-9]{64}$/.test(proof.gates[gate].evidenceHash),'WORK_LINE_PROOF_GATE');
 return hash(proof);
}
export function applyWorkLineEvent(inventory,event,lane,now){
 assert(['admission','repair'].includes(lane)&&Number.isSafeInteger(now),'WORK_LINE_LANE');
 assert(event?.schema==='sg-work-line-event-v1'&&event.sourceAllowance===0
  &&Number.isSafeInteger(event.gameId)&&/^[a-f0-9]{64}$/.test(event.evidenceHash),'WORK_LINE_EVENT_SCOPE');
 const id=hash(event);inventory.consumedEvents??=[];
 if(inventory.consumedEvents.includes(id))return false;
 const task=inventory.tasks.find(t=>t.gameId===event.gameId);
 assert(task&&!task.claim,'WORK_LINE_TASK_BUSY');
 assert(task.status!=='complete','WORK_LINE_COMPLETED_IMMUTABLE');
 if(event.kind==='capture-failed'){
  assert(/^[a-f0-9]{64}$/.test(event.proofHash)&&typeof event.reason==='string','WORK_LINE_FAILURE');
  // A delayed failure may not fence a newer admitted revision.
  if(lane==='admission'&&task.proofHash!==event.proofHash)return false;
  if(lane==='repair'&&task.failureEvidenceHash===event.evidenceHash)return false;
  if(lane==='repair'&&task.status==='prepared'&&task.proofHash!==event.proofHash)return false;
  task.rejectedProofHash=event.proofHash;task.failureEvidenceHash=event.evidenceHash;
  task.proof=null;delete task.proofHash;task.reason=event.reason;
  task.lane='repair';
  // Retiring source and reading back data precede repair re-entry. Creating a
  // repair item does not assert that the failed source has already settled.
  task.status=lane==='repair'?'queued':'blocked';
 }else if(event.kind==='repair-verified'){
  assert(lane==='admission'&&event.failureEvidenceHash===task.failureEvidenceHash
   &&event.rejectedProofHash===task.rejectedProofHash,'WORK_LINE_REPAIR_BINDING');
  task.proofHash=validatePreparationProof(event.proof,event.gameId);
  task.proof=structuredClone(event.proof);task.status='prepared';task.lane='admission';
  task.reason=null;
 }else throw Error('WORK_LINE_EVENT_KIND');
 task.updatedAt=now;inventory.consumedEvents.push(id);inventory.revision++;return true;
}

// Select only already admitted campaign games. Semantic results are not an
// input: an unclassified, correctly settled round does not block selection.
export function preparedCampaignSelector(inventory,{verifyProof}){
 assert(inventory?.schema==='sg-preparation-inventory-v1'&&typeof verifyProof==='function','WORK_LINE_INVENTORY');
 return async({readyGameIds,group})=>{
  for(const task of inventory.tasks.filter(t=>t.status==='prepared'&&readyGameIds.includes(t.gameId))){
   assert(validatePreparationProof(task.proof,task.gameId)===task.proofHash,'WORK_LINE_PROOF_CHANGED');
   if(await verifyProof(task.proof,{group,gameId:task.gameId}))return task.gameId;
  }
  return null;
 };
}
