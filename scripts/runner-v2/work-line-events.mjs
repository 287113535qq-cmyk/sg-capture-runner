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
 if(event.kind==='native-repair-advanced'){
  // A reconciled terminal closes the latest source without creating a fake
  // abandoned fault. Advance only the exact previous, already fenced repair.
  assert((task.lane==='repair'||lane==='admission'&&task.lane==='admission')&&['queued','blocked'].includes(task.status)&&!task.proof&&!task.proofHash
   &&task.nativeRepairKey===event.previousRepairKey&&task.failureEvidenceHash===event.previousFailureEvidenceHash
   &&event.repairKey!==event.previousRepairKey&&/^[a-f0-9]{64}$/.test(event.rejectedProofHash??'')
   &&typeof event.repairKey==='string'&&event.repairKey.startsWith('game-repair:'),'WORK_LINE_NATIVE_TRANSITION_BINDING');
  task.rejectedProofHash=event.rejectedProofHash;task.failureEvidenceHash=event.evidenceHash;
  task.nativeRepairKey=event.repairKey;task.lane='repair';task.status=lane==='repair'?'queued':'blocked';task.reason='NATIVE_REPAIR_REPLAY_REQUIRED';
 }else if(event.kind==='native-repair-settled'){
  const matching=event.captureFailureEvidenceHash===task.failureEvidenceHash&&event.rejectedProofHash===task.rejectedProofHash;
  // An implementation change can fence admission before the ended source's
  // fault arrives. Authenticated native closure may align that already fenced
  // mirror; it cannot revoke a different live proof or make the game prepared.
  const fencedMirror=lane==='admission'&&task.status==='blocked'&&!task.proof&&!task.proofHash;
  assert((matching||fencedMirror)&&/^[a-f0-9]{64}$/.test(event.captureFailureEvidenceHash??'')
   &&/^[a-f0-9]{64}$/.test(event.rejectedProofHash??'')
   &&typeof event.repairKey==='string'&&event.repairKey.startsWith('game-repair:'),'WORK_LINE_NATIVE_SETTLEMENT_BINDING');
  task.rejectedProofHash=event.rejectedProofHash;
  task.proof=null;delete task.proofHash;task.lane='repair';task.status=lane==='repair'?'queued':'blocked';
  task.captureFailureEvidenceHash=event.captureFailureEvidenceHash;
  task.failureEvidenceHash=event.evidenceHash;task.nativeRepairKey=event.repairKey;
  task.reason='NATIVE_REPAIR_REPLAY_REQUIRED';
 }else if(event.kind==='native-repair-observed'){
  assert(task.lane==='repair'&&['queued','blocked'].includes(task.status)&&!task.proof
   &&(!task.failureEvidenceHash||task.failureEvidenceHash===event.evidenceHash)
   &&typeof event.repairKey==='string'&&event.repairKey.startsWith('game-repair:'),'WORK_LINE_NATIVE_REPAIR_BINDING');
  task.failureEvidenceHash=event.evidenceHash;task.nativeRepairKey=event.repairKey;
  task.reason='NATIVE_REPAIR_REPLAY_REQUIRED';
 }else if(event.kind==='capture-failed'){
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
export function preparedCampaignSelector(inventory,{verifyProof,onRejected=()=>{}}){
 assert(inventory?.schema==='sg-preparation-inventory-v1'&&typeof verifyProof==='function','WORK_LINE_INVENTORY');
 return async({readyGameIds,group})=>{
  for(const task of inventory.tasks.filter(t=>t.status==='prepared'&&readyGameIds.includes(t.gameId))){
   try{
    assert(validatePreparationProof(task.proof,task.gameId)===task.proofHash,'WORK_LINE_PROOF_CHANGED');
    if(await verifyProof(task.proof,{group,gameId:task.gameId}))return task.gameId;
   }catch(error){
    // Only static preparation is read here, never live source or health
    // permission. One invalid proof cannot withhold other verified games.
    onRejected({gameId:task.gameId,reason:/^[A-Z_]+$/.test(error.message)?error.message:'PREPARATION_EVIDENCE_UNAVAILABLE'});
   }
  }
  return null;
 };
}
