import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsDirectActionPlan,ACTION_RESOURCE_BUDGET,DIRECT_ACTION_CANARY} from './pyramids-direct-action-profile.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-direct-action-protocol.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';

test('independent JS and Python resource plans bind actual closure without changing old authorization',()=>{
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
 const old=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-budget-20261002.json','utf8'));
 const closed=JSON.parse(fs.readFileSync('docs/ag-action-layered-close-20261002-result.json','utf8'));
 const before=hash(old),p={...old,schema:'sg-formal-direct-action-profile-v1',activation:'b'.repeat(64),
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,completePreserved:closed.completePreserved,remainingComplete:base.target-closed.completePreserved,sourceAllowance:0,
  oldProfileHash:before,sourceRun:'36983664943:1',sourceCommit:'a4708c41fc9cf263cc1ca8849d2c4c8d9357e0b5',
  retirementKey:'count-shared-close:'+base.trialId+':36983664943:1:complete',retirementHash:closed.closureHash,
  nativeRetirementHash:closed.retirementHash,closureProfileHash:closed.profileHash,recordsHash:closed.recordsHash,
  oldSpecHash:'e15d9b016f8ea3e183899779483b555b185ce70d49172c5811038c3c1006a111',actionResourceBudget:{...ACTION_RESOURCE_BUDGET},canary:{...DIRECT_ACTION_CANARY}};
 p.planHash=hash({...base,countAllocation:p.activation,featureProfile:p.featureProfile,actionContractHash:p.actionContractHash,
  maxSteps:1026,actionResourceBudget:p.actionResourceBudget});
 const approved=pyramidsDirectActionPlan(base,p);assert.equal(approved.maxSteps,1026);
 assert.equal(applyFormalCount(plans,p)[32721].maxSteps,1026);assert.equal(applyFormalCount(plans,old)[32721].maxSteps,1026);
 const cases=[{base,p,accepted:true}];
 for(const [key,value] of Object.entries({completePreserved:132847,remainingComplete:167005,sourceAllowance:1,
  sourceRun:'36973608233:1',retirementHash:'a'.repeat(64),nativeRetirementHash:'a'.repeat(64),oldSpecHash:'a'.repeat(64),
  stateWriteMode:'full',classificationMode:'inline',oldProfileHash:'a'.repeat(64),planHash:'a'.repeat(64),
  canary:{...DIRECT_ACTION_CANARY,maxPaidRequests:2001},actionResourceBudget:{maxFrames:2048,maxRawBytes:4194304}})){
  const bad={...p,[key]:value};assert.throws(()=>pyramidsDirectActionPlan(base,bad),undefined,key);cases.push({base,p:bad,accepted:false});
 }
 const script="import sys,json\nsys.path.insert(0,'service')\nfrom pyramids_direct_action_plan import pyramids_direct_action_plan\nfor c in json.load(sys.stdin):\n try:\n  result=pyramids_direct_action_plan(c['base'],c['p']); ok=True\n except Exception: ok=False\n assert ok==c['accepted']\nprint('independent plan cases passed')";
 const result=spawnSync(process.env.PYTHON??'python',['-B','-c',script],{input:JSON.stringify(cases),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(result.status,0,result.stderr);assert.equal(hash(old),before);
});
