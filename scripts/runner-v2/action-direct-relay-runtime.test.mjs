import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DIRECT_ACTION_CANARY,ACTION_RESOURCE_BUDGET,pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/pyramids-direct-action-protocol.mjs';
import {admitBudgetCanary} from './action-budget-canary.mjs';
import {checkDirectRelayRevision,checkDirectRelayResource,refreshDirectRelayRuntime,admitDirectRelay,directRelayWindow,relayDirectActionRun} from './action-direct-relay-runtime.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';
import {stateWriteInitializer} from './state-write-binding.mjs';
import {createRequire} from 'node:module';
function fixture(){
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json'))[32721],old=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-budget-20261002.json'));
 const closed=JSON.parse(fs.readFileSync('docs/ag-action-layered-close-20261002-result.json')),at=1000000,commit='d'.repeat(40);
 const profile={...old,schema:'sg-formal-direct-action-profile-v1',activation:'b'.repeat(64),completePreserved:132846,remainingComplete:167004,
  featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH,sourceAllowance:0,oldProfileHash:hash(old),sourceRun:'36983664943:1',sourceCommit:'a4708c41fc9cf263cc1ca8849d2c4c8d9357e0b5',
  retirementKey:'count-shared-close:'+base.trialId+':36983664943:1:complete',retirementHash:closed.closureHash,
  nativeRetirementHash:closed.retirementHash,closureProfileHash:closed.profileHash,recordsHash:closed.recordsHash,
  oldSpecHash:'e15d9b016f8ea3e183899779483b555b185ce70d49172c5811038c3c1006a111',actionResourceBudget:{...ACTION_RESOURCE_BUDGET},
  canary:{...DIRECT_ACTION_CANARY},createdAt:at,expiresAt:at+7200000};
 profile.planHash=hash({...base,countAllocation:profile.activation,featureProfile:profile.featureProfile,actionContractHash:profile.actionContractHash,
  maxSteps:1026,actionResourceBudget:profile.actionResourceBudget});const plan=pyramidsDirectActionPlan(base,profile);
 const item={id:1,worker:20,start:1,end:160000,sessionHash:'a'.repeat(64),closed:true,complete:132846,evidenceHash:'c'.repeat(64)};
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),profileHash:hash(profile),gameId:32721,
  trialId:plan.trialId,target:plan.target,maxSequence:600000,firstSequence:160001,baselineBatchCount:1,baselineHash:hash([item]),
  sourceRecordsHash:profile.recordsHash,historyReuse:{closureHash:profile.retirementHash,complete:132846,rawRecordsRead:0,historicalReadbackFresh:false}};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit,profileHash:hash(profile),planHash:hash(plan),
  trialId:plan.trialId,completePreserved:132846,remainingComplete:167004,sourceRequests:0};
 const pool={enabled:true,failure:null,confirmed:132846,nextBatchId:2,nextSequence:160001,workers:{},
  countAllocation:{specHash:hash(spec),reserved:0,batches:{1:item}}};
 const campaign={enabled:true,group:'secondary',activeGame:32721,formalCount:{activation:profile.activation,profileHash:hash(profile)}};
 const key='complete-count:'+plan.trialId+':'+profile.activation,docs=new Map([[key,spec],[key+':complete',complete],['pool:'+plan.trialId,pool],['campaign',campaign]]);
 const store={get:async(c,k)=>docs.has(k)?{value:structuredClone(docs.get(k))}:null,writable:async()=>{},
  create:async(c,k,v)=>{assert(!docs.has(k));docs.set(k,structuredClone(v));},
  transport:{request:async(op,r)=>{if(op==='hello')return {group:'secondary',captureLogicOnServer:false,stateDeltaEnabled:true};
   assert.equal(op,'create');if(docs.has(r.key))return {created:false};docs.set(r.key,structuredClone(r.value));return {created:true};}}};
 return {base,profile,plan,spec,complete,commit,store,docs,pool,campaign,run:'123:1',now:()=>at,boundary:async()=>{}};
}

async function relayFixture(){
 const f=fixture();let at=f.now();f.now=()=>at;f.advance=ms=>{at+=ms;};
 const b={id:1,worker:20,start:1,end:160000,sessionHash:'a'.repeat(64),pending:null,
  checkpoint:132846,journaled:132846,leaseUntil:0};
 f.docs.set(`batch:${f.plan.trialId}:1`,b);f.pool.countAllocation.batches[1].evidenceHash=hash(b);
 f.spec.sessionRotation='closed-batches-v1';f.spec.baselineHash=hash([f.pool.countAllocation.batches[1]]);
 f.complete.specHash=hash(f.spec);f.pool.countAllocation.specHash=hash(f.spec);
 f.store.getMany=async(c,keys)=>{assert(keys.length<=100);return Promise.all(keys.map(k=>f.store.get(c,k)));};
 const permit=await admitBudgetCanary(f);f.canaryPermit=permit;
 f.docs.set(`action-budget-canary-run:${f.plan.trialId}:${f.profile.activation}`,
  {schema:'sg-action-budget-canary-run-v1',run:f.run,commit:f.commit,profileHash:hash(f.profile),sourceRequests:0});
 const addBatch=(size)=>{
  const id=f.pool.nextBatchId,start=f.pool.nextSequence,sessionHash=String(id).padStart(64,'0');
  const batch={id,worker:20,start,end:start+size-1,sessionHash,pending:null,leaseUntil:0,
   checkpoint:start+size-1,journaled:start+size-1};
  const key=`count-settlement:${f.plan.trialId}:${f.profile.activation}:${id}`;
  const receipt={schema:'sg-count-batch-settlement-v1',activation:f.profile.activation,
   trialId:f.plan.trialId,fullReadback:true,batch};
  f.docs.set(`batch:${f.plan.trialId}:${id}`,batch);f.docs.set(key,receipt);
  f.pool.countAllocation.batches[id]={id,worker:20,start,end:batch.end,sessionHash,closed:true,
   complete:size,settlementKey:key,evidenceHash:hash(receipt)};
  f.pool.nextBatchId++;f.pool.nextSequence=batch.end+1;f.pool.confirmed+=size;
 };
 addBatch(2000);f.addBatch=addBatch;f.advance(600001);
 const sourceCommit=f.commit;f.commit='e'.repeat(40);
 f.revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'direct-action-relay-v1',gameId:32721,
  profileHash:hash(f.profile),planHash:hash(f.plan),activation:f.profile.activation,sourceRun:f.run,
  fromCommit:sourceCommit,sourcePermitHash:hash(permit),poolHash:hash(f.pool),campaignHash:hash(f.campaign),
  completePreserved:f.pool.confirmed,remainingComplete:f.plan.target-f.pool.confirmed,
  captureMinutes:15,tailCaptureMinutes:5,maxRunWindows:2,maxWorkers:20,lanesPerHost:1,automaticRelay:true,
  requiresNewSession:true,sourceRequests:0,newBetAllowance:0,actionContractHash:f.profile.actionContractHash,
  actionResourceBudget:f.profile.actionResourceBudget,controlReadMode:f.profile.controlReadMode,
  stateWriteMode:f.profile.stateWriteMode,gatewayHash:f.profile.gatewayHash,createdAt:at,expiresAt:at+7200000};
 f.ended={id:123,run_attempt:1,head_sha:sourceCommit,status:'completed',conclusion:'success',event:'workflow_dispatch',
  repository:{full_name:'287113535qq-cmyk/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 f.jobs={total_count:20,jobs:Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'success'}))};
 const receipt=await refreshDirectRelayRuntime({...f,run:'200:1'});
 f.binding={spec:f.spec,complete:f.complete,receipt};f.run='201:1';
 return f;
}
function resource(f,parent){return {schema:'sg-resource-workers-review-v1',run:parent.run,commit:f.commit,workers:20,
 verified:true,resourceEvidenceComplete:true,backendEvidenceComplete:true,hostEvidenceComplete:true,
 startMs:parent.createdAt,endMs:parent.createdAt+600000,sourceErrors:0,unknown:0,resourceHolds:0,logSha256:'f'.repeat(64)};}
async function childReady(f,parent){
 f.advance(900001);f.addBatch(1000);
 const inputs={role:'formal-count',allocation:'round-one',round_one_limit:'0',formal_profile:'formal-repair-pyramids-direct-action-20261002.json',
  runtime_profile:'count-runtime-pyramids-direct-action-relay-20261002.json',formal_relay:'same-allocation-v1'};
 const source={...f.ended,id:Number(parent.run.split(':')[0]),head_sha:f.commit,status:'in_progress',head_branch:'runtime-direct-relay'};
 const createIntent=async(k,v)=>{if(f.docs.has(k))return false;f.docs.set(k,structuredClone(v));return true;};
 let dispatched=0;
 const args={...f,inputs,source,repository:source.repository.full_name,resourceReview:resource(f,parent),
  createIntent,dispatch:async()=>{dispatched++;}};
 const result=await relayDirectActionRun(args);assert.equal(result.continued,true);assert.equal(dispatched,1);
 assert.equal((await relayDirectActionRun(args)).reason,'DISPATCH_ALREADY_ATTEMPTED');assert.equal(dispatched,1);
 f.docs.set(`count-relay:${f.plan.trialId}:${parent.run}:admit`,{schema:'sg-formal-relay-admit-v1',parentRun:parent.run,
  run:'202:1',commit:f.commit,activation:f.profile.activation});return args;
}

test('fresh healthy canary refreshes once; root and actual relay function preserve quota and stop after one tail',async()=>{
 const f=await relayFixture(),before=hash(f.pool),root=await admitDirectRelay(f);
 assert.equal(root.expiresAt-root.createdAt,900000);assert.equal(hash(f.pool),before);
 await assert.rejects(admitDirectRelay({...f,run:'203:1'}),/ALREADY_CLAIMED/);
 await childReady(f,root);
 const child=await admitDirectRelay({...f,run:'202:1',parentRun:root.run});
 assert.equal(child.expiresAt-child.createdAt,300000);assert.equal(child.rootRun,root.run);
 assert.equal(child.completeBefore,135846);assert.equal(child.remainingComplete,164004);
 assert.equal(directRelayWindow({...f,...f.binding,run:child.run,permit:child,now:child.expiresAt}).capture,false);
 assert.equal((await relayDirectActionRun({...f,source:{id:202}})).reason,'DIRECT_RELAY_WINDOW_LIMIT');
 await assert.rejects(admitDirectRelay({...f,run:'204:1',parentRun:child.run}),/WINDOW_LIMIT/);
});

test('duplicate concurrent root admission creates only one permit; unknown write acknowledgement is not retried',async()=>{
 const f=await relayFixture();
 const results=await Promise.allSettled([admitDirectRelay(f),admitDirectRelay({...f,run:'202:1'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const g=await relayFixture(),request=g.store.transport.request;
 g.store.transport.request=async(...args)=>{await request(...args);throw Error('UNKNOWN_WRITE_ACK');};
 await assert.rejects(admitDirectRelay(g),/UNKNOWN_WRITE_ACK/);
 g.store.transport.request=request;await assert.rejects(admitDirectRelay(g),/ALREADY_CLAIMED/);
 assert(!g.docs.has(`count-run:${g.plan.trialId}:${g.run}`));
});

test('child rejects live or unproved parent, missing sampling and altered readback settlement',async()=>{
 const f=await relayFixture(),root=await admitDirectRelay(f);
 await assert.rejects(admitDirectRelay({...f,run:'202:1',parentRun:root.run}),/RESOURCE/);
 await childReady(f,root);const key=`direct-action-resource:${f.plan.trialId}:${root.run}`,good=f.docs.get(key);
 for(const k of ['verified','hostEvidenceComplete','backendEvidenceComplete','resourceEvidenceComplete']){
  f.docs.set(key,{...good,[k]:false});await assert.rejects(admitDirectRelay({...f,run:'202:1',parentRun:root.run}),/RESOURCE/);
 }f.docs.set(key,good);
 f.pool.workers[20]={activeBatch:{id:4},leaseUntil:f.now()+1000};
 await assert.rejects(admitDirectRelay({...f,run:'202:1',parentRun:root.run}),/NOT_IDLE/);f.pool.workers={};
 const admitKey=`count-relay:${f.plan.trialId}:${root.run}:admit`,admit=f.docs.get(admitKey);f.docs.delete(admitKey);
 await assert.rejects(admitDirectRelay({...f,run:'202:1',parentRun:root.run}),/PARENT_FINISHED/);f.docs.set(admitKey,admit);
 const b=f.docs.get(`batch:${f.plan.trialId}:3`);b.checkpoint--;
 await assert.rejects(admitDirectRelay({...f,run:'202:1',parentRun:root.run}),/BATCH_OPEN/);
});

test('runtime refuses quota, windows, resource budget or obsolete contract expansion',async()=>{
 const f=await relayFixture();
 for(const [k,v]of Object.entries({captureMinutes:16,tailCaptureMinutes:6,maxRunWindows:3,maxWorkers:40,
  lanesPerHost:2,automaticRelay:false,completePreserved:134847,remainingComplete:300000,newBetAllowance:1,
  actionContractHash:'a'.repeat(64),actionResourceBudget:{maxFrames:2048,maxRawBytes:4194304}}))
  assert.throws(()=>checkDirectRelayRevision({...f,revision:{...f.revision,[k]:v}}),undefined,k);
 const root=await admitDirectRelay(f),review=resource(f,root);
 assert.throws(()=>checkDirectRelayResource({resourceReview:{...review,run:'999:1'},parentRun:root.run,commit:f.commit}));
 assert.throws(()=>checkDirectRelayResource({resourceReview:{...review,endMs:review.endMs-1},parentRun:root.run,commit:f.commit}));
 assert.throws(()=>directRelayWindow({...f,...f.binding,permit:{...root,expiresAt:root.expiresAt+1},now:f.now()}));
});

test('actual projection and delta entry select the new receipt; workflow separates canary/main/tail and old runtimes',async()=>{
 const f=await relayFixture(),runtimeName='count-runtime-pyramids-direct-action-relay-20261002.json',control={};
 const args={...f,runtimeName,control,resourceReady:Promise.resolve(),readProfile:()=>f.profile,
  readRevision:()=>f.revision,readReceipt:async k=>(await f.store.get('journal',k))?.value};
 await compactControlInitializer(args)();assert.equal(control.compact,true);
 assert.equal(await stateWriteInitializer({...args,group:'secondary'})(f.plan),true);assert.equal(f.store.deltaCas,true);
 const yaml=createRequire(process.cwd()+'/collector/package.json')('js-yaml');
 const trial=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
 const maintenance=yaml.load(fs.readFileSync('.github/workflows/demo-maintenance.yml','utf8'));
 assert(trial.on.workflow_dispatch.inputs.runtime_profile.options.includes(runtimeName));
 assert(maintenance.on.workflow_dispatch.inputs.runtime_profile.options.includes(runtimeName));
 const admit=trial.jobs['pyramids-formal-admit'].steps.filter(s=>s.run==='node scripts/runner-v2/action-direct-relay-control.mjs admit');
 assert.equal(admit.length,1);assert(admit[0].if.includes(runtimeName)&&admit[0].if.includes('formal-repair-pyramids-direct-action-20261002.json'));
 const worker=trial.jobs['pyramids-formal-capture'];assert.equal(worker.strategy['max-parallel'],20);
 assert(worker.env.SG_TRIAL_MINUTES.includes("inputs.relay_parent != '' && '5' || '15'"));
 const allSteps=Object.values(trial.jobs).flatMap(j=>j.steps??[]);
 assert.equal(allSteps.filter(s=>s.run==='node scripts/runner-v2/action-direct-relay-control.mjs relay').length,1);
 assert(allSteps.find(s=>s.run==='node scripts/runner-v2/formal-relay-control.mjs').if.includes("inputs.runtime_profile != '"+runtimeName+"'"));
 const refresh=maintenance.jobs['pyramids-repair'].steps.filter(s=>s.run==='node scripts/runner-v2/action-direct-relay-control.mjs refresh');
 assert.equal(refresh.length,1);assert(refresh[0].if.includes(runtimeName));
});
