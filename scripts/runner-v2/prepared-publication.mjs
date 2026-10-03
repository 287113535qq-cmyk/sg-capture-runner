import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {validatePreparationProof} from './work-line-events.mjs';
import {preparationGates} from './preparation-inventory.mjs';

// Compile a reusable publication, never an online activation or source permit.
// The resolver is an operator's fixed plan inventory, not mailbox input.
export async function buildPreparedPublication({inventory,resolvePlan,readEvidence}){
 assert(inventory?.schema==='sg-preparation-inventory-v1'&&inventory.sourceAllowance===0
  &&typeof resolvePlan==='function'&&typeof readEvidence==='function','PREPARED_BUILD_SCOPE');
 const bindings={},evidence={},tasks=[];
 for(const task of inventory.tasks.filter(t=>t.status==='prepared')){
  assert(!task.claim&&validatePreparationProof(task.proof,task.gameId)===task.proofHash,'PREPARED_BUILD_PROOF');
  const resolved=await resolvePlan(task.gameId);
  assert(resolved?.plan?.gameId===task.gameId&&['primary','secondary'].includes(resolved.group),'PREPARED_BUILD_PLAN');
  const refs={};
  for(const gate of preparationGates){
   const digest=task.proof.gates[gate].evidenceHash,receipt=await readEvidence(task.gameId,digest);
   assert(receipt?.schema==='sg-preparation-gate-v1'&&hash(receipt)===digest
    &&receipt.gameId===task.gameId&&receipt.revisionHash===task.proof.revisionHash
    &&receipt.gate===gate&&receipt.verified===true&&receipt.sourceAllowance===0
    &&Array.isArray(receipt.supportingHashes)&&receipt.supportingHashes.length>0
    &&receipt.supportingHashes.every(h=>/^[a-f0-9]{64}$/.test(h)),'PREPARED_BUILD_EVIDENCE');
   assert(!task.failureEvidenceHash||!['route','settlement','persistence'].includes(gate)
    ||receipt.failureEvidenceHash===task.failureEvidenceHash,'PREPARED_BUILD_FAILURE_BINDING');
   // Public repositories receive only proof metadata, never original evidence.
   assert(Object.keys(receipt).every(key=>['schema','gate','gameId','revisionHash','verified',
    'sourceAllowance','supportingHashes','origin','nativeScope','reviewedAt','failureEvidenceHash'].includes(key)),
    'PREPARED_EVIDENCE_PRIVATE_FIELDS');
   const ref=`config/preparation-evidence/${digest}.json`;refs[gate]=ref;evidence[ref]=receipt;
  }
  tasks.push(structuredClone(task));bindings[String(task.gameId)]={group:resolved.group,
   planHash:hash(resolved.plan),proofHash:task.proofHash,evidence:refs};
 }
 return {publication:{schema:'sg-prepared-publication-v1',sourceAllowance:0,
  inventory:{schema:inventory.schema,sourceAllowance:0,revision:inventory.revision,tasks},bindings},evidence,
  sourceRequests:0,newBetAllowance:0};
}
