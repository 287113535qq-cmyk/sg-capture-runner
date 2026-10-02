import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_BUDGET_PROFILE,ACTION_BUDGET_CANARY,ACTION_RESOURCE_BUDGET,pyramidsActionBudgetPlan} from './pyramids-action-budget-profile.mjs';
import {budgetCanaryWindow,checkBudgetCanaryInputs,admitBudgetCanary,claimBudgetCanaryWorker} from './action-budget-canary.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';import {stateWriteInitializer} from './state-write-binding.mjs';
import {observeBudgetWindow} from './action-budget-observation.mjs';import {BatchController} from './batch-controller.mjs';
import {createRequire} from 'node:module';
function fixture(){
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json'))[32721],old=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-20261002.json'));
 const closed=JSON.parse(fs.readFileSync('docs/ag-action-flowbudget-close-result-20261002.json')),at=1000000,commit='d'.repeat(40);
 const profile={...old,schema:'sg-formal-action-budget-profile-v1',activation:'b'.repeat(64),completePreserved:49593,remainingComplete:250257,
  sourceAllowance:0,oldProfileHash:hash(old),sourceRun:'36973608232:1',sourceCommit:'9aafef9ac94300c02ce74bb83db7eb97dfcef00d',
  retirementKey:'count-shared-close:'+base.trialId+':36973608232:1:complete',retirementHash:closed.closureHash,
  nativeRetirementHash:closed.retirementHash,closureProfileHash:closed.profileHash,recordsHash:closed.recordsHash,
  oldSpecHash:'21e39490c85e4653474db892a6485cf21ad9865ef08ea65afdffbf36823d8307',actionResourceBudget:{...ACTION_RESOURCE_BUDGET},
  canary:{...ACTION_BUDGET_CANARY},createdAt:at,expiresAt:at+7200000};
 profile.planHash=hash({...base,countAllocation:profile.activation,featureProfile:profile.featureProfile,actionContractHash:profile.actionContractHash,
  maxSteps:1026,actionResourceBudget:profile.actionResourceBudget});const plan=pyramidsActionBudgetPlan(base,profile);
 const item={id:1,worker:20,start:1,end:60000,sessionHash:'a'.repeat(64),closed:true,complete:49593,evidenceHash:'c'.repeat(64)};
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),profileHash:hash(profile),gameId:32721,
  trialId:plan.trialId,target:plan.target,maxSequence:600000,firstSequence:60001,baselineBatchCount:1,baselineHash:hash([item]),
  sourceRecordsHash:profile.recordsHash,historyReuse:{closureHash:profile.retirementHash,complete:49593,rawRecordsRead:0,historicalReadbackFresh:false}};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit,profileHash:hash(profile),planHash:hash(plan),
  trialId:plan.trialId,completePreserved:49593,remainingComplete:250257,sourceRequests:0};
 const pool={enabled:true,failure:null,confirmed:49593,nextBatchId:2,nextSequence:60001,workers:{},
  countAllocation:{specHash:hash(spec),reserved:0,batches:{1:item}}};
 const campaign={enabled:true,group:'secondary',activeGame:32721,formalCount:{activation:profile.activation,profileHash:hash(profile)}};
 const key='complete-count:'+plan.trialId+':'+profile.activation,docs=new Map([[key,spec],[key+':complete',complete],['pool:'+plan.trialId,pool],['campaign',campaign]]);
 const store={get:async(c,k)=>docs.has(k)?{value:structuredClone(docs.get(k))}:null,writable:async()=>{},
  create:async(c,k,v)=>{assert(!docs.has(k));docs.set(k,structuredClone(v));},
  transport:{request:async(op,r)=>{if(op==='hello')return {group:'secondary',captureLogicOnServer:false,stateDeltaEnabled:true};
   assert.equal(op,'create');if(docs.has(r.key))return {created:false};docs.set(r.key,structuredClone(r.value));return {created:true};}}};
 return {base,profile,plan,spec,complete,commit,store,docs,pool,campaign,run:'123:1',now:()=>at,boundary:async()=>{}};
}
test('budget canary admits one immutable source run and keeps the inherited remaining count',async()=>{
 const f=fixture(),before=hash({pool:f.pool,c:f.campaign}),permit=await admitBudgetCanary(f);
 const proof={...f,permit};assert.equal(budgetCanaryWindow({...proof,now:f.now()}).capture,true);
 assert.equal(budgetCanaryWindow({...proof,now:permit.expiresAt}).capture,false);
 await assert.rejects(admitBudgetCanary({...f,run:'124:1'}),/ALREADY_CLAIMED/);
 assert.equal(hash({pool:f.pool,c:f.campaign}),before);
 for(const [key,value]of Object.entries({expiresAt:permit.expiresAt+1,maxPaidRequests:2001,remainingComplete:300000,canaryContractHash:'a'.repeat(64)}))
  assert.throws(()=>budgetCanaryWindow({...proof,permit:{...permit,[key]:value},now:f.now()}));
 const identity={shardId:20,commitSha:f.commit,planHash:hash(f.plan),sessionHash:'a'.repeat(64)};
 const args={store:f.store,proof,identity,now:f.now()};
 const attempts=await Promise.allSettled([claimBudgetCanaryWorker(args),claimBudgetCanaryWorker(args)]);
 assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
 await assert.rejects(claimBudgetCanaryWorker({...args,identity:{...identity,shardId:40}}),/WORKER/);
});
test('budget canary real controller finishes before a second batch claim',async()=>{
 const f=fixture(),c=new BatchController({store:f.store,transport:{},gate:{},analyzer:{},spool:{append(){},confirmed(){}},
  control:{allowed(){throw Error('SECOND_ADMISSION');}},plan:f.plan,group:'secondary',commit:f.commit});
 c.lease={owner:'worker',epoch:1,worker:20};c.actionCanaryProof={profile:f.profile};c.actionCanaryBatchTaken=true;
 c.pool.release=async()=>{};c.pool.take=async()=>{throw Error('SECOND_ALLOCATION');};
 assert.deepEqual(await c.rpc('next',{owner:'worker',workerEpoch:1,shardId:20}),{done:true});
});
test('actual compact and delta initializers bind the new activation without reusing old runtime receipts',async()=>{
 const f=fixture(),control={};
 await compactControlInitializer({...f,control,resourceReady:Promise.resolve(),readProfile:()=>f.profile,
  readReceipt:async k=>(await f.store.get('journal',k))?.value})();assert.equal(control.compact,true);
 assert.equal(await stateWriteInitializer({...f,group:'secondary',readProfile:()=>f.profile})(f.plan),true);
 assert.equal(f.store.deltaCas,true);
});
test('resource observer samples until its full window with no source or database calls',async()=>{
 let at=0,calls=0;const result=await observeBudgetWindow({endMs:300000,now:()=>at,sleep:async ms=>{at+=ms;},
  sample:async()=>{calls++;return {allowed:true};}});
 assert.equal(result.observationFinished,true);assert.equal(calls,30);assert.equal(result.sourceRequests,0);assert.equal(result.databaseWrites,0);
 const stopped=await observeBudgetWindow({endMs:at+300000,now:()=>at,shouldStop:()=>true,sample:async()=>{throw Error('NO_SAMPLE');}});
 assert.equal(stopped.observationFinished,false);
 await assert.rejects(observeBudgetWindow({endMs:at+300000,now:()=>at,sample:async()=>{throw Error('MISSING_RESOURCE');}}),/MISSING_RESOURCE/);
});
test('budget dispatch refuses relay, old runtimes and changed allocation inputs',()=>{
 const inputs={role:'formal-count',allocation:'round-one',round_one_limit:'0',formal_profile:ACTION_BUDGET_PROFILE,
  runtime_profile:'none',formal_relay:'none',relay_parent:''};checkBudgetCanaryInputs(inputs);
 for(const [k,v]of Object.entries({runtime_profile:'count-runtime-pyramids-action-canary-20261002.json',formal_relay:'same-allocation-v1',relay_parent:'123:1',round_one_limit:'5'}))
  assert.throws(()=>checkBudgetCanaryInputs({...inputs,[k]:v}));
});
test('workflow selects exactly the bounded budget admission and actual worker time limit',()=>{
 const require=createRequire(process.cwd()+'/collector/package.json'),yaml=require('js-yaml');
 const source=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
 const maintenance=yaml.load(fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8'));
 assert(source.on.workflow_dispatch.inputs.formal_profile.options.includes(ACTION_BUDGET_PROFILE));
 assert(maintenance.on.workflow_dispatch.inputs.repair_profile.options.includes(ACTION_BUDGET_PROFILE));
 const job=source.jobs['pyramids-formal-admit'];assert(job.if.includes(ACTION_BUDGET_PROFILE));
 const bounded=job.steps.filter(s=>s.if?.includes(ACTION_BUDGET_PROFILE));assert.equal(bounded.length,1);
 assert.equal(bounded[0].run,'node scripts/runner-v2/pyramids-repair-control.mjs admit');
 assert(bounded[0].if.includes("inputs.runtime_profile == 'none'"));
 const capture=source.jobs['pyramids-formal-capture'];assert.equal(capture.strategy['max-parallel'],20);
 assert(capture.env.SG_TRIAL_MINUTES.includes("inputs.formal_profile == '"+ACTION_BUDGET_PROFILE+"' && '5'"));
 assert(maintenance.jobs['pyramids-repair'].if.includes(ACTION_BUDGET_PROFILE));
});
