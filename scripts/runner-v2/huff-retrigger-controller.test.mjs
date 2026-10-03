import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';
import {RunnerState} from './state-store.mjs';import {BatchController} from './batch-controller.mjs';import {analyzer} from './analyzer.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';import {huffNextRequest} from '../trial/huff-protocol.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
async function harness(parser){
 const docs=new Map(),rounds=new Map();let failResponse=false;
 const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32714'],commit='f'.repeat(40);
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
 await store.create('state','campaign',{enabled:true,activeGame:32714,games:[{game_id:32714,status:'active'}]});
 await store.create('state','pool:'+plan.trialId,{enabled:true,failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
 await store.create('state','write-permits',{limit:1,slots:{}});
 const controller=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,commit,group:'primary',now,sleep:async()=>{}});
 const rpc=(op,r={})=>controller.rpc(op,{shardId:0,...r});
 const registered=await rpc('register',{owner:'job',sessionHash:'a'.repeat(64),planHash:hash(plan)}),worker={owner:'job',workerEpoch:registered.workerEpoch};
 const lease=await rpc('next',worker),owned={...worker,epoch:lease.epoch,batchId:lease.batchId};
 return {controller,store,rounds,plan,rpc,lease,owned,failResponse(){failResponse=true;}};
}

for(const mode of ['gap','money'])test('Hard Hat actual capture preserves response then applies '+mode+' policy',async()=>{
 const p=spawnSync(process.env.PYTHON||'python3',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_huff_retrigger import sample;print(json.dumps(sample()))"],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const raw=JSON.parse(p.stdout);
 const parser=analyzer({python:process.env.PYTHON||'python3'});try{
  const f=await harness(parser);let posts=0;const code=mode==='gap'?'HARDHAT_UNKNOWN_FIELD':'FEATURE_WALLET_AMOUNT';
  const capture=()=>captureBatch({...f,evidence:{completedThisRun:0},state:{balance:raw.startBalanceRaw},route:huffNextRequest,
   post:async(payload,msg)=>{const step=structuredClone(raw.steps[posts++]);assert.equal(step.requestPayload,payload);assert.equal(step.msgId,msg);
    if(posts===3)for(const k of ['responsePayload','responseXml'])step[k]=mode==='gap'?step[k].replace('HHADD~1','HHADD~1#FUTURE~1'):step[k].replace('TW=200','TW=201');return step;},
   payload:msg=>{assert.equal(raw.steps[posts].msgId,msg);return raw.steps[posts].requestPayload;},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},
   prepareRound:()=>{throw Error('UNEXPECTED_SETTLEMENT');},mapping:()=>({}),shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  await assert.rejects(capture(),{code});await f.rpc('fail',{...f.owned,code});assert.equal(posts,3);assert.equal(f.rounds.size,0);
  const b=(await f.store.get('state',f.controller.batchKey)).value;
  if(mode==='gap'){assert.equal(b.pending,null);assert.equal((await f.store.get('journal',b.abandonedDemo)).value.pending.raw.steps.length,3);
   assert.equal((await f.store.get('state','global-hold')).value.active,false);assert.equal((await f.store.get('state','campaign')).value.games[0].status,'parking-protocol');
  }else{assert.equal((await f.store.get('state','global-hold')).value.active,true);assert.equal(b.pending.raw.steps.length,3);}
 }finally{parser.close();}
});
