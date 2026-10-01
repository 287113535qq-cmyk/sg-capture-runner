import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {sessionLayout} from './session-layout.mjs';

// This validates a proposed layout, not permission to run it. The independent
// activation controller must prove the previous run ended with all batches closed.
export function sessionLayoutPlan(base,profile){
 const rhino=profile?.schema==='sg-session-layout-rhino-v1';
 assert((rhino?base?.gameId===32799&&base.trialId==='sg_r1_20261001_32799'&&base.adapter==='rhino-wms-v1':profile?.schema==='sg-session-layout-profile-v1'&&base?.gameId===32795&&base.trialId==='sg_r1_20260930_32795'&&base.adapter==='pearl-wms-v1')
  &&base.target===300000&&base.phase===1&&base.buy===0&&!base.countAllocation&&!base.demoGeneration
  &&profile.gameId===base.gameId&&profile.group==='primary'&&profile.basePlanHash===hash(base)
  &&(rhino?profile.captureMinutes===20:profile.featureProfile==='additive-free-awards-v2')&&profile.maxSequence===600000
  &&profile.sessionRotation==='closed-batches-v1','SESSION_PROFILE_SCOPE');
 assert(Number.isSafeInteger(profile.completePreserved)&&profile.completePreserved>=(rhino?151:2596)
  &&profile.completePreserved<base.target&&profile.remainingComplete===base.target-profile.completePreserved
  &&profile.newBetAllowance===0,'SESSION_PROFILE_TARGET');
 for(const k of ['activation','parentActivation','parentProfileHash','sourceSpecHash','poolHash','campaignHash','sourcePermitHash'])
  assert(/^[a-f0-9]{64}$/.test(profile[k]??''),'SESSION_PROFILE_IDENTITY');
 assert(profile.activation!==profile.parentActivation&&/^\d+:1$/.test(profile.sourceRun??'')
  &&/^[a-f0-9]{40}$/.test(profile.sourceCommit??''),'SESSION_PROFILE_PARENT');
 const layout=profile.sessionLayout,prior=profile.previousLanesPerHost;
 assert((prior===1&&layout?.lanesPerHost===2)||(prior===2&&layout?.lanesPerHost===4),'SESSION_PROFILE_STEP');
 // The 2 -> 4 change requires an explicit reviewed throughput/error comparison.
 assert(prior===1?profile.comparisonHash===null:/^[a-f0-9]{64}$/.test(profile.comparisonHash??''),'SESSION_PROFILE_COMPARISON');
 const plan={...base,...(rhino?{}:{maxSteps:1026,featureProfile:profile.featureProfile}),
  countAllocation:profile.activation,sessionLayout:structuredClone(layout)};
 sessionLayout(plan,{sessionLayout:layout});
 assert(hash(plan)===profile.planHash,'SESSION_PROFILE_PLAN');return plan;
}
