import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {validatePreparationProof} from './work-line-events.mjs';

// A prepared formal allocation changes the plan hash, not the original proof.
// Both ends validate the exact registered profile; stripping fields is unsafe.
export function capturePreparationBinding({plan,group,publication,countBinding}){
 const binding=publication?.bindings?.[String(plan.gameId)];
 const task=publication?.inventory?.tasks?.find(t=>t.gameId===plan.gameId);
 assert(publication?.schema==='sg-prepared-publication-v1'&&publication.sourceAllowance===0
  &&binding?.group===group&&task?.status==='prepared'&&task.proofHash===binding.proofHash
  &&validatePreparationProof(task.proof,plan.gameId)===binding.proofHash,'EVIDENCE_ORIGINAL_PREPARATION');
 if(plan.countAllocation){
  assert(countBinding,'CAPTURE_COUNT_BINDING_REQUIRED');
  const {basePlan,profile,authorization}=countBinding;
  assert(hash(preparedCountPlan(basePlan,profile,authorization))===hash(plan)
   &&binding.planHash===hash(basePlan)&&profile.group===group
   &&profile.preparationProofHash===binding.proofHash
   &&profile.failureEvidenceHash===task.failureEvidenceHash,'CAPTURE_COUNT_PREPARATION_CHANGED');
 }else assert(!countBinding&&binding.planHash===hash(plan),'EVIDENCE_ORIGINAL_PREPARATION');
 return binding;
}
