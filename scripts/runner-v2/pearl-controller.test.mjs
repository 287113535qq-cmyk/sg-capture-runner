import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {RunnerState} from './state-store.mjs';import {BatchController} from './batch-controller.mjs';
import {stable} from './mongo-writer.mjs';import {analyzer} from './analyzer.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';
import {pearlFixture} from '../trial/pearl-fixture.mjs';
import {pearlPayload} from '../trial/pearl-session.mjs';
import {pearlNext,pearlMapping} from '../trial/pearl-protocol.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {pearlFields}=require('../../collector/sg.pearl.ts');
async function fixture(parser,shardId=0,formal=false){
  const docs=new Map(),rounds=new Map();let now=1000,failResponse=false;
  const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32795'];
  const commit='f'.repeat(40);
  if(formal)plan.countAllocation=JSON.parse(fs.readFileSync('config/formal-count-pearl-20260930.json','utf8')).activation;
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
  await store.create('state','global-hold',{active:false});
  await store.create('state','campaign',{enabled:true,activeGame:32795,games:[{game_id:32795,status:'active'}]});
  await store.create('state','pool:'+plan.trialId,{enabled:true,failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
  if(formal){
   const spec={schema:'sg-complete-count-v1',activation:plan.countAllocation,planHash:hash(plan),commit,trialId:plan.trialId,gameId:plan.gameId,
    target:plan.target,maxSequence:600000,firstSequence:1,baselineBatchCount:0,baselineHash:hash([]),sessionRotation:'closed-batches-v1'};
   const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
   await store.create('journal',key,spec);await store.create('journal',key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit});
   await store.update('state','pool:'+plan.trialId,p=>({...p,countAllocation:{specHash:hash(spec),reserved:0,batches:{}}}));
  }
  await store.create('state','write-permits',{limit:1,slots:{}});
  const controller=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,commit,group:shardId>=20?'secondary':'primary',now:()=>now,sleep:async()=>{}});
  const identity={owner:'job',sessionHash:'a'.repeat(64),planHash:createHash('sha256').update(stable(plan)).digest('hex')};
  const rpc=(op,r={})=>controller.rpc(op,{shardId,...r});
  const registered=await rpc('register',identity),worker={owner:'job',workerEpoch:registered.workerEpoch};
  const lease=await rpc('next',worker),owned={...worker,epoch:lease.epoch,batchId:lease.batchId};
  return {controller,store,docs,rounds,plan,rpc,lease,owned,identity,
    failResponse(){failResponse=true;},advance(ms){now+=ms;}};
}

for(const mode of ['complete','unknown','durability','formal'])test('WMS actual durable controller '+mode,async()=>{
 const previous=process.env.SG_FORMAL_COUNT_PROFILE;
 if(mode==='formal')process.env.SG_FORMAL_COUNT_PROFILE='formal-count-pearl-20260930.json';
 const parser=analyzer({python:process.env.PYTHON||'python3'});
 try{
 const f=await fixture(parser,0,mode==='formal'),raw=pearlFixture(),profile=JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles[f.plan.sourceKey];let posted=0,session='synthetic-0';
 if(mode==='durability')f.failResponse();
 const capture=()=>captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},
  protocol:'wms',startMessage:'Logic',route:pearlNext,mapping:pearlMapping,mappingHash:hash(profile),prepareRound:pearlFields,
  post:async(requestPayload,msgId)=>{
   const pending=(await f.store.get('state',f.controller.batchKey)).value.pending;assert.equal(pending.awaiting,requestPayload);
   const step=structuredClone(raw.steps[posted++]);assert.equal(step.requestPayload,requestPayload);assert.equal(step.msgId,msgId);
   if(mode==='unknown'){step.responseXml=step.responseXml.replace('<BGInfo','<BGInfo NEWFEATURE="1"');step.responsePayload=step.responseXml;}
   session='synthetic-'+posted;return step;
  },payload:msg=>{assert.equal(raw.steps[posted].msgId,msg);return raw.steps[posted].requestPayload;},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},
  shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 if(mode==='complete'||mode==='formal'){
  await capture();assert.equal(posted,10);assert.equal(f.rounds.size,1);
  const record=[...f.rounds.values()][0];assert.equal(record.normalized.bonus,1);assert.equal(record.raw.steps.length,10);
  assert((await parser.call({op:'verify',plan:f.plan,raw:record.raw,record})).verified);
  const b=(await f.store.get('state',f.controller.batchKey)).value;assert.equal(b.pending,null);assert.equal(b.checkpoint,1);assert.equal(b.journaled,1);assert.equal(b.leaseUntil,0);
  if(mode==='formal'){
   const p=(await f.store.get('state',f.controller.pool.key)).value;
   assert.equal(p.confirmed,1);assert.equal(p.countAllocation.reserved,0);assert.equal(p.workers[0].activeBatch,null);
   await f.rpc('finish_run');assert.equal((await f.store.get('state',f.controller.pool.key)).value.workers[0].leaseUntil,0);
  }
 }else if(mode==='unknown'){
  await assert.rejects(capture(),{code:'PEARL_FEATURE_NOT_ADAPTED'});await f.rpc('fail',{...f.owned,code:'PEARL_FEATURE_NOT_ADAPTED'});
  assert.equal(posted,1);assert.equal(f.rounds.size,0);const b=(await f.store.get('state',f.controller.batchKey)).value;
  assert.equal(b.pending,null);const archived=(await f.store.get('journal',b.abandonedDemo)).value;assert.equal(archived.pending.raw.steps.length,1);
  assert.equal((await f.store.get('state','global-hold')).value.active,false);assert.equal((await f.store.get('state','campaign')).value.games[0].status,'parking-protocol');
 }else{await assert.rejects(capture(),{code:'ACK_UNKNOWN'});assert.equal(posted,1);assert.equal(f.rounds.size,0);
  const b=(await f.store.get('state',f.controller.batchKey)).value;assert(b.pending.awaiting);assert.equal(b.pending.raw.steps.length,0);}
 }finally{parser.close();if(previous===undefined)delete process.env.SG_FORMAL_COUNT_PROFILE;else process.env.SG_FORMAL_COUNT_PROFILE=previous;}
});
