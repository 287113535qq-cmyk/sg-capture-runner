import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyFormalCount} from './formal-count-plan.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_CANARY_RUNTIME,checkActionCanaryRevision,checkActionCanaryInputs,claimActionCanaryWorker} from './action-canary-contract.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';
import {stateWriteInitializer} from './state-write-binding.mjs';
import {BatchController} from './batch-controller.mjs';
import {amendActionCanaryRuntime,admitActionCanary} from './action-canary-runtime.mjs';
const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-20261002.json','utf8'));
const plan=applyFormalCount(JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),profile)[32721];
function fixture(){return {schema:'sg-action-canary-runtime-v1',purpose:'action-canary-v1',gameId:32721,
 activation:profile.activation,profileHash:hash(profile),planHash:hash(plan),sourceRun:'36969614155:1',
 fromCommit:'1b831e373a3c861b8537b499d0c81e5bd5333d4a',completePreserved:16913,remainingComplete:282937,
 newBetAllowance:0,sourceRequests:0,captureMinutes:5,maxWorkers:20,maxBatchesPerWorker:1,maxPaidPerWorker:100,
 maxPaidRequests:2000,automaticRelay:false,lanesPerHost:1,requiresNewSession:true,actionContractHash:profile.actionContractHash};}
test('bounded action canary inherits the applied allocation and cannot expand concurrency quota or replay sessions',()=>{
 assert.deepEqual(checkActionCanaryRevision({plan,profile,revision:fixture()}),
  {captureMinutes:5,maxWorkers:20,maxBatchesPerWorker:1,maxPaidPerWorker:100,maxPaidRequests:2000});
 for(const [k,v]of Object.entries({captureMinutes:240,maxWorkers:40,maxBatchesPerWorker:2,maxPaidPerWorker:101,
  maxPaidRequests:300000,newBetAllowance:1,automaticRelay:true,requiresNewSession:false,remainingComplete:300000,
  fromCommit:'a'.repeat(40),sourceRun:'1:1',actionContractHash:'b'.repeat(64)}))
  assert.throws(()=>checkActionCanaryRevision({plan,profile,revision:{...fixture(),[k]:v}}),k);
});

function runtimeFixture(){
 const commit='a'.repeat(40),revision={...fixture(),controlReadMode:profile.controlReadMode,
  gatewayHash:profile.gatewayHash,stateWriteMode:profile.stateWriteMode};
 const spec={schema:'sg-complete-count-v1',commit:revision.fromCommit,activation:profile.activation,
  profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId,
  target:plan.target,sourceRecordsHash:profile.recordsHash};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit:spec.commit,
  profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,sourceRequests:0,
  completePreserved:16913,remainingComplete:282937};
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,specHash:hash(spec),
  profileHash:hash(profile),planHash:hash(plan),activation:profile.activation,revisionHash:hash(revision),
  completePreserved:16913,remainingComplete:282937,sourceRun:revision.sourceRun,sourceRequests:0,newBetAllowance:0};
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 const docs=new Map([[key,spec],[key+':complete',complete],
  [`count-runtime:${plan.trialId}:${profile.activation}:${commit}`,receipt]]);
 const calls=[],store={deltaCas:false,async get(c,k){calls.push(k);return docs.has(k)?{value:docs.get(k)}:null;},
  transport:{async request(op){calls.push(op);return {group:'secondary',captureLogicOnServer:false,stateDeltaEnabled:true};}}};
 return {commit,revision,spec,complete,receipt,docs,store,calls,key};
}
test('actual compact and delta initializers accept only the separately read back corrected runtime',async()=>{
 const f=runtimeFixture(),control={compact:false},readReceipt=async k=>(await f.store.get('journal',k))?.value;
 const init=compactControlInitializer({plan,runtimeName:ACTION_CANARY_RUNTIME,commit:f.commit,
  resourceReady:Promise.resolve(),control,readProfile:()=>profile,readRevision:()=>f.revision,readReceipt});
 await init();assert.equal(control.compact,true);
 const delta=stateWriteInitializer({store:f.store,commit:f.commit,group:'secondary',runtimeName:ACTION_CANARY_RUNTIME,
  readProfile:()=>profile,readRevision:()=>f.revision});
 assert.equal(await delta(plan),true);assert.equal(f.store.deltaCas,true);
 const n=f.calls.length;await init();await delta(plan);assert.equal(f.calls.length,n);
});
for(const fault of ['missing','revision','fromCommit','sourceRun','quota','complete','plan'])
 test('real initializer refuses corrected-runtime '+fault+' before capability or writes',async()=>{
  const f=runtimeFixture();
  if(fault==='missing')f.docs.delete(`count-runtime:${plan.trialId}:${profile.activation}:${f.commit}`);
  if(fault==='revision')f.receipt.revisionHash='b'.repeat(64);
  if(fault==='fromCommit')f.receipt.fromCommit=f.commit;
  if(fault==='sourceRun')f.receipt.sourceRun='1:1';
  if(fault==='quota')f.receipt.newBetAllowance=1;
  if(fault==='complete')f.complete.specHash='b'.repeat(64);
  if(fault==='plan')f.receipt.planHash='b'.repeat(64);
  const control={compact:false};
  await assert.rejects(compactControlInitializer({plan,runtimeName:ACTION_CANARY_RUNTIME,commit:f.commit,
   resourceReady:Promise.resolve(),control,readProfile:()=>profile,readRevision:()=>f.revision,
   readReceipt:async k=>(await f.store.get('journal',k))?.value})());
  await assert.rejects(stateWriteInitializer({store:f.store,commit:f.commit,group:'secondary',runtimeName:ACTION_CANARY_RUNTIME,
   readProfile:()=>profile,readRevision:()=>f.revision})(plan));
  assert.equal(control.compact,false);assert.equal(f.store.deltaCas,false);assert(!f.calls.includes('hello'));
 });
test('explicit canary input refuses relay and unbound runtime without granting source permission',()=>{
 const inputs={role:'formal-count',allocation:'round-one',round_one_limit:'0',formal_profile:'formal-repair-pyramids-action-20261002.json',
  runtime_profile:ACTION_CANARY_RUNTIME,formal_relay:'none',relay_parent:''};checkActionCanaryInputs(inputs);
 for(const patch of [{formal_relay:'same-allocation-v1'},{relay_parent:'1:1'},{runtime_profile:'none'},{round_one_limit:'5'}])
  assert.throws(()=>checkActionCanaryInputs({...inputs,...patch}));
});

test('atomic worker claim refuses same-owner restart and late or unbound capture before registration',async()=>{
 const f=runtimeFixture(),now=1000000,run='123:1';
 const permit={schema:'sg-count-run-v1',run,commit:f.commit,activation:profile.activation,
  profileHash:hash(profile),runtimeRevisionHash:hash(f.revision),completeBefore:16913,remainingComplete:282937,
  createdAt:now,expiresAt:now+300000};
 const proof={...f,profile,plan,permit,run};
 const identity={shardId:20,commitSha:f.commit,planHash:hash(plan),sessionHash:'c'.repeat(64)};
 const rows=new Map();let created=0;
 const store={async writable(){},async get(c,k){return rows.has(k)?{value:rows.get(k)}:null;},
  transport:{async request(op,{key,value}){assert.equal(op,'create');if(rows.has(key))return {created:false};
    rows.set(key,structuredClone(value));created++;return {created:true};}}};
 const args={store,proof,identity,now};
 const results=await Promise.allSettled([claimActionCanaryWorker(args),claimActionCanaryWorker(args)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(created,1);
 await assert.rejects(claimActionCanaryWorker(args),/ALREADY_CLAIMED/);
 await assert.rejects(claimActionCanaryWorker({...args,now:permit.expiresAt}),/WINDOW_ENDED/);
 await assert.rejects(claimActionCanaryWorker({...args,identity:{...identity,shardId:40}}),/WORKER/);
 await assert.rejects(claimActionCanaryWorker({...args,proof:{...proof,permit:{...permit,runtimeRevisionHash:'d'.repeat(64)}}}),/RUN_PERMIT/);
 assert.equal(created,1);
});

test('actual controller ends a completed canary worker before a second allocation',async()=>{
 let releases=0;
 const c=new BatchController({store:{},transport:{},gate:{},analyzer:{},spool:{append(){},confirmed(){}},
  control:{allowed(){throw Error('SECOND_ADMISSION');}},plan,group:'secondary',commit:'a'.repeat(40)});
 c.lease={owner:'worker',epoch:1,worker:20};c.actionCanaryProof={};c.actionCanaryBatchTaken=true;
 c.pool.release=async lease=>{assert.equal(lease,c.lease);releases++;};
 c.pool.take=async()=>{throw Error('SECOND_ALLOCATION');};
 assert.deepEqual(await c.rpc('next',{owner:'worker',workerEpoch:1,shardId:20}),{done:true});
 assert.equal(releases,1);
});

test('real run admission atomically limits the revision to one source run without changing its ledger',async()=>{
 const f=runtimeFixture(),at=1000000;
 const entries=Array.from({length:321},(_,i)=>({id:i+1,worker:20,start:i*97+1,
  end:i===320?31278:(i+1)*97,sessionHash:'c'.repeat(64),closed:true,
  complete:i<319?53:i===319?6:0,evidenceHash:'d'.repeat(64)}));
 Object.assign(f.spec,{maxSequence:600000,firstSequence:31279,baselineBatchCount:321,baselineHash:hash(entries)});
 f.complete.specHash=hash(f.spec);f.receipt.specHash=hash(f.spec);
 Object.assign(f.revision,{createdAt:at,expiresAt:at+7200000});f.receipt.revisionHash=hash(f.revision);
 const pool={enabled:true,failure:null,confirmed:16913,workers:{},nextSequence:31279,nextBatchId:322,
  countAllocation:{specHash:hash(f.spec),reserved:0,batches:Object.fromEntries(entries.map(e=>[e.id,e]))}};
 const campaign={enabled:true,activeGame:32721,formalCount:{activation:profile.activation}};
 f.docs.set('pool:'+plan.trialId,pool);f.docs.set('campaign',campaign);
 let creates=0;
 f.store.writable=async()=>{};
 f.store.transport.request=async(op,{key,value})=>{assert.equal(op,'create');
  if(f.docs.has(key))return {created:false};f.docs.set(key,structuredClone(value));creates++;return {created:true};};
 f.store.create=async(c,k,v)=>{assert(!f.docs.has(k));f.docs.set(k,structuredClone(v));creates++;};
 const before=hash({pool,campaign}),args={store:f.store,plan,profile,revision:f.revision,commit:f.commit,
  boundary:async()=>{},now:()=>at,run:'123:1'};
 const permit=await admitActionCanary(args);
 assert.equal(permit.expiresAt-permit.createdAt,300000);assert.equal(creates,2);
 await assert.rejects(admitActionCanary({...args,run:'124:1'}),/RUN_ALREADY_CLAIMED/);
 assert.equal(creates,2);assert.equal(hash({pool,campaign}),before);
 assert(!f.docs.has(`count-run:${plan.trialId}:124:1`));
});

test('runtime amendment rejects a source workflow or failed parent before any storage access',async()=>{
 const f=runtimeFixture(),at=1000000;Object.assign(f.revision,{createdAt:at,expiresAt:at+7200000});
 const ended={id:36969614155,run_attempt:1,head_sha:f.spec.commit,status:'completed',conclusion:'success',
  repository:{full_name:'287113535qq-cmyk/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const args={store:{get(){throw Error('UNEXPECTED_READ');}},plan,profile,revision:f.revision,ended,
  jobs:{total_count:1,jobs:[{status:'completed',conclusion:'success'}]},commit:f.commit,run:'123:1',
  boundary(){throw Error('UNEXPECTED_BOUNDARY');},now:()=>at};
 await assert.rejects(amendActionCanaryRuntime(args),/RUNTIME_PARENT/);
 ended.path='.github/workflows/demo-maintenance.yml';ended.conclusion='failure';
 await assert.rejects(amendActionCanaryRuntime(args),/RUNTIME_PARENT/);
});
