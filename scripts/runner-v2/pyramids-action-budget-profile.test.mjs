import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsActionBudgetPlan,ACTION_RESOURCE_BUDGET} from './pyramids-action-budget-profile.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';

test('independent JS and Python resource plans bind actual closure without changing old authorization',()=>{
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32721];
 const old=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-20261002.json','utf8'));
 const closed=JSON.parse(fs.readFileSync('docs/ag-action-flowbudget-close-result-20261002.json','utf8'));
 const before=hash(old),p={...old,schema:'sg-formal-action-budget-profile-v1',activation:'b'.repeat(64),
  completePreserved:closed.completePreserved,remainingComplete:base.target-closed.completePreserved,sourceAllowance:0,
  oldProfileHash:before,sourceRun:'36973608232:1',sourceCommit:'9aafef9ac94300c02ce74bb83db7eb97dfcef00d',
  retirementKey:'count-shared-close:'+base.trialId+':36973608232:1:complete',retirementHash:closed.closureHash,
  nativeRetirementHash:closed.retirementHash,closureProfileHash:closed.profileHash,recordsHash:closed.recordsHash,
  oldSpecHash:'21e39490c85e4653474db892a6485cf21ad9865ef08ea65afdffbf36823d8307',actionResourceBudget:{...ACTION_RESOURCE_BUDGET}};
 p.planHash=hash({...base,countAllocation:p.activation,featureProfile:p.featureProfile,actionContractHash:p.actionContractHash,
  maxSteps:1026,actionResourceBudget:p.actionResourceBudget});
 const approved=pyramidsActionBudgetPlan(base,p);assert.equal(approved.maxSteps,1026);
 assert.equal(applyFormalCount(plans,p)[32721].maxSteps,1026);assert.equal(applyFormalCount(plans,old)[32721].maxSteps,100);
 const cases=[{base,p,accepted:true}];
 for(const [key,value] of Object.entries({completePreserved:49594,remainingComplete:250258,sourceAllowance:1,
  sourceRun:'36973608233:1',retirementHash:'a'.repeat(64),nativeRetirementHash:'a'.repeat(64),oldSpecHash:'a'.repeat(64),
  stateWriteMode:'full',classificationMode:'inline',oldProfileHash:'a'.repeat(64),planHash:'a'.repeat(64),
  actionResourceBudget:{maxFrames:2048,maxRawBytes:4194304}})){
  const bad={...p,[key]:value};assert.throws(()=>pyramidsActionBudgetPlan(base,bad),undefined,key);cases.push({base,p:bad,accepted:false});
 }
 const script="import sys,json\nsys.path.insert(0,'service')\nfrom pyramids_action_budget_plan import pyramids_action_budget_plan\nfor c in json.load(sys.stdin):\n try:\n  result=pyramids_action_budget_plan(c['base'],c['p']); ok=True\n except Exception: ok=False\n assert ok==c['accepted']\nprint('independent plan cases passed')";
 const result=spawnSync(process.env.PYTHON??'python',['-B','-c',script],{input:JSON.stringify(cases),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(result.status,0,result.stderr);assert.equal(hash(old),before);
});
