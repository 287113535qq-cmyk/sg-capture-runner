import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';import {analyzer} from '../runner-v2/analyzer.mjs';
import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
import {runPearlWorker} from './pearl-worker.mjs';import {pearlFixture} from './pearl-fixture.mjs';
import {pearlPayload,pearlSession,PEARL_ENDPOINT} from './pearl-session.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {pearlFields}=require('../../collector/sg.pearl.ts');
const basePlan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32795'];
const plan={...basePlan,demoGeneration:'f'.repeat(64)};
const profile=JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles[plan.sourceKey];

async function run({failDurability=false,unknown=false}={}){
 const parser=analyzer({python:process.env.PYTHON||'python3'});let posts=0,pending=null,raw=null,record=null,bootAwaiting=null;
 const saved=[],fixture=pearlFixture(),evidence={sourceRequests:0,paidRoundRequests:0,completedThisRun:0};
 const baseGame={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
 const rawBase={fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[]};
 const lease={durable:0,sequenceTarget:100,batchId:1,epoch:1,shortRunLimit:1,pendingRound:null};
 const rpc=async(op,data)=>{
  if(op==='register')return {workerEpoch:1};if(op==='next')return lease;
  if(op==='bootstrap_intent'){bootAwaiting=data.requestPayload;return {};}
  if(op==='bootstrap_frame'){assert.equal(data.step.requestPayload,bootAwaiting);saved.push(data.step);await parser.call({op:'bootstrap',plan:basePlan,raw:{},step:data.step});bootAwaiting=null;return {};}
  if(op==='begin'||op==='intent'){
   assert.equal(pending,null);if(op==='begin')raw=structuredClone(rawBase);
   await parser.call({op:'intent',plan:basePlan,raw,payload:data.requestPayload});pending=data.requestPayload;return {};
  }
  if(op==='exchange_journal'){
   assert.equal(data.step.requestPayload,pending);
   if(failDurability)throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});
   saved.push(data.step);raw.steps.push(data.step);pending=null;
   const next=await parser.call({op:'next',plan:basePlan,raw});
   if(!next){record=await parser.call({op:'record',plan:basePlan,raw,normalized:data.normalized,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',sessionHash:'b'.repeat(64),worker:0,batchId:1});}
   return {complete:!next,followingIntentDurable:false,checkpoint:0,...(record?{endBalanceRaw:record.normalized.money.endBalanceRaw}:{})};
  }
  if(op==='release'){assert(record);return {status:'partial',checkpoint:1};}
  if(op==='status')return {confirmed:record?1:0};throw Error('UNEXPECTED_RPC');
 };
 const fetchImpl=async(url,options)=>{
  assert.equal(url,PEARL_ENDPOINT);assert.equal(options.redirect,'manual');assert.equal(bootAwaiting??pending,options.body,'Every source call requires the durable matching intent');
  let text;
  if(posts===0){assert.equal(options.body,pearlPayload('Init',pearlSession(baseGame,plan,0)));
   text='<GameResponse type="Init"><Header gameID="20327" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="synthetic-0"/><Stakes defaultIndex="0">200|400</Stakes><Balances><Balance name="CASH_BALANCE" value="100000"/></Balances></GameResponse>';
  }else{const step=fixture.steps[posts-1];assert(step);assert.equal(options.body,pearlPayload(step.msgId,'synthetic-'+(posts-1)));text=step.responseXml;
   if(unknown&&posts===1)text=text.replace('<BGInfo','<BGInfo NEWFEATURE="1"');}
  posts++;return {ok:true,headers:{getSetCookie:()=>[],get:()=>null},text:async()=>text};
 };
 let error;
 try{await runPearlWorker({plan,baseGame,shard:0,rpc,mappingHash:hash(profile),prepareRound:pearlFields,evidence,shouldStop:()=>false,requestStop(){},onLease(){},commitSha:'a'.repeat(40),planHash:hash(plan),fetchImpl,limit:1,runId:'1',runAttempt:'1',job:'test'});}
 catch(e){error=e;}finally{parser.close();}
 return {posts,error,saved,record,evidence,pending};
}
test('WMS worker uses persisted Init, one paid Logic, eight free Logic and EndGame with Python readback',async()=>{
 const r=await run();assert.equal(r.error,undefined);assert.equal(r.posts,11);assert.equal(r.saved.length,11);
 assert.equal(r.evidence.paidRoundRequests,1);assert.equal(r.evidence.completedThisRun,1);assert.equal(r.record.normalized.bonus,1);
});
test('WMS response durability failure never sends another request or retries',async()=>{
 const r=await run({failDurability:true});assert.equal(r.error.code,'ACK_UNKNOWN');assert.equal(r.posts,2);assert(r.pending);assert.equal(r.record,null);
});
test('WMS unknown feature is saved before adapter rejection and never continued',async()=>{
 const r=await run({unknown:true});assert.equal(r.error.code,'PEARL_FEATURE_NOT_ADAPTED');assert.equal(r.posts,2);assert.equal(r.saved.length,2);assert.equal(r.record,null);
});
