import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsCountPlan} from './pyramids-count-profile.mjs';
import {pyramidsRepairPlan} from './pyramids-repair-profile.mjs';
import {sessionLayoutPlan} from './session-layout-profile.mjs';

export function applyFormalCount(plans,profile){
 const base=plans[profile?.gameId];
 if(profile?.schema==='sg-session-layout-profile-v1')return {...plans,[32795]:sessionLayoutPlan(base,profile)};
 if(profile?.schema==='sg-formal-repair-pyramids-v1')return {...plans,[32721]:pyramidsRepairPlan(base,profile)};
 if(profile?.schema==='sg-formal-count-pyramids-v1')return {...plans,[32721]:pyramidsCountPlan(base,profile)};
 if(profile?.schema==='sg-formal-count-rhino-v1'){
  assert(profile.gameId===32799&&base?.trialId==='sg_r1_20261001_32799'&&base.target===300000&&base.buy===0&&base.phase===1
   &&base.adapter==='rhino-wms-v1'&&profile.basePlanHash===hash(base)&&profile.completePreserved===100
   &&profile.remainingComplete===299900&&profile.maxSequence===600000&&profile.sessionRotation==='closed-batches-v1'
   &&/^[a-f0-9]{64}$/.test(profile.activation??''),'RHINO_FORMAL_PROFILE_SCOPE');
  const plan={...base,countAllocation:profile.activation};
  assert(profile.planHash===hash(plan)&&!plan.demoGeneration,'RHINO_FORMAL_PLAN_CHANGED');return {...plans,[base.gameId]:plan};
 }
 if(profile?.schema==='sg-formal-repair-profile-v2'){
  assert(profile.gameId===32795&&base?.trialId==='sg_r1_20260930_32795'&&base.target===300000&&base.buy===0&&base.phase===1
   &&base.adapter==='pearl-wms-v1'&&profile.basePlanHash===hash(base)&&profile.completePreserved===2596
   &&profile.remainingComplete===297404&&profile.maxSequence===600000&&profile.sessionRotation==='closed-batches-v1'
   &&profile.featureProfile==='additive-free-awards-v2'&&/^[a-f0-9]{64}$/.test(profile.activation??''),'FORMAL_REPAIR_PROFILE_SCOPE');
  const plan={...base,maxSteps:1026,featureProfile:profile.featureProfile,countAllocation:profile.activation};
  assert(profile.planHash===hash(plan)&&!plan.demoGeneration,'FORMAL_REPAIR_PLAN_CHANGED');return {...plans,[base.gameId]:plan};
 }
 if(profile?.schema==='sg-formal-repair-profile-v1'){
  assert(profile.gameId===32795&&base?.trialId==='sg_r1_20260930_32795'&&base.target===300000&&base.buy===0&&base.phase===1
   &&base.adapter==='pearl-wms-v1'&&profile.basePlanHash===hash(base)&&profile.completePreserved===961
   &&profile.remainingComplete===299039&&profile.maxSequence===600000&&profile.sessionRotation==='closed-batches-v1'
   &&profile.featureProfile==='eight-free-retrigger-v1'&&/^[a-f0-9]{64}$/.test(profile.activation??''),'FORMAL_REPAIR_PROFILE_SCOPE');
  const plan={...base,maxSteps:1026,featureProfile:profile.featureProfile,countAllocation:profile.activation};
  assert(profile.planHash===hash(plan)&&!plan.demoGeneration,'FORMAL_REPAIR_PLAN_CHANGED');return {...plans,[base.gameId]:plan};
 }
 assert(profile?.schema==='sg-formal-count-profile-v1'&&profile.gameId===32795
  &&base?.trialId==='sg_r1_20260930_32795'&&base.target===300000&&base.buy===0&&base.phase===1
  &&base.adapter==='pearl-wms-v1'&&profile.basePlanHash===hash(base)
  &&/^[a-f0-9]{64}$/.test(profile.activation??'')&&profile.completePreserved===100
  &&profile.remainingComplete===299900&&profile.maxSequence===600000
  &&profile.sessionRotation==='closed-batches-v1','FORMAL_COUNT_PROFILE_SCOPE');
 const plan={...base,countAllocation:profile.activation};
 assert(profile.planHash===hash(plan)&&!plan.demoGeneration,'FORMAL_COUNT_PLAN_CHANGED');
 return {...plans,[base.gameId]:plan};
}

export function formalCountProfilePath(env=process.env){
 if(['formal-sessions-pearl-two-20261001.json','formal-sessions-pearl-four-20261001.json'].includes(env.SG_FORMAL_COUNT_PROFILE))
  return 'config/'+env.SG_FORMAL_COUNT_PROFILE;
 assert(['formal-repair-pyramids-coins-20261001.json','formal-count-pyramids-20261001.json','formal-count-rhino-20261001.json','formal-count-pearl-20260930.json','formal-repair-pearl-20260930.json','formal-repair-pearl-awards-20261001.json'].includes(env.SG_FORMAL_COUNT_PROFILE),'FORMAL_COUNT_PROFILE_PATH');
 return 'config/'+env.SG_FORMAL_COUNT_PROFILE;
}
