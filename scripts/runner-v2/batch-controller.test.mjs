import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RunnerState} from './state-store.mjs';
import {BatchController} from './batch-controller.mjs';
import {stable} from './mongo-writer.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {spawnSync} from 'node:child_process';
import {pendingFirstPlan} from './pending-first.mjs';

async function fixture(shardId=0){
  const docs=new Map(),rounds=new Map();let now=1000,failResponse=false;
  const plan={trialId:'sg_r1_20260928_32723',gameId:32723,target:400,betRaw:25,maxSteps:100,sourceKey:'fixture'};
  const transport={async request(op,r){
    if(op==='resources')return {};
    if(op==='read_many')return r.keys.filter(k=>docs.has(r.collection+'/'+k)).map(k=>({_id:'primary/'+k,...structuredClone(docs.get(r.collection+'/'+k))}));
    if(op==='rounds_read')return r.ids.filter(id=>rounds.has(id)).map(id=>structuredClone(rounds.get(id)));
    if(op==='rounds_insert'){for(const row of r.records)rounds.set(row._id,structuredClone(row));return {};}
    const k=r.collection+'/'+r.key,old=docs.get(k);
    if(op==='read')return old?structuredClone(old):null;
    if(op==='create'){if(old)return {created:false};docs.set(k,{version:0,value:structuredClone(r.value)});return {created:true};}
    if(op==='cas'){
      if(failResponse && r.value.pending?.raw.steps.length){failResponse=false;throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});}
      if(old?.version!==r.version)return {replaced:false};
      docs.set(k,{version:r.version+1,value:structuredClone(r.value)});return {replaced:true,version:r.version+1};
    }
    throw Error('BAD_OP');
  }};
  const gate={observe(){},status:()=>({allowed:true,maxBatchSize:100}),hold(){}};
  const store=new RunnerState({transport,gate,now:()=>now,sleep:async()=>{}});
  const control={allowed:async()=>store.get('state','pool:'+plan.trialId),halt:async reason=>store.update('state','global-hold',v=>({...v,active:true,reason}))};
  const parser={async call(r){
    if(r.op==='intent')return {};
    if(r.raw.steps.at(-1)?.responsePayload.includes('FID=2'))throw Object.assign(Error('UNKNOWN_TRIAL_FEATURE'),{code:'UNKNOWN_TRIAL_FEATURE'});
    if(r.op==='next')return null;
    const record={_id:String(r.sequence).padStart(64,'0'),contentHash:'a'.repeat(64),fixtureOnly:false,buy:0,
      trialId:plan.trialId,batchId:r.batchId,sequence:r.sequence,normalized:r.normalized,raw:r.raw};
    return record;
  }};
  await store.create('state','global-hold',{active:false});
  await store.create('state','campaign',{enabled:true,activeGame:32723,games:[{game_id:32723,status:'active'}]});
  await store.create('state','pool:'+plan.trialId,{enabled:true,failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
  await store.create('state','write-permits',{limit:1,slots:{}});
  const controller=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,group:shardId>=20?'secondary':'primary',now:()=>now,sleep:async()=>{}});
  const identity={owner:'job',sessionHash:'a'.repeat(64),planHash:createHash('sha256').update(stable(plan)).digest('hex')};
  const rpc=(op,r={})=>controller.rpc(op,{shardId,...r});
  const registered=await rpc('register',identity),worker={owner:'job',workerEpoch:registered.workerEpoch};
  const lease=await rpc('next',worker),owned={...worker,epoch:lease.epoch,batchId:lease.batchId};
  return {controller,store,docs,rounds,plan,rpc,lease,owned,identity,
    failResponse(){failResponse=true;},advance(ms){now+=ms;}};
}

test('existing capture loop writes responses durably and confirms a partial batch before resume',async()=>{
  const f=await fixture();let posted=0;
  const result=await captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},
    prepareRound:raw=>({money:{endBalanceRaw:raw.startBalanceRaw-25}}),
    post:async(requestPayload,msgId)=>{posted++;return {requestPayload,msgId,responsePayload:'NFG=0',elapsedMs:1};},
    payload:()=> 'MSGID=BET',bootstrap:async()=>100000,shouldStop:()=>false,requestStop(){},
    deadline:performance.now()+60000,limit:10});
  assert.equal(result.status,'pending');assert.equal(posted,10);assert.equal(f.rounds.size,10);
  const registered=await f.rpc('register',{...f.identity,owner:'next-job'});
  const next=await f.rpc('next',{owner:'next-job',workerEpoch:registered.workerEpoch});
  assert.equal(next.batchId,f.lease.batchId);assert.equal(next.durable,10);
});

test('failed response durability leaves original unknown intent and never authorizes another source call',async()=>{
  const f=await fixture();f.failResponse();let posted=0;
  await assert.rejects(captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},
    prepareRound:()=>({money:{endBalanceRaw:99975}}),post:async(requestPayload,msgId)=>{posted++;return {requestPayload,msgId,responsePayload:'NFG=0',elapsedMs:1};},
    payload:()=> 'MSGID=BET',bootstrap:async()=>100000,shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:10}),{code:'ACK_UNKNOWN'});
  assert.equal(posted,1);assert.equal(f.rounds.size,0);
  const b=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal(b.pending.awaiting,'MSGID=BET');assert.equal(b.pending.raw.steps.length,0);
  f.advance(700000);
  await assert.rejects(f.rpc('register',{...f.identity,owner:'replacement'}),{code:'BATCH_RESUME_REVIEW_REQUIRED'});
});

test('natural unknown feature is retained and parked; explicit source rejection stops both groups',async()=>{
  for(const rejected of [false,true]){
    const f=await fixture();await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
    await assert.rejects(f.rpc('exchange_journal',{...f.owned,sequence:1,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'FID=2',sourceRejected:rejected}}));
    await f.rpc('fail',{...f.owned,category:'source_protocol'});
    const b=(await f.store.get('state',f.controller.batchKey)).value;
    assert.equal(b.pending.raw.steps.length,1);assert.equal(b.pending.awaiting,null);
    assert.equal((await f.store.get('state','global-hold')).value.active,rejected);
    assert.equal((await f.store.get('state','campaign')).value.games[0].status,rejected?'active':'parking-protocol');
  }
});

test('cached batch version cannot overwrite a concurrent operator change or authorize another request',async()=>{
  const f=await fixture();
  await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  await f.store.update('state',f.controller.batchKey,b=>({...b,operatorEvidence:'preserve'}));
  await assert.rejects(f.rpc('exchange_journal',{...f.owned,sequence:1,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'NFG=0'}}),{code:'BATCH_VERSION_CHANGED'});
  assert.equal(f.controller.batchSnapshot,null);
  const saved=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal(saved.operatorEvidence,'preserve');assert.equal(saved.pending.awaiting,'MSGID=BET');
  assert.equal(f.rounds.size,0);
  await assert.rejects(f.rpc('intent',{...f.owned,sequence:1,requestPayload:'MSGID=BET'}),/BATCH_SNAPSHOT_REQUIRED/);
});

test('fresh control snapshot rejects a replaced worker before another source intent',async()=>{
  const f=await fixture();
  await f.store.update('state',f.controller.pool.key,p=>{p.workers['0'].owner='replacement';p.workers['0'].epoch++;return p;});
  await assert.rejects(f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'}),{code:'LEASE_LOST'});
  assert.equal((await f.store.get('state',f.controller.batchKey)).value.pending,null);
});

test('same fenced active owner renews after prolonged resource pause using a fresh snapshot',async()=>{
  const f=await fixture();f.advance(700000);
  await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  assert.equal((await f.store.get('state',f.controller.batchKey)).value.pending.awaiting,'MSGID=BET');
});

test('a granted original natural round resumes with FREE_GAME before any BET and consumes its permit',async()=>{
  const f=await fixture();f.plan.gameId=32739;f.controller.identity.commitSha='d'.repeat(40);
  const originalParser=f.controller.analyzer.call;
  f.controller.analyzer.call=async r=>r.op==='next' && r.raw.steps.at(-1).responsePayload==='NFG=1'?{MSGID:'FREE_GAME'}:originalParser(r);
  const pending={sequence:1,attempt:'00000000-0000-0000-0000-000000000009',awaiting:null,
    raw:{fixtureOnly:false,protocol:'nextgen',sourceKey:'fixture',roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,
      steps:[{msgId:'BET',requestPayload:'MSGID=BET',responsePayload:'NFG=1',elapsedMs:1}]}};
  const proofHash='b'.repeat(64);
  await f.store.update('state',f.controller.batchKey,b=>({...b,pending,protocolResume:{proofHash,pendingHash:hash(pending)}}));
  const batch=await f.store.get('state',f.controller.batchKey);
  await f.store.create('journal','protocol-resume:'+proofHash,protocolGrant({plan:f.plan,batches:[batch],proofHash,commit:'d'.repeat(40),now:1000}));
  const worker={owner:f.owned.owner,workerEpoch:f.owned.workerEpoch},lease=await f.rpc('next',worker);
  assert.deepEqual(lease.pendingRound,pending);
  assert.equal((await f.store.get('state',f.controller.batchKey)).value.protocolResume,null);
  await assert.rejects(f.rpc('next',worker),/PENDING_REQUIRES_REVIEW/);
  const calls=[];
  await captureBatch({...f,lease,owned:{...worker,batchId:lease.batchId,epoch:lease.epoch},evidence:{completedThisRun:0},state:{},
    prepareRound:raw=>({money:{endBalanceRaw:raw.startBalanceRaw-25}}),
    post:async(requestPayload,msgId)=>{calls.push(msgId);return {requestPayload,msgId,responsePayload:'NFG=0',elapsedMs:1};},
    payload:msg=>'MSGID='+msg,bootstrap:async()=>{throw Error('MUST_NOT_REINITIALIZE_PENDING');},shouldStop:()=>false,requestStop(){},
    deadline:performance.now()+60000,limit:2});
  assert.deepEqual(calls,['FREE_GAME','BET']);assert.equal(f.rounds.size,2);
  const original=f.rounds.get(String(1).padStart(64,'0'));
  assert.deepEqual(original.raw.steps.slice(0,1),pending.raw.steps);
});

test('actual secondary controller claims original FID1 with CFG1, not old Foam CFG2',async()=>{
 const py=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_quarterback_pick import pick_sample;v=pick_sample();v['steps']=v['steps'][:1];print(json.dumps(v))"],{encoding:'utf8'});
 assert.equal(py.status,0,py.stderr);
 for(const wrong of [false,true]){
  const f=await fixture(38);f.plan.gameId=32836;f.controller.identity.commitSha='d'.repeat(40);
  f.controller.analyzer.call=async()=>({MSGID:'FEATURE_START',CFG:wrong?'2':'1'});
  const pending={sequence:1,attempt:'original-fixture',awaiting:null,raw:JSON.parse(py.stdout)},proofHash='b'.repeat(64);
  await f.store.update('state',f.controller.batchKey,b=>({...b,pending,protocolResume:{proofHash,pendingHash:hash(pending)}}));
  const batch=await f.store.get('state',f.controller.batchKey);
  await f.store.create('journal','protocol-resume:'+proofHash,protocolGrant({plan:f.plan,batches:[batch],proofHash,commit:'d'.repeat(40),now:1000}));
  const worker={owner:f.owned.owner,workerEpoch:f.owned.workerEpoch};
  if(wrong){await assert.rejects(f.rpc('next',worker),/RESUME_PROTOCOL_CHANGED/);assert((await f.store.get('state',f.controller.batchKey)).value.protocolResume);}
  else{const lease=await f.rpc('next',worker);assert.deepEqual(lease.pendingRound,pending);assert.equal((await f.store.get('state',f.controller.batchKey)).value.protocolResume,null);}
 }
});

test('actual continuation stage flushes its one original round and forbids new BET and INIT even if caller asks for more',async()=>{
 for(const rejected of [false,true]){
  const f=await fixture();Object.assign(f.plan,{gameId:32739,buy:0,phase:1});
  const commit='d'.repeat(40),proofHash='b'.repeat(64),identity={...f.identity,commitSha:commit,planHash:hash(f.plan)};
  const originalParser=f.controller.analyzer.call;
  f.controller.analyzer.call=async r=>r.op==='next' && r.raw.steps.at(-1).responsePayload==='NFG=1'?{MSGID:'FREE_GAME'}:originalParser(r);
  const pending={sequence:1,attempt:'00000000-0000-0000-0000-000000000009',awaiting:null,
   raw:{fixtureOnly:false,protocol:'nextgen',sourceKey:'fixture',roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,
    steps:[{msgId:'BET',requestPayload:'MSGID=BET',responsePayload:'NFG=1',elapsedMs:1}]}};
  await f.store.update('state',f.controller.batchKey,b=>({...b,pending,protocolResume:{proofHash,pendingHash:hash(pending)}}));
  const batch=await f.store.get('state',f.controller.batchKey);
  const spec=pendingFirstPlan({plan:f.plan,batches:[batch],proofHash,commit,createdAt:1000,expiresAt:7201000});
  await f.store.create('journal','pending-first:'+proofHash,spec);
  await f.store.create('journal','protocol-resume:'+proofHash,protocolGrant({plan:f.plan,batches:[batch],proofHash,commit,now:1000}));
  await f.store.update('state','campaign',c=>({...c,activeGame:32739,validationLimit:10,protocolValidation:{phase:'short',gameId:32739,proofHash,commit,runKey:'capture-run:1:1',pendingFirst:hash(spec)}}));
  Object.assign(f.controller.pendingFirst,{stage:'resume',runKey:'capture-run:1:1'});
  const reg=await f.rpc('register',identity),worker={owner:identity.owner,workerEpoch:reg.workerEpoch},lease=await f.rpc('next',worker),owned={...worker,batchId:lease.batchId,epoch:lease.epoch};
  assert.equal(lease.shortRunLimit,1);
  await assert.rejects(f.rpc('bootstrap_intent',{...owned,msgId:'INIT',requestPayload:'MSGID=INIT'}),/NEW_REQUEST_FORBIDDEN/);
  const calls=[];
  await assert.rejects(captureBatch({...f,lease,owned,evidence:{completedThisRun:0},state:{},
   prepareRound:raw=>({money:{endBalanceRaw:raw.startBalanceRaw-25}}),
   post:async(requestPayload,msgId)=>{calls.push(msgId);return {requestPayload,msgId,responsePayload:rejected?'MSGID=ERROR':'NFG=0',sourceRejected:rejected,elapsedMs:1};},
   payload:msg=>'MSGID='+msg,bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},shouldStop:()=>false,requestStop(){},
   deadline:performance.now()+60000,limit:10}),rejected?/SOURCE_REJECTED/:/NEW_REQUEST_FORBIDDEN/);
  assert.deepEqual(calls,['FREE_GAME']);assert.equal(f.rounds.size,rejected?0:1);
  const b=(await f.store.get('state',f.controller.batchKey)).value;
  if(rejected){assert.equal(b.pending.raw.steps.length,2);assert.equal(b.pending.awaiting,null);}
  else{assert.equal(b.checkpoint,1);assert.equal(b.pending,null);}
 }
});
