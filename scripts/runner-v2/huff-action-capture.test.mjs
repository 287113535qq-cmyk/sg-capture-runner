import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {captureBatch} from '../trial/capture-batch.mjs';
import {huffNextRequest,huffMapping} from '../trial/huff-protocol.mjs';
import {BatchController} from './batch-controller.mjs';
import {DurableQueue} from './durable-queue.mjs';
import {MongoWriter} from './mongo-writer.mjs';
import {analyzer} from './analyzer.mjs';
import {analyzeConfirmedRound} from './round-analysis-journal.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');

test('original Huff capture entry durably finishes reviewed FID3 while gameplay stays in the sidecar',async()=>{
 const vector=JSON.parse(fs.readFileSync('scripts/trial/fixtures/huff-action.json'));
 const expected=structuredClone(vector.raw);delete expected.requestFlowVersion;delete expected.actionContractHash;
 const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32714'];
 const parser=analyzer({python:process.env.PYTHON??'python'}),journal=new Map(),mongo=new Map();
 let sent=0,intents=0,classifications=0;
 const c=Object.create(BatchController.prototype);
 Object.assign(c,{plan,identity:{sessionHash:'offline'},lease:{worker:0,owner:'offline'},batchEpoch:1,
  batch:{id:1,end:1},batchKey:'batch:offline',
  batchSnapshot:{value:{id:1,start:1,end:1,checkpoint:0,journaled:0,pending:null,owner:'offline',epoch:1,sessionHash:'offline'}},
  pendingFirst:{beforeNewRequest(){},beforeBegin(){},admission:null},
  control:{allowed:async()=>{intents++;return {};}},pool:{heartbeat:async()=>{}},owned:async()=>{},
  spool:{append(){},confirmed(){}},analyzer:{call:async q=>{if(q.op==='classify')classifications++;return parser.call(q);}}});
 c.update=async fn=>{c.batchSnapshot={value:fn(structuredClone(c.batchSnapshot.value))};return c.batchSnapshot;};
 const store={create:async(_collection,key,value)=>{assert(!journal.has(key));journal.set(key,{value:structuredClone(value)});return journal.get(key);},
  get:async(_collection,key)=>journal.get(key),getMany:async(_collection,keys)=>keys.map(k=>journal.get(k))};
 c.queue=new DurableQueue({store,plan,batchKey:c.batchKey,owner:'offline',epoch:1,
  readBatch:async()=>c.batchSnapshot,updateBatch:async fn=>c.update(fn)});
 const writer=new MongoWriter({gate:{status:()=>({allowed:true,maxBatchSize:100}),hold:()=>assert.fail('hold')},queue:c.queue,
  permits:{acquire:async()=>({assertOwned:async()=>{},release:async()=>{}})},
  sink:{read:async ids=>ids.map(id=>mongo.get(id)).filter(Boolean),insert:async records=>{for(const r of records)mongo.set(r._id,structuredClone(r));}}});
 c.flush=async()=>{const records=await c.queue.outstanding();if(records.length)await writer.deliver(records);};
 try{
  const evidence={completedThisRun:0};
  const result=await captureBatch({plan,lease:{durable:0,sequenceTarget:1},owned:{},
   rpc:async(op,r)=>{
    if(op==='begin')return c.intent(r,true);
    if(op==='intent')return c.intent(r,false);
    if(op==='exchange_journal')return c.exchange(r);
    assert.equal(op,'release');await c.flush();return {status:'complete',checkpoint:c.batchSnapshot.value.checkpoint};
   },post:async(request,msg)=>{
    const s=expected.steps[sent++];assert.equal(msg,s.msgId);assert.equal(request,s.requestPayload);
    return structuredClone(s);
   },payload:msg=>expected.steps[0].requestPayload.replace('MSGID=BET','MSGID='+msg),bootstrap:async()=>100000,
   prepareRound:prepareNextgenRound,mappingHash:'a'.repeat(64),mapping:raw=>huffMapping(raw,'a'.repeat(64)),route:huffNextRequest,
   evidence,state:{},shouldStop:()=>false,requestStop:()=>assert.fail('stop'),deadline:performance.now()+60000,limit:1});
  assert.equal(result.checkpoint,1);assert.equal(sent,8);assert.equal(intents,8);assert.equal(classifications,0);
  assert.equal(evidence.completedThisRun,1);assert.equal(mongo.size,1);
  const record=[...mongo.values()][0];assert.deepEqual(record.raw,expected);
  assert.equal(record.bonus,null);assert.equal(record.normalized.classificationStatus,'pending');
  assert.deepEqual(await parser.call({op:'verify',plan,raw:record.raw,record}),{verified:true});
  const before=structuredClone(record);
  const analysis=await analyzeConfirmedRound({store,sink:{read:async()=>[record]},analyzer:parser,plan,record,
   commit:'a'.repeat(40),independentReview:()=>assert.fail('pending gameplay must not be labelled')});
  assert.equal(analysis.status,'review-required');assert.equal(analysis.sourceAllowance,0);
  assert.deepEqual(record,before);assert.equal(c.batchSnapshot.value.pending,null);
 }finally{parser.close();}
});
