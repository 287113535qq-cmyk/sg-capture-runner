import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import path from 'node:path';
import {captureBatch} from '../trial/capture-batch.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH,pyramidsActionNext} from '../trial/pyramids-action-protocol.mjs';
import {BatchController} from './batch-controller.mjs';import {DurableQueue} from './durable-queue.mjs';
import {MongoWriter} from './mongo-writer.mjs';
import {analyzeConfirmedRound} from './round-analysis-journal.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json'),transpileOnly:true});
const {prepareNextgenActionRound}=require('../../collector/sg.pyramids-action.ts');
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const py=process.env.PYTHON??'python';
function python(script,input){
 const p=spawnSync(py,['-B','-c',script],{input:input===undefined?undefined:JSON.stringify(input),encoding:'utf8',env:{...process.env,PYTHONUTF8:'1'}});
 assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
function fixture(){return python(`
import sys,json
sys.path[:0]=['service','service/tests','scripts/runner-v2']
from test_pyramids_action_fields import ACTION_PLAN,action_raw,flow_sample,rewrite
raw=action_raw(flow_sample())
for step in raw['steps']:rewrite(step,GSD='UNKNOWNDISPLAY~preserve-exactly#FGTHNS~1#HNSID~7')
ordinary=action_raw(flow_sample());ordinary['steps']=ordinary['steps'][:1]
ordinary['startBalanceRaw']=99980
rewrite(ordinary['steps'][0],FID=None,NFG=None,TFG=None,CFGG=None,B='99960',AB='99960')
print(json.dumps(dict(plan=ACTION_PLAN,rounds=[raw,ordinary])))`);}
// The fixture seeds only this offline process's trusted adapter cache. Online
// plans still require the independent on-disk profile and admission receipts.
function analyze(plan,request){return python(`
import sys,json
sys.path[:0]=['service','scripts/runner-v2']
from record_fields import execute,adapters
from pyramids_action_fields import PyramidsActionFields
from store import digest
q=json.load(sys.stdin);adapters[digest(q['plan'])]=PyramidsActionFields(q['plan'])
print(json.dumps(execute(q)))`,{plan,...request});}

test('real capture and durable exchange finish unknown-display rounds before independent gameplay analysis',async()=>{
 const {plan:base,rounds}=fixture(),plan={...base,maxSteps:100,target:2};
 const events=[],journal=new Map(),mongo=new Map();let sent=0,roundIndex=0,stepIndex=0;
 const c=Object.create(BatchController.prototype);
 Object.assign(c,{plan,identity:{sessionHash:'offline'},lease:{worker:0,owner:'offline'},batchEpoch:1,batch:{id:1,end:2},batchKey:'batch:offline',
  batchSnapshot:{value:{id:1,start:1,end:2,checkpoint:0,journaled:0,pending:null}},
  pendingFirst:{beforeNewRequest(){},beforeBegin(){},admission:null},
  control:{allowed:async()=>({})},pool:{heartbeat:async()=>{}},owned:async()=>{},
  spool:{append:()=>events.push('spool'),confirmed:()=>events.push('response-confirmed')},
  analyzer:{call:async r=>{events.push(r.op);return analyze(plan,r);}},
 });
 c.update=async fn=>{const value=fn(structuredClone(c.batchSnapshot.value));c.batchSnapshot={value};events.push('persist');return c.batchSnapshot;};
 const store={create:async(_collection,key,value)=>{if(journal.has(key))assert.deepEqual(journal.get(key).value,value);else journal.set(key,{value:structuredClone(value)});return journal.get(key);},
  get:async(_collection,key)=>journal.get(key),getMany:async(_collection,keys)=>keys.map(k=>journal.get(k))};
 c.queue=new DurableQueue({store,plan,batchKey:c.batchKey,owner:'offline',epoch:1,
  readBatch:async()=>c.batchSnapshot,updateBatch:async fn=>c.update(fn)});
 c.batchSnapshot.value.owner='offline';c.batchSnapshot.value.epoch=1;c.batchSnapshot.value.sessionHash='offline';
 const writer=new MongoWriter({gate:{status:()=>({allowed:true,maxBatchSize:100}),hold:()=>assert.fail('hold')},queue:c.queue,
  permits:{acquire:async()=>({assertOwned:async()=>{},release:async()=>{}})},
  sink:{read:async ids=>ids.map(id=>mongo.get(id)).filter(Boolean),insert:async records=>{for(const r of records)mongo.set(r._id,structuredClone(r));}}});
 c.flush=async()=>{const records=await c.queue.outstanding();if(records.length)await writer.deliver(records);};
 const evidence={completedThisRun:0},payload=msg=>rounds[0].steps[0].requestPayload.replace('MSGID=BET','MSGID='+msg);
 const result=await captureBatch({plan,lease:{durable:0,sequenceTarget:2},owned:{},
  rpc:async(op,r)=>{
   if(op==='begin'){assert.equal(r.sequence,roundIndex+1);events.push('begin');return c.intent(r,true);}
   if(op==='intent')return c.intent(r,false);
   if(op==='exchange_journal'){
    const out=await c.exchange(r);if(out.complete){roundIndex++;stepIndex=0;}return out;
   }
   assert.equal(op,'release');await c.flush();return {status:'complete',checkpoint:c.batchSnapshot.value.checkpoint};
  },post:async(_payload,msg)=>{const s=rounds[roundIndex].steps[stepIndex++];assert.equal(msg,s.msgId);sent++;return structuredClone(s);},
  payload,bootstrap:async()=>100000,prepareRound:raw=>prepareNextgenActionRound(raw,plan),
  mappingHash:null,extensionHash:null,mapping:()=>({}),route:raw=>pyramidsActionNext(plan,raw),
  evidence,state:{},shouldStop:()=>false,requestStop:()=>assert.fail('stop'),deadline:performance.now()+60000,limit:2});
 assert.equal(result.checkpoint,2);assert.equal(evidence.completedThisRun,2);assert.equal(sent,12);assert.equal(mongo.size,2);
 assert.equal(events.filter(e=>e==='record').length,2);
 assert(!events.includes('classify'));
 for(const r of mongo.values()){
  assert.equal(r.bonus,null);assert.equal(r.normalized.classificationStatus,'pending');
  assert.equal(r.raw.requestFlowVersion,ACTION_VERSION);assert.equal(r.raw.actionContractHash,ACTION_CONTRACT_HASH);
  assert.deepEqual(analyze(plan,{op:'verify',raw:r.raw,record:r}),{verified:true});
 }
 const first=[...mongo.values()].find(r=>r.sequence===1);
 assert(first.raw.steps.every(s=>s.responsePayload.includes('UNKNOWNDISPLAY')));
 const before=structuredClone([...mongo.values()]);
 const options={store,sink:{read:async ids=>ids.map(id=>mongo.get(id)).filter(Boolean)},
  analyzer:{call:async q=>analyze(plan,q)},plan,commit:'a'.repeat(40)};
 const pending=await analyzeConfirmedRound({...options,record:first,
  independentReview:()=>assert.fail('unknown gameplay cannot be classified')});
 assert.equal(pending.status,'review-required');assert.equal(pending.sourceAllowance,0);
 const second=before.find(r=>r.sequence===2);
 const known=analyze(plan,{op:'classify',raw:second.raw,record:second});
 assert.equal(known.status,'classified');
 await assert.rejects(analyzeConfirmedRound({...options,record:second,
  independentReview:()=>({wrong:true})}),/deep-equal|Expected/);
 assert(!journal.has(`round-analysis:${plan.trialId}:${second._id}:${options.commit}`));
 const classified=await analyzeConfirmedRound({...options,record:second,
  independentReview:raw=>prepareNextgenRound(raw,{buy:0,bonus:known.classification.bonus,
   typeMappingHash:known.classification.typeMappingHash})});
 assert.equal(classified.status,'classified');
 await assert.rejects(analyzeConfirmedRound({...options,record:first,
  sink:{read:async()=>[]},independentReview:()=>assert.fail('no readback')}),/FULL_READBACK/);
 await assert.rejects(analyzeConfirmedRound({...options,record:{...first,rawHash:'0'.repeat(64)},
  independentReview:()=>assert.fail('changed evidence')}),/FULL_READBACK/);
 assert.deepEqual([...mongo.values()],before);
 assert.equal(c.batchSnapshot.value.checkpoint,2);
});

test('collector and Python refuse incomplete flow, changed contract and unreconciled terminal wallet',()=>{
 const {plan,rounds:[raw]}=fixture();
 assert.deepEqual(prepareNextgenActionRound(raw,plan),analyze(plan,{op:'record',raw,
  normalized:prepareNextgenActionRound(raw,plan),sequence:1,attempt:'fixture',sessionHash:'fixture',worker:0,batchId:1}).normalized);
 assert.throws(()=>prepareNextgenActionRound({...raw,steps:raw.steps.slice(0,2)},plan),/INCOMPLETE/);
 assert.throws(()=>prepareNextgenActionRound({...raw,actionContractHash:'0'.repeat(64)},plan),/CONTRACT/);
 const bad=structuredClone(raw);bad.steps.at(-1).responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>different</PAYLOAD></GDMRESPONSE>';
 assert.throws(()=>prepareNextgenActionRound(bad,plan),/XML/);
});
