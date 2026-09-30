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
import {GithubCampaign} from './campaign.mjs';
import {SourceControl} from './control.mjs';

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

test('Pyramids and Inca explicit feature gaps isolate the game while validation errors hold shared writes',async()=>{
 for(const [code,local] of [['PYRAMIDS_UNREVIEWED_GSD',true],['PYRAMIDS_UNREVIEWED_FEATURE',true],
  ['PYRAMIDS_FREE_UNREVIEWED_GSD',true],['INCA_UNREVIEWED_COIN',true],['INCA_UNREVIEWED_JACKPOT',true],
  ['PYRAMIDS_TERMINAL',false],['PYRAMIDS_FREE_COUNTERS',false],['SESSION_CHANGED_MID_ROUND',false]]){
  const f=await fixture();
  await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  f.controller.analyzer.call=async()=>{throw Object.assign(Error(code),{code});};
  await assert.rejects(f.rpc('exchange_journal',{...f.owned,sequence:1,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'NFG=1',responseXml:'<synthetic/>'}}));
  await f.rpc('fail',{...f.owned});
  const b=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal((await f.store.get('state','global-hold')).value.active,!local,code);
  if(local){assert.equal(b.pending,null);assert(b.abandonedDemo);assert.equal((await f.store.get('journal',b.abandonedDemo)).value.reason,code);const diagnostic=(await f.store.get('journal',b.abandonedDemo)).value.diagnostic;assert.equal(diagnostic.code,code);assert.equal(diagnostic.captureAuthorization,false);assert.equal(diagnostic.stepCount,1);}
  else assert(b.pending);
 }
});

test('existing capture loop writes responses durably and confirms a partial batch before resume',async()=>{
  const f=await fixture();let posted=0;
  const result=await captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},
    prepareRound:raw=>({money:{endBalanceRaw:raw.startBalanceRaw-25}}),
    post:async(requestPayload,msgId)=>{posted++;return {requestPayload,msgId,responsePayload:'NFG=0',elapsedMs:1};},
    payload:()=> 'MSGID=BET',bootstrap:async()=>100000,shouldStop:()=>false,requestStop(){},
    deadline:performance.now()+60000,limit:10});
  assert.equal(result.status,'pending');assert.equal(posted,10);assert.equal(f.rounds.size,10);
  const released=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal(released.leaseUntil,0);assert.equal(released.checkpoint,10);assert.equal(released.journaled,10);
  assert.equal((await f.store.get('state',f.controller.pool.key)).value.workers['0'].leaseUntil,0);
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
    if(rejected){assert.equal(b.pending.raw.steps.length,1);assert.equal(b.pending.awaiting,null);}
    else {assert.equal(b.pending,null);assert.equal((await f.store.get('journal',b.abandonedDemo)).value.pending.raw.steps.length,1);}
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

test('partial release retains worker fencing when batch CAS conflicts',async()=>{
  const f=await fixture(),cas=f.store.cas.bind(f.store);
  f.store.cas=async(c,k,b,v)=>{
    if(k===f.controller.batchKey&&v.leaseUntil===0)return null;
    return cas(c,k,b,v);
  };
  await assert.rejects(f.rpc('release',f.owned),{code:'BATCH_VERSION_CHANGED'});
  assert((await f.store.get('state',f.controller.batchKey)).value.leaseUntil>0);
  assert((await f.store.get('state',f.controller.pool.key)).value.workers['0'].leaseUntil>0);
});

test('partial release cannot clear unresolved pending evidence',async()=>{
  for(const field of ['pending','pendingOriginal','bootstrapAwaiting']){
    const f=await fixture();
    await f.controller.update(v=>({...v,[field]:{unresolved:true}}));
    await assert.rejects(f.rpc('release',f.owned),/UNFINISHED_ROUND/);
    assert((await f.store.get('state',f.controller.batchKey)).value.leaseUntil>0);
    assert((await f.store.get('state',f.controller.pool.key)).value.workers['0'].leaseUntil>0);
  }
});

test('AG-style actual capture failure archives only the half round and queues repair while a fresh run selects B',async()=>{
  const f=await fixture();let posted=0;
  const original=f.controller.analyzer.call;
  f.controller.analyzer.call=async r=>{
    if(r.op==='next' && r.raw.steps.at(-1)?.responsePayload==='FID=2')
      throw Object.assign(Error('UNSUPPORTED_BEAVER_NESTED_FEATURE'),{code:'UNSUPPORTED_BEAVER_NESTED_FEATURE'});
    return original(r);
  };
  await assert.rejects(captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},
    prepareRound:raw=>({money:{endBalanceRaw:raw.startBalanceRaw-25}}),
    post:async(requestPayload,msgId)=>({requestPayload,msgId,responsePayload:++posted===1?'NFG=0':'FID=2',elapsedMs:1}),
    payload:()=> 'MSGID=BET',bootstrap:async()=>100000,shouldStop:()=>false,requestStop(){},
    deadline:performance.now()+60000,limit:10}),{code:'UNSUPPORTED_BEAVER_NESTED_FEATURE'});
  await f.rpc('fail',{...f.owned,code:'UNSUPPORTED_BEAVER_NESTED_FEATURE'});
  assert.equal(posted,2);assert.equal(f.rounds.size,1);
  const b=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal(b.pending,null);assert.equal(b.checkpoint,1);
  assert.equal((await f.store.get('state','global-hold')).value.active,false);
  const old={frozen:true};await f.store.create('journal','parked-pool:'+f.plan.trialId,old,{immutable:true});
  const nextPlan={gameId:32726,trialId:'synthetic-next-game',buy:0,phase:1,target:2};
  await f.store.update('state','campaign',v=>{v.games.push({game_id:32726,status:'ready',baseline:299998});return v;});
  await f.store.create('state','capture-run:123:1',{gameId:f.plan.gameId});
  const campaign=new GithubCampaign({store:f.store,control:f.controller.control,plans:{[f.plan.gameId]:f.plan,32726:nextPlan},now:()=>1000});
  await campaign.finalizeStoppedRun('capture-run:123:1');
  const parked=(await f.store.get('state','campaign')).value.games[0];
  assert.equal(parked.status,'parked-protocol');
  assert.equal((await f.store.get('state',parked.repairKey)).value.status,'pending-adapter');
  assert.deepEqual((await f.store.get('journal','parked-pool:'+f.plan.trialId)).value,old);
  assert.equal((await campaign.selectForRun('capture-run:123:1')).reason,'RUN_GAME_FINISHED');
  assert.equal((await campaign.selectForRun('capture-run:124:1')).plan.gameId,32726);
});

test('failed private abandonment write keeps the partial and stops shared writes',async()=>{
  const f=await fixture();
  await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  await assert.rejects(f.rpc('exchange_journal',{...f.owned,sequence:1,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'FID=2'}}));
  const create=f.store.create.bind(f.store);f.store.create=async(c,k,...rest)=>{if(k.startsWith('abandoned-demo:'))throw Error('STORE_FAILED');return create(c,k,...rest);};
  await assert.rejects(f.rpc('fail',{...f.owned}),/STORE_FAILED/);
  assert((await f.store.get('state',f.controller.batchKey)).value.pending);
  assert.equal((await f.store.get('state','global-hold')).value.active,true);
});

test('a healthy peer finishes its in-flight feature after adapter parking but cannot start another BET',async()=>{
  const f=await fixture();
  const transport={request:async(op,r)=>op==='control_read'?[
    {_id:'primary/global-hold',value:(await f.store.get('state','global-hold')).value},
    {_id:'secondary/global-hold',value:{active:false}},
    {_id:'primary/campaign',value:(await f.store.get('state','campaign')).value},
    {_id:'primary/pool:'+f.plan.trialId,value:(await f.store.get('state','pool:'+f.plan.trialId)).value},
  ]:f.controller.transport.request(op,r)};
  const gate={status:()=>({allowed:true,maxBatchSize:100,metrics:{diskFreeBytes:100*1024**3}})};
  const peer=new BatchController({store:f.store,transport,gate,plan:f.plan,group:'primary',now:()=>1000,
    spool:{append(){},confirmed(){}},control:new SourceControl({store:f.store,transport,gate,plan:f.plan}),
    analyzer:{call:async r=>r.op==='next'?(r.raw.steps.length===1?{MSGID:'FREE_GAME'}:null):f.controller.analyzer.call(r)}});
  const identity={...f.identity,owner:'peer',sessionHash:'b'.repeat(64)};
  const registration=await peer.rpc('register',{...identity,shardId:1});
  const worker={shardId:1,owner:'peer',workerEpoch:registration.workerEpoch};
  const lease=await peer.rpc('next',worker),owned={...worker,batchId:lease.batchId,epoch:lease.epoch},sequence=lease.durable+1;
  await peer.rpc('begin',{...owned,sequence,attempt:'00000000-0000-0000-0000-000000000002',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  await peer.rpc('exchange_journal',{...owned,sequence,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'NFG=1'}});
  await f.rpc('begin',{...f.owned,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',startBalanceRaw:100000,requestPayload:'MSGID=BET'});
  await assert.rejects(f.rpc('exchange_journal',{...f.owned,sequence:1,step:{requestPayload:'MSGID=BET',msgId:'BET',responsePayload:'FID=2'}}));
  await f.rpc('fail',{...f.owned});
  await peer.rpc('intent',{...owned,sequence,requestPayload:'MSGID=FREE_GAME'});
  const result=await peer.rpc('exchange_journal',{...owned,sequence,normalized:{money:{endBalanceRaw:99975}},
    step:{requestPayload:'MSGID=FREE_GAME',msgId:'FREE_GAME',responsePayload:'NFG=0'}});
  assert.equal(result.complete,true);
  await assert.rejects(peer.rpc('begin',{...owned,sequence:sequence+1,attempt:'00000000-0000-0000-0000-000000000003',startBalanceRaw:99975,requestPayload:'MSGID=BET'}),{code:'POOL_PAUSED'});
  await peer.rpc('fail',{...owned,code:'POOL_PAUSED'});
  assert.equal(f.rounds.size,1);
  assert.equal((await f.store.get('state','global-hold')).value.active,false);
  assert.equal((await f.store.get('state',peer.batchKey)).value.pending,null);
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
