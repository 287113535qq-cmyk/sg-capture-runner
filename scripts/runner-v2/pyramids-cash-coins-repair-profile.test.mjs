import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pyramidsCashCoinsRepairPlan} from './pyramids-cash-coins-repair-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {formalCountProfilePath} from './formal-count-plan.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
function fixture(){const plan={...base,countAllocation:'a'.repeat(64),featureProfile:'pyramids-cash-coins-v1'};
 const profile={schema:'sg-formal-repair-pyramids-v9',gameId:32721,group:'secondary',workerOffset:20,basePlanHash:hash(base),
  completePreserved:7503,remainingComplete:292347,historicalBaseline:150,totalTarget:300000,maxSequence:600000,
  sessionRotation:'closed-batches-v1',oldProfileHash:'9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34',
  sourceRun:'36955443358:1',sourceCommit:'3a4efb77f104cb23306b635ccfdddbd1daa5340d',
  retirementKey:'count-parked-close:sg_r1_20260928_32721:36955443358:1:complete',
  featureProfile:plan.featureProfile,controlReadMode:'compact-worker-v1',gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash:'11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6',stateWriteMode:'versioned-delta-v1',activation:plan.countAllocation,planHash:hash(plan)};return {plan,profile};}
test('new mixed allocation preserves original total and binds the settled parent and delta mode',()=>{
 const {plan,profile}=fixture();assert.deepEqual(pyramidsCashCoinsRepairPlan(base,profile),plan);assert.deepEqual(applyFormalCount(plans,profile)[32721],plan);
 assert.equal(profile.remainingComplete+profile.completePreserved+profile.historicalBaseline,300000);
});
test('explicit new entry binds the closed source and never retires or rewrites a parent',()=>{
 const name='formal-repair-pyramids-cash-coins-20261002.json';
 assert.equal(formalCountProfilePath({SG_FORMAL_COUNT_PROFILE:name}),'config/'+name);
 const entry=pyramidsRepairEntry('activate',name);
 assert.equal(entry.oldName,'formal-repair-pyramids-retrigger-20261002.json');
 assert.equal(entry.sourceId,36955443358);assert(entry.v9);
 assert.throws(()=>pyramidsRepairEntry('retire',name));
});
test('unknown parent quota expansion layout or unbound optimization cannot enter',()=>{
 for(const [key,value]of Object.entries({completePreserved:0,remainingComplete:300000,historicalBaseline:0,totalTarget:600000,maxSequence:600001,
  oldProfileHash:'b'.repeat(64),sourceRun:'999:1',sourceCommit:'c'.repeat(40),retirementKey:'other',featureProfile:'pyramids-free-major-v1',stateWriteMode:undefined,activation:'bad'})){
  const {profile}=fixture();profile[key]=value;assert.throws(()=>pyramidsCashCoinsRepairPlan(base,profile),key);
 }
 for(const key of ['demoGeneration','sessionLayout']){const {profile,plan}=fixture(),modified={...plan,[key]:'x'};profile.planHash=hash(modified);assert.throws(()=>pyramidsCashCoinsRepairPlan({...base,[key]:'x'},profile));}
});
