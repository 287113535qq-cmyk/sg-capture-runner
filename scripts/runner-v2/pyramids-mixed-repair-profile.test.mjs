import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pyramidsMixedRepairPlan} from './pyramids-mixed-repair-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
function fixture(){const plan={...base,countAllocation:'a'.repeat(64),featureProfile:'pyramids-free-hold-v1'};
 const profile={schema:'sg-formal-repair-pyramids-v4',gameId:32721,group:'secondary',workerOffset:20,basePlanHash:hash(base),
  completePreserved:3627,remainingComplete:296223,historicalBaseline:150,totalTarget:300000,maxSequence:600000,
  sessionRotation:'closed-batches-v1',oldProfileHash:'5c7278ed911ed73ca082e611e8556909704e979b9b6447d29591ec8f8cf6a411',
  sourceRun:'36860241790:1',sourceCommit:'d2d38028883eef3a609ba3209e19785857a54e56',
  retirementKey:'formal-stopped-retire:sg_r1_20260928_32721:23a2419605be82e9bf0b6c359a501bc47b0c2b1015e7b9de8ceb5d88c03f7c62:complete',
  featureProfile:plan.featureProfile,stateWriteMode:'versioned-delta-v1',activation:plan.countAllocation,planHash:hash(plan)};return {plan,profile};}
test('new mixed allocation preserves original total and binds the settled parent and delta mode',()=>{
 const {plan,profile}=fixture();assert.deepEqual(pyramidsMixedRepairPlan(base,profile),plan);assert.deepEqual(applyFormalCount(plans,profile)[32721],plan);
 assert.equal(profile.remainingComplete+profile.completePreserved+profile.historicalBaseline,300000);
});
test('unknown parent quota expansion layout or unbound optimization cannot enter',()=>{
 for(const [key,value]of Object.entries({completePreserved:0,remainingComplete:300000,historicalBaseline:0,totalTarget:600000,maxSequence:600001,
  oldProfileHash:'b'.repeat(64),sourceRun:'999:1',sourceCommit:'c'.repeat(40),retirementKey:'other',featureProfile:'pyramids-free-major-v1',stateWriteMode:undefined,activation:'bad'})){
  const {profile}=fixture();profile[key]=value;assert.throws(()=>pyramidsMixedRepairPlan(base,profile),key);
 }
 for(const key of ['demoGeneration','sessionLayout']){const {profile,plan}=fixture(),modified={...plan,[key]:'x'};profile.planHash=hash(modified);assert.throws(()=>pyramidsMixedRepairPlan({...base,[key]:'x'},profile));}
});
