import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {ACTION_BUDGET_CONTINUOUS_RUNTIME,checkActionContinuousRevision,actionContinuousWindow} from './action-continuous-runtime.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';
import {stateWriteInitializer} from './state-write-binding.mjs';

const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-budget-20261002.json','utf8'));
const plan=applyFormalCount(JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),profile)[32721];
function fixture(){
 const commit='a'.repeat(40),previous='e77f7ce345f40f063819dcbce3fc77e27f5ce3d0';
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'continuous-action-budget-v1',
  gameId:32721,activation:profile.activation,profileHash:hash(profile),planHash:hash(plan),
  sourceRun:'36979713737:1',fromCommit:previous,completePreserved:51593,remainingComplete:248257,
  newBetAllowance:0,sourceRequests:0,captureMinutes:15,maxWorkers:20,lanesPerHost:1,
  requiresNewSession:true,automaticRelay:false,actionContractHash:profile.actionContractHash,
  actionResourceBudget:profile.actionResourceBudget,controlReadMode:profile.controlReadMode,
  stateWriteMode:profile.stateWriteMode,gatewayHash:profile.gatewayHash};
 const spec={schema:'sg-complete-count-v1',commit:previous,activation:profile.activation,
  profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,gameId:32721,
  target:plan.target,sourceRecordsHash:profile.recordsHash};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit:previous,
  profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,sourceRequests:0,
  completePreserved:49593,remainingComplete:250257};
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:previous,previousCommit:previous,
  specHash:hash(spec),profileHash:hash(profile),planHash:hash(plan),activation:profile.activation,
  revisionHash:hash(revision),sourceRun:revision.sourceRun,completePreserved:51593,
  remainingComplete:248257,sourceRequests:0,newBetAllowance:0};
 const permit={schema:'sg-count-run-v1',run:'99:1',commit,activation:profile.activation,
  profileHash:hash(profile),runtimeRevisionHash:hash(revision),completeBefore:51593,
  remainingComplete:248257,createdAt:1000,expiresAt:901000};
 return {plan,profile,revision,spec,complete,receipt,permit,commit,run:'99:1'};
}
test('budget continuation preserves the applied activation and binds its real successful canary',async()=>{
 const f=fixture(),control={},calls=[],key=`complete-count:${plan.trialId}:${profile.activation}`;
 const docs=new Map([[key,f.spec],[key+':complete',f.complete],[`count-runtime:${plan.trialId}:${profile.activation}:${f.commit}`,f.receipt]]);
 const store={get:async(c,k)=>docs.has(k)?{value:docs.get(k)}:null,
  transport:{request:async op=>{calls.push(op);return {group:'secondary',captureLogicOnServer:false,stateDeltaEnabled:true};}}};
 await compactControlInitializer({plan,runtimeName:ACTION_BUDGET_CONTINUOUS_RUNTIME,commit:f.commit,
  resourceReady:Promise.resolve(),control,readRevision:()=>f.revision,readProfile:()=>profile,
  readReceipt:async k=>(await store.get('journal',k))?.value})();
 assert.equal(control.compact,true);
 assert.equal(await stateWriteInitializer({store,commit:f.commit,group:'secondary',
  runtimeName:ACTION_BUDGET_CONTINUOUS_RUNTIME,readProfile:()=>profile,readRevision:()=>f.revision})(plan),true);
 assert.deepEqual(calls,['hello']);
 assert.equal(actionContinuousWindow({...f,now:900999}).capture,true);
 assert.equal(actionContinuousWindow({...f,now:901000}).capture,false);
});
test('budget continuation rejects reused old parents, expanded lanes, quota, deadline and resource limits',()=>{
 for(const [key,value] of Object.entries({purpose:'continuous-action-v1',sourceRun:'36973608232:1',
  fromCommit:'b'.repeat(40),completePreserved:51594,remainingComplete:248258,newBetAllowance:1,
  captureMinutes:240,maxWorkers:40,lanesPerHost:2,automaticRelay:true,
  actionResourceBudget:{maxFrames:2048,maxRawBytes:4194304}})){
  const f=fixture();f.revision[key]=value;assert.throws(()=>checkActionContinuousRevision(f),undefined,key);
 }
 const f=fixture();f.permit.expiresAt++;assert.throws(()=>actionContinuousWindow({...f,now:1001}));
});

test('actual workflow selects only the independent continuous admission and fifteen-minute worker deadline',()=>{
 const require=createRequire(process.cwd()+'/collector/package.json'),yaml=require('js-yaml');
 const source=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
 const maintenance=yaml.load(fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8'));
 assert(source.on.workflow_dispatch.inputs.runtime_profile.options.includes(ACTION_BUDGET_CONTINUOUS_RUNTIME));
 assert(maintenance.on.workflow_dispatch.inputs.runtime_profile.options.includes(ACTION_BUDGET_CONTINUOUS_RUNTIME));
 const inputs={formal_profile:'formal-repair-pyramids-action-budget-20261002.json',runtime_profile:ACTION_BUDGET_CONTINUOUS_RUNTIME};
 const evaluate=value=>Function('return ('+value.replace(/inputs\.(\w+)/g,(m,key)=>JSON.stringify(inputs[key]))+')')();
 const admissions=source.jobs['pyramids-formal-admit'].steps.filter(s=>s.run?.endsWith(' admit')&&s.if&&evaluate(s.if));
 assert.equal(admissions.length,1);assert.equal(admissions[0].run,'node scripts/runner-v2/action-continuous-control.mjs admit');
 const expression=source.jobs['pyramids-formal-capture'].env.SG_TRIAL_MINUTES.slice(3,-2).trim();
 assert.equal(evaluate(expression),'15');
 inputs.runtime_profile='none';assert.equal(evaluate(expression),'5');
});
