import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import path from 'node:path';
import {captureBatch} from '../trial/capture-batch.mjs';
import {veryFruityActionNext,veryFruityActionMapping,ACTION_CONTRACT_HASH} from '../trial/veryfruity-action-protocol.mjs';
import {BatchController} from './batch-controller.mjs';import {DurableQueue} from './durable-queue.mjs';import {MongoWriter} from './mongo-writer.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const {veryFruityActionFields}=require('../../collector/sg.veryfruity-action.ts');
const py=process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
function python(code,input){const p=spawnSync(py,['-B','-c',code],{encoding:'utf8',env:{...process.env,PYTHONUTF8:'1',PYTHONPATH:['service','service/tests','scripts/runner-v2'].join(path.delimiter)},input:input===undefined?undefined:JSON.stringify(input)});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);}
const fixture=()=>python('import json;from test_veryfruity_action_fields import fixture;p,r=fixture();print(json.dumps({"plan":p,"raw":r}))');
// Seed only this isolated fixture cache; no production plan admission is bypassed.
const analyze=(plan,request)=>python('import json,sys;from record_fields import execute,adapters;from veryfruity_action_fields import VeryFruityActionFields;from store import digest;q=json.load(sys.stdin);adapters[digest(q["plan"])]=VeryFruityActionFields(q["plan"]);print(json.dumps(execute(q)))',{plan,...request});
test('real capture controller persists each XML before continuing, independently normalizes and checkpoints only after full Mongo readback',async()=>{
 const {plan:base,raw}=fixture(),plan={...base,trialId:'offline-veryfruity',maxSteps:1026,target:1};
 assert.equal(plan.actionContractHash,ACTION_CONTRACT_HASH);raw.startBalanceRaw=10000;
 for(const s of raw.steps){s.responseXml=s.responsePayload=s.responseXml.replace('value="1000"','value="10000"');}
 raw.steps[0].responseXml=raw.steps[0].responsePayload=raw.steps[0].responseXml.replace('</GameResult>','<DisplayExtension name="new"/></GameResult>');
 const events=[],journal=new Map(),mongo=new Map();let index=0;
 const c=Object.create(BatchController.prototype);
 Object.assign(c,{plan,identity:{sessionHash:'offline'},lease:{worker:0,owner:'offline'},batchEpoch:1,batch:{id:1,end:1},batchKey:'batch:offline',
  batchSnapshot:{value:{id:1,start:1,end:1,checkpoint:0,journaled:0,pending:null,owner:'offline',epoch:1,sessionHash:'offline'}},
  pendingFirst:{beforeNewRequest(){},beforeBegin(){},admission:null},control:{allowed:async()=>({})},pool:{heartbeat:async()=>{}},owned:async()=>{},
  spool:{append:()=>events.push('spool'),confirmed:()=>events.push('confirmed')},analyzer:{call:async r=>{events.push(r.op);return analyze(plan,r);}}});
 c.update=async fn=>{c.batchSnapshot={value:fn(structuredClone(c.batchSnapshot.value))};events.push('persist');return c.batchSnapshot;};
 const store={create:async(_,key,value)=>{if(journal.has(key))assert.deepEqual(journal.get(key).value,value);else journal.set(key,{value:structuredClone(value)});return journal.get(key);},get:async(_,key)=>journal.get(key),getMany:async(_,keys)=>keys.map(k=>journal.get(k))};
 c.queue=new DurableQueue({store,plan,batchKey:c.batchKey,owner:'offline',epoch:1,readBatch:async()=>c.batchSnapshot,updateBatch:async fn=>c.update(fn)});
 const writer=new MongoWriter({gate:{status:()=>({allowed:true,maxBatchSize:100}),hold:()=>assert.fail('hold')},queue:c.queue,
  permits:{acquire:async()=>({assertOwned:async()=>{},release:async()=>{}})},sink:{read:async ids=>{events.push('readback');return ids.map(id=>mongo.get(id)).filter(Boolean);},insert:async records=>{events.push('insert');for(const r of records)mongo.set(r._id,structuredClone(r));}}});
 c.flush=async()=>{const rows=await c.queue.outstanding();if(rows.length)await writer.deliver(rows);};
 const evidence={completedThisRun:0};
 const result=await captureBatch({plan,lease:{durable:0,sequenceTarget:1},owned:{},protocol:'wms',startMessage:'Logic',
  rpc:async(op,r)=>{if(op==='begin')return c.intent(r,true);if(op==='intent')return c.intent(r,false);if(op==='exchange_journal')return c.exchange(r);assert.equal(op,'release');await c.flush();return {status:'complete',checkpoint:c.batchSnapshot.value.checkpoint};},
  payload:()=>raw.steps[index].requestPayload,post:async(payload,msg)=>{events.push('post');assert.equal(payload,raw.steps[index].requestPayload);assert.equal(msg,raw.steps[index].msgId);if(index)assert(c.batchSnapshot.value.pending.raw.steps.length===index&&c.batchSnapshot.value.pending.awaiting===payload);return structuredClone(raw.steps[index++]);},
  bootstrap:async()=>10000,prepareRound:r=>veryFruityActionFields(r,plan),mappingHash:null,extensionHash:null,
  mapping:r=>veryFruityActionMapping(plan,r),route:r=>veryFruityActionNext(plan,r),evidence,state:{},shouldStop:()=>false,requestStop:()=>assert.fail('stop'),deadline:performance.now()+60000,limit:1});
 assert.equal(index,2);assert.equal(result.checkpoint,1);assert.equal(mongo.size,1);assert.equal(evidence.completedThisRun,1);
 const r=[...mongo.values()][0];assert.equal(r.bonus,null);assert.equal(r.normalized.classificationStatus,'pending');
 assert.deepEqual(analyze(plan,{op:'verify',raw:r.raw,record:r}),{verified:true});
 assert(events.indexOf('readback')>events.indexOf('record'));assert(!events.includes('classify'));
});
test('new handler alone never authorizes an unconfigured live plan',()=>{
 const {plan}=fixture();
 const p=spawnSync(py,['-c','import sys,json;from pool_plan import validate_pool_plan;validate_pool_plan(json.load(sys.stdin))'],{encoding:'utf8',env:{...process.env,PYTHONPATH:'service'},input:JSON.stringify(plan)});
 assert.notEqual(p.status,0);assert.match(p.stderr,/POOL_NOT_CONFIGURED/);
});
