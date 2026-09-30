import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {RunnerState} from './state-store.mjs';import {BatchController} from './batch-controller.mjs';import {analyzer} from './analyzer.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';import {rhinoFixture} from '../trial/rhino-fixture.mjs';
import {rhinoNext,rhinoMapping} from '../trial/rhino-protocol.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {rhinoFields}=require('../../collector/sg.rhino.ts');
async function harness(parser){
 const docs=new Map(),rounds=new Map();let failResponse=false;
 const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32799'],commit='f'.repeat(40);
 const transport={async request(op,r){
  if(op==='resources')return {};
  if(op==='read_many')return r.keys.filter(k=>docs.has(r.collection+'/'+k)).map(k=>({_id:'primary/'+k,...structuredClone(docs.get(r.collection+'/'+k))}));
  if(op==='rounds_read')return r.ids.filter(id=>rounds.has(id)).map(id=>structuredClone(rounds.get(id)));
  if(op==='rounds_insert'){for(const row of r.records)rounds.set(row._id,structuredClone(row));return {};}
  const k=r.collection+'/'+r.key,old=docs.get(k);
  if(op==='read')return old?structuredClone(old):null;
  if(op==='create'){if(old)return {created:false};docs.set(k,{version:0,value:structuredClone(r.value)});return {created:true};}
  if(op==='cas'){
   if(failResponse&&r.value.pending?.raw.steps.length){failResponse=false;throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});}
   if(old?.version!==r.version)return {replaced:false};docs.set(k,{version:r.version+1,value:structuredClone(r.value)});return {replaced:true,version:r.version+1};
  }throw Error('BAD_OP');
 }};
 const gate={observe(){},status:()=>({allowed:true,maxBatchSize:100}),hold(){}},now=()=>1000;
 const store=new RunnerState({transport,gate,now,sleep:async()=>{}});
 const control={allowed:async()=>store.get('state','pool:'+plan.trialId),halt:async reason=>store.update('state','global-hold',v=>({...v,active:true,reason}))};
 await store.create('state','global-hold',{active:false});
 await store.create('state','campaign',{enabled:true,activeGame:32799,games:[{game_id:32799,status:'active'}]});
 await store.create('state','pool:'+plan.trialId,{enabled:true,failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
 await store.create('state','write-permits',{limit:1,slots:{}});
 const controller=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,commit,group:'primary',now,sleep:async()=>{}});
 const rpc=(op,r={})=>controller.rpc(op,{shardId:0,...r});
 const registered=await rpc('register',{owner:'job',sessionHash:'a'.repeat(64),planHash:hash(plan)}),worker={owner:'job',workerEpoch:registered.workerEpoch};
 const lease=await rpc('next',worker),owned={...worker,epoch:lease.epoch,batchId:lease.batchId};
 return {controller,store,rounds,plan,rpc,lease,owned,failResponse(){failResponse=true;}};
}
for(const mode of ['complete','unknown','durability'])test('Rhino durable controller '+mode,async()=>{
 const parser=analyzer({python:process.env.PYTHON||'python3'});
 try{
  const f=await harness(parser),raw=rhinoFixture(8,{4:5}),profile=JSON.parse(fs.readFileSync('service/round_types.json')).profiles[f.plan.sourceKey];let posts=0;
  if(mode==='durability')f.failResponse();
  const capture=()=>captureBatch({...f,evidence:{completedThisRun:0},state:{balance:100000},protocol:'wms',startMessage:'Logic',route:rhinoNext,mapping:rhinoMapping,mappingHash:hash(profile),prepareRound:rhinoFields,
   post:async(payload,msg)=>{
    const before=(await f.store.get('state',f.controller.batchKey)).value.pending;assert.equal(before.awaiting,payload);
    const step=structuredClone(raw.steps[posts++]);assert.equal(step.requestPayload,payload);assert.equal(step.msgId,msg);
    if(mode==='unknown')step.responsePayload=step.responseXml=step.responseXml.replace('<GameResult','<GameResult UNKNOWN="1"');return step;
   },payload:msg=>{assert.equal(raw.steps[posts].msgId,msg);return raw.steps[posts].requestPayload;},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},
   shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  if(mode==='complete'){
   await capture();assert.equal(posts,15);assert.equal(f.rounds.size,1);const record=[...f.rounds.values()][0];
   assert((await parser.call({op:'verify',plan:f.plan,raw:record.raw,record})).verified);
   const b=(await f.store.get('state',f.controller.batchKey)).value;assert.equal(b.pending,null);assert.equal(b.checkpoint,1);assert.equal(b.journaled,1);assert.equal(b.leaseUntil,0);
  }else if(mode==='unknown'){
   await assert.rejects(capture(),{code:'RHINO_UNKNOWN_FEATURE'});await f.rpc('fail',{...f.owned,code:'RHINO_UNKNOWN_FEATURE'});
   assert.equal(posts,1);assert.equal(f.rounds.size,0);const b=(await f.store.get('state',f.controller.batchKey)).value;assert.equal(b.pending,null);
   assert.equal((await f.store.get('journal',b.abandonedDemo)).value.pending.raw.steps.length,1);
   assert.equal((await f.store.get('state','global-hold')).value.active,false);assert.equal((await f.store.get('state','campaign')).value.games[0].status,'parking-protocol');
  }else{
   await assert.rejects(capture(),{code:'ACK_UNKNOWN'});assert.equal(posts,1);assert.equal(f.rounds.size,0);
   const b=(await f.store.get('state',f.controller.batchKey)).value;assert(b.pending.awaiting);assert.equal(b.pending.raw.steps.length,0);
  }
 }finally{parser.close();}
});
