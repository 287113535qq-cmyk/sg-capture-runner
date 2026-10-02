import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pyramidsActionRepairPlan} from './pyramids-action-repair-profile.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-action-protocol.mjs';
import {applyFormalCount,formalCountProfilePath} from './formal-count-plan.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
function fixture(){
 const plan={...base,countAllocation:'a'.repeat(64),featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH};
 const profile={...JSON.parse(fs.readFileSync('config/formal-repair-pyramids-super-coins-20261002.json','utf8')),
  schema:'sg-formal-action-profile-v1',basePlanHash:hash(base),completePreserved:16913,remainingComplete:282937,
  oldProfileHash:'758c973008b947c479c083b7eae4d1592fd23ae16022891162a17f1e015dc094',
  sourceRun:'36963756989:1',sourceCommit:'4c22abda58d86233776496c2d05942a9a4ef5a62',
  retirementKey:'count-shared-close:sg_r1_20260928_32721:36963756989:1:complete',
  retirementHash:'cf8acdd48080eb818de3afc2a3ccdf4667e91f90c1b65b0a918ee1360d4b1517',
  recordsHash:'493099eb67e9e5ef20346762ba3098707adda51460a4e6f4dbc256a62cc091e4',
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,classificationMode:'independent-journal',
  activation:plan.countAllocation,planHash:hash(plan)};
 return {plan,profile};
}
function independent(profile){const r=spawnSync(process.env.PYTHON??'python',['-B','-c',
 "import sys,json;sys.path.insert(0,'service');from pyramids_action_plan import pyramids_action_plan;q=json.load(sys.stdin);print(json.dumps(pyramids_action_plan(q['base'],q['profile'])))"],
 {input:JSON.stringify({base,profile}),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});return r;}
test('independent plans preserve closed evidence and remaining allocation without overwriting applied parents',()=>{
 const {plan,profile}=fixture();assert.deepEqual(pyramidsActionRepairPlan(base,profile),plan);
 assert.deepEqual(applyFormalCount(plans,profile)[32721],plan);
 const py=independent(profile);assert.equal(py.status,0,py.stderr);assert.deepEqual(JSON.parse(py.stdout),plan);
 assert.equal(profile.completePreserved+profile.remainingComplete+profile.historicalBaseline,300000);
 const name='formal-repair-pyramids-action-20261002.json';assert.equal(formalCountProfilePath({SG_FORMAL_COUNT_PROFILE:name}),'config/'+name);
 const entry=pyramidsRepairEntry('activate',name);assert(entry.action);assert.equal(entry.sourceId,36963756989);
 assert.throws(()=>pyramidsRepairEntry('retire',name));
});
test('both admission implementations reject changed closure quota contract and classification authority',()=>{
 for(const [k,v]of Object.entries({completePreserved:0,remainingComplete:300000,historicalBaseline:0,totalTarget:600000,
  retirementHash:'b'.repeat(64),recordsHash:'b'.repeat(64),sourceRun:'1:1',oldProfileHash:'b'.repeat(64),
  classificationMode:'inline',actionContractHash:'b'.repeat(64),activation:'bad'})){
  const {profile}=fixture();profile[k]=v;assert.throws(()=>pyramidsActionRepairPlan(base,profile),k);
  assert.notEqual(independent(profile).status,0,k);
 }
});
