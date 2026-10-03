import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {HUFF_SOURCE,ACTION_VERSION as HUFF_ACTION_VERSION,ACTION_CONTRACT_HASH as HUFF_ACTION_HASH} from '../trial/huff-action-contract.mjs';

// Source permission is reviewed separately from reusable preparation. The
// committed authorization binds one exact profile; a mailbox cannot mint it.
export function preparedCountPlan(base,profile,authorization){
 assert(profile?.schema==='sg-prepared-count-profile-v1'&&authorization?.schema==='sg-prepared-count-authorization-v1'
  &&authorization.profileHash===hash(profile)&&authorization.gameId===base?.gameId
  &&authorization.trialId===base.trialId&&authorization.basePlanHash===hash(base)
  &&authorization.activation===profile.activation, 'PREPARED_COUNT_AUTHORIZATION');
 assert(base.buy===0&&base.phase===1&&!base.demoGeneration&&!base.countAllocation
  &&profile.gameId===base.gameId&&profile.trialId===base.trialId&&profile.group===authorization.group
  &&['primary','secondary'].includes(profile.group)&&profile.basePlanHash===hash(base)
  &&Number.isSafeInteger(profile.completePreserved)&&profile.completePreserved>=0&&profile.completePreserved<300000
  &&profile.targetComplete===300000&&profile.remainingComplete===300000-profile.completePreserved
  &&profile.maxSequence===600000&&profile.sessionRotation==='closed-batches-v1'
  &&profile.newBetAllowance===0&&profile.requiresNewSession===true
  &&Number.isSafeInteger(profile.createdAt)&&Number.isSafeInteger(profile.expiresAt)
  &&profile.expiresAt-profile.createdAt===7200000,'PREPARED_COUNT_PROFILE');
 for(const field of ['activation','preparationProofHash','failureEvidenceHash','sceneHash','recordsHash','closureHash'])
  assert(/^[a-f0-9]{64}$/.test(profile[field]??''),'PREPARED_COUNT_BINDING');
 if(profile.repairParent){
  const p=profile.repairParent;
  assert(/^[a-f0-9]{64}$/.test(p.activation??'')&&p.activation!==profile.activation
   &&/^[a-f0-9]{64}$/.test(p.specHash??'')&&/^[a-f0-9]{40}$/.test(p.sourceCommit??'')
   &&/^\d+:1$/.test(p.sourceRun??'')&&['shared','parked','prepared'].some(kind=>
    p.closureKey===`count-${kind}-close:${base.trialId}:${p.sourceRun}:complete`),'PREPARED_REPAIR_PARENT');
 }
 const plan={...base,target:300000,countAllocation:profile.activation};
 if(profile.actionContract!==undefined){
  assert(base.gameId===32714&&base.sourceKey===HUFF_SOURCE&&base.betRaw===500&&base.maxSteps===100
   &&hash(profile.actionContract)===hash({version:HUFF_ACTION_VERSION,hash:HUFF_ACTION_HASH}),
   'PREPARED_ACTION_CONTRACT');
  plan.featureProfile=HUFF_ACTION_VERSION;plan.actionContractHash=HUFF_ACTION_HASH;
 }
 assert(profile.planHash===hash(plan),'PREPARED_COUNT_PLAN_CHANGED');return plan;
}
