import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {pyramidsSuperHoldRepairPlan} from './pyramids-super-hold-repair-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {formalCountProfilePath} from './formal-count-plan.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
function fixture(){const plan={...base,countAllocation:'a'.repeat(64),featureProfile:'pyramids-super-hold-cash-v1'};
 const profile={schema:'sg-formal-repair-pyramids-v6',gameId:32721,group:'secondary',workerOffset:20,basePlanHash:hash(base),
  completePreserved:5111,remainingComplete:294739,historicalBaseline:150,totalTarget:300000,maxSequence:600000,
  sessionRotation:'closed-batches-v1',oldProfileHash:'f9fe107deffc81d8ebc86a00d9819987001e599bfe115890e4705f3bc8eb82a8',
  sourceRun:'36941485498:1',sourceCommit:'6a9d39684e1433cbba1c361044f57c8ee25787d3',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:36941485498:1:complete',
  featureProfile:plan.featureProfile,controlReadMode:'compact-worker-v1',gatewayHash:'a40d94a60d8133f3d4cd4fb384610712c60676f94b82c7615289cd4cae4f690e',recordsHash:'4fb9e24fb9ded80ff45904791293a52742aa2a063572f83529b83d5611675d6a',stateWriteMode:'versioned-delta-v1',activation:plan.countAllocation,planHash:hash(plan)};return {plan,profile};}
test('new mixed allocation preserves original total and binds the settled parent and delta mode',()=>{
 const {plan,profile}=fixture();assert.deepEqual(pyramidsSuperHoldRepairPlan(base,profile),plan);assert.deepEqual(applyFormalCount(plans,profile)[32721],plan);
 assert.equal(profile.remainingComplete+profile.completePreserved+profile.historicalBaseline,300000);
});
test('explicit new entry binds the closed source and never retires or rewrites a parent',()=>{
 const name='formal-repair-pyramids-super-hold-20261002.json';
 assert.equal(formalCountProfilePath({SG_FORMAL_COUNT_PROFILE:name}),'config/'+name);
 const entry=pyramidsRepairEntry('activate',name);
 assert.equal(entry.oldName,'formal-repair-pyramids-fifteen-20261002.json');
 assert.equal(entry.sourceId,36941485498);assert(entry.v6);
 assert.throws(()=>pyramidsRepairEntry('retire',name));
});
test('unknown parent quota expansion layout or unbound optimization cannot enter',()=>{
 for(const [key,value]of Object.entries({completePreserved:0,remainingComplete:300000,historicalBaseline:0,totalTarget:600000,maxSequence:600001,
  oldProfileHash:'b'.repeat(64),sourceRun:'999:1',sourceCommit:'c'.repeat(40),retirementKey:'other',featureProfile:'pyramids-free-major-v1',stateWriteMode:undefined,activation:'bad'})){
  const {profile}=fixture();profile[key]=value;assert.throws(()=>pyramidsSuperHoldRepairPlan(base,profile),key);
 }
 for(const key of ['demoGeneration','sessionLayout']){const {profile,plan}=fixture(),modified={...plan,[key]:'x'};profile.planHash=hash(modified);assert.throws(()=>pyramidsSuperHoldRepairPlan({...base,[key]:'x'},profile));}
});
