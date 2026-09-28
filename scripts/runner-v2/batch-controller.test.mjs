import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RunnerState} from './state-store.mjs';
import {BatchController} from './batch-controller.mjs';
import {stable} from './mongo-writer.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';

async function fixture(){
  const docs=new Map(),rounds=new Map();let now=1000,failResponse=false;
  const plan={trialId:'sg_r1_20260928_32723',gameId:32723,target:400,betRaw:25,maxSteps:100,sourceKey:'fixture'};
  const transport={async request(op,r){
    if(op==='resources')return {};
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
  const control={allowed:async()=>{},halt:async reason=>store.update('state','global-hold',v=>({...v,active:true,reason}))};
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
  const controller=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,group:'primary',now:()=>now,sleep:async()=>{}});
  const identity={owner:'job',sessionHash:'a'.repeat(64),planHash:createHash('sha256').update(stable(plan)).digest('hex')};
  const rpc=(op,r={})=>controller.rpc(op,{shardId:0,...r});
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
