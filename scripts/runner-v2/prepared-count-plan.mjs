import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

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
 const plan={...base,target:300000,countAllocation:profile.activation};
 assert(profile.planHash===hash(plan),'PREPARED_COUNT_PLAN_CHANGED');return plan;
}
