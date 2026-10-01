import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pyramidsFifteenRepairPlan} from './pyramids-fifteen-repair-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
function fixture(){const plan={...base,countAllocation:'a'.repeat(64),featureProfile:'pyramids-fifteen-free-v1'};
 const profile={schema:'sg-formal-repair-pyramids-v5',gameId:32721,group:'secondary',workerOffset:20,basePlanHash:hash(base),
  completePreserved:5024,remainingComplete:294826,historicalBaseline:150,totalTarget:300000,maxSequence:600000,
  sessionRotation:'closed-batches-v1',oldProfileHash:'f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892',
  sourceRun:'36937673870:1',sourceCommit:'a66e2c7ac642c87ecedbbe9ddde5194bcae4de36',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:36937673870:1:complete',
  featureProfile:plan.featureProfile,controlReadMode:'compact-worker-v1',gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash:'a030ea2977061f63db69493a19fd09233fff9b784d49cf5b8ca448f3206c45aa',stateWriteMode:'versioned-delta-v1',activation:plan.countAllocation,planHash:hash(plan)};return {plan,profile};}
test('new mixed allocation preserves original total and binds the settled parent and delta mode',()=>{
 const {plan,profile}=fixture();assert.deepEqual(pyramidsFifteenRepairPlan(base,profile),plan);assert.deepEqual(applyFormalCount(plans,profile)[32721],plan);
 assert.equal(profile.remainingComplete+profile.completePreserved+profile.historicalBaseline,300000);
});
test('unknown parent quota expansion layout or unbound optimization cannot enter',()=>{
 for(const [key,value]of Object.entries({completePreserved:0,remainingComplete:300000,historicalBaseline:0,totalTarget:600000,maxSequence:600001,
  oldProfileHash:'b'.repeat(64),sourceRun:'999:1',sourceCommit:'c'.repeat(40),retirementKey:'other',featureProfile:'pyramids-free-major-v1',stateWriteMode:undefined,activation:'bad'})){
  const {profile}=fixture();profile[key]=value;assert.throws(()=>pyramidsFifteenRepairPlan(base,profile),key);
 }
 for(const key of ['demoGeneration','sessionLayout']){const {profile,plan}=fixture(),modified={...plan,[key]:'x'};profile.planHash=hash(modified);assert.throws(()=>pyramidsFifteenRepairPlan({...base,[key]:'x'},profile));}
});
