import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// This inventory has no source client or quota writer. Reusable preparation
// proofs are separate from the short-lived permission issued at capture time.
export const preparationGates=['route','settlement','persistence','local','linux','native'];
export function newInventory(games,statuses={}){
  assert(new Set(games.map(g=>g.gameId)).size===games.length,'PREPARATION_DUPLICATE_GAME');
  return {schema:'sg-preparation-inventory-v1',revision:0,sourceAllowance:0,tasks:games.map(g=>({
    gameId:g.gameId,name:g.name,status:statuses[g.gameId]==='complete'?'complete':'queued',
    lane:statuses[g.gameId]==='parked-protocol'?'repair':'admission',attempt:0,claim:null,proof:null}))};
}
export function claimPreparation(inventory,{owner,now,leaseMs=300000,lane=null}){
  assert(typeof owner==='string'&&owner.length>0&&Number.isSafeInteger(now),'PREPARATION_OWNER');
  assert(leaseMs>=1000&&leaseMs<=1800000,'PREPARATION_LEASE');
  // Unfinished commands after a crash require explicit review, never replay.
  for(const task of inventory.tasks)if(task.claim&&task.claim.until<=now){
    task.status='blocked';task.reason='INTERRUPTED_PREPARATION_REQUIRES_REVIEW';task.claim=null;
  }
  const choose=lane=>inventory.tasks.find(t=>t.lane===lane&&t.status==='queued'&&!t.claim);
  assert(lane===null||['admission','repair'].includes(lane),'PREPARATION_LANE');
  const task=lane?choose(lane):(choose('admission')??choose('repair'));
  if(!task)return null;
  task.status='preparing';task.attempt++;task.claim={owner,until:now+leaseMs,token:hash([owner,now,task.gameId,task.attempt])};
  inventory.revision++;return structuredClone(task);
}
export function finishPreparation(inventory,claim,result,now){
  const task=inventory.tasks.find(t=>t.gameId===claim.gameId);
  assert(task?.claim?.token===claim.claim.token&&task.claim.until>now,'PREPARATION_CLAIM_CHANGED');
  assert(result&&['blocked','prepared'].includes(result.status),'PREPARATION_RESULT');
  if(result.status==='prepared'){
    const proof=result.proof;
    assert(proof?.schema==='sg-reusable-preparation-v1'&&proof.gameId===task.gameId
      &&proof.sourceAllowance===0&&/^[a-f0-9]{64}$/.test(proof.revisionHash),'PREPARATION_PROOF_SCOPE');
    for(const gate of preparationGates)assert(proof.gates?.[gate]?.verified===true
      &&/^[a-f0-9]{64}$/.test(proof.gates[gate].evidenceHash),'PREPARATION_GATE_MISSING');
    task.proof=structuredClone(proof);task.proofHash=hash(proof);
  }else{
    assert(typeof result.reason==='string'&&result.reason.length>0,'PREPARATION_BLOCK_REASON');
    task.reason=result.reason;
  }
  task.status=result.status;task.claim=null;task.updatedAt=now;inventory.revision++;
}
export function invalidatePreparation(inventory,gameId,reason){
  const task=inventory.tasks.find(t=>t.gameId===gameId);assert(task&&!task.claim,'PREPARATION_BUSY');
  task.status='queued';task.reason=reason;task.proof=null;delete task.proofHash;inventory.revision++;
}
// A real capture failure revokes only the matching prepared revision. A late
// failure from an older runtime must not remove a newer reviewed preparation.
export function rejectPreparedRevision(inventory,{gameId,proofHash,reason,evidenceHash,now}){
  assert(typeof reason==='string'&&reason.length>0&&/^[a-f0-9]{64}$/.test(evidenceHash)
    &&Number.isSafeInteger(now),'PREPARATION_FAILURE_EVIDENCE');
  const task=inventory.tasks.find(t=>t.gameId===gameId);
  if(!task||task.status!=='prepared'||task.proofHash!==proofHash)return false;
  assert(!task.claim,'PREPARATION_BUSY');
  task.rejectedProofHash=proofHash;task.failureEvidenceHash=evidenceHash;
  task.status='blocked';task.reason=reason;task.proof=null;delete task.proofHash;
  task.updatedAt=now;inventory.revision++;return true;
}
export async function selectPrepared(inventory,{verifyReusable,admitFresh}){
  assert(typeof verifyReusable==='function'&&typeof admitFresh==='function','PREPARATION_ADMISSION_REQUIRED');
  for(const task of inventory.tasks.filter(t=>t.status==='prepared')){
    assert(hash(task.proof)===task.proofHash,'PREPARATION_PROOF_CHANGED');
    if(!await verifyReusable(task.proof)){
      invalidatePreparation(inventory,task.gameId,'PREPARATION_REVISION_CHANGED');continue;
    }
    // Consumer must use the existing GitHub-only independent admission. A
    // reusable proof is never a permission to send INIT/BET or reset a budget.
    const admission=await admitFresh(structuredClone(task));
    if(admission?.action==='capture')return {task:structuredClone(task),admission};
  }
  return {action:'waiting-prepared',sourceAllowance:0};
}
