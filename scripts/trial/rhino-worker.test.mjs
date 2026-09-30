import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';
import {analyzer} from '../runner-v2/analyzer.mjs';
import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
import {onePaidRound} from '../runner-v2/paid-round-evidence.mjs';
import {runRhinoWorker} from './rhino-worker.mjs';
import {rhinoFixture} from './rhino-fixture.mjs';
import {rhinoPayload,RHINO_ENDPOINT} from './rhino-session.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {rhinoFields}=require('../../collector/sg.rhino.ts');
const basePlan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32799'];
const plan={...basePlan,demoGeneration:'f'.repeat(64)};
const profile=JSON.parse(fs.readFileSync('service/round_types.json')).profiles[plan.sourceKey];
async function run({failDurability=false,unknown=false}={}){
 const parser=analyzer({python:process.env.PYTHON||'python3'}),fixture=rhinoFixture(8,{4:5});
 let posts=0,pending=null,bootstrap=null,raw=null,record=null;const saved=[];
 const evidence={sourceRequests:0,paidRoundRequests:0,completedThisRun:0};
 const lease={durable:0,sequenceTarget:100,batchId:1,epoch:1,shortRunLimit:1,pendingRound:null};
 const rpc=async(op,data)=>{
  if(op==='register')return {workerEpoch:1};if(op==='next')return lease;
  if(op==='bootstrap_intent'){bootstrap=data.requestPayload;return {};}
  if(op==='bootstrap_frame'){assert.equal(data.step.requestPayload,bootstrap);saved.push(data.step);await parser.call({op:'bootstrap',plan:basePlan,raw:{},step:data.step});bootstrap=null;return {};}
  if(op==='begin'||op==='intent'){
   assert.equal(pending,null);if(op==='begin')raw={fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:100000,steps:[]};
   await parser.call({op:'intent',plan:basePlan,raw,payload:data.requestPayload});pending=data.requestPayload;return {};
  }
  if(op==='exchange_journal'){
   assert.equal(data.step.requestPayload,pending);if(failDurability)throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});
   saved.push(data.step);raw.steps.push(data.step);pending=null;
   const next=await parser.call({op:'next',plan:basePlan,raw});
   if(!next)record=await parser.call({op:'record',plan:basePlan,raw,normalized:data.normalized,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',sessionHash:'b'.repeat(64),worker:0,batchId:1});
   return {complete:!next,followingIntentDurable:false,checkpoint:0};
  }
  if(op==='release'){assert(record);return {status:'partial',checkpoint:1};}
  if(op==='status')return {confirmed:record?1:0};throw Error('UNEXPECTED_RPC');
 };
 const fetchImpl=async(url,options)=>{
  assert.equal(url,RHINO_ENDPOINT);assert.equal(options.redirect,'manual');assert.equal(bootstrap??pending,options.body,'durable exact intent before every request');
  let text;if(posts===0)text='<GameResponse type="Init"><Header gameID="20124" versionID="1_0" isRecovering="N" sessionID="synthetic-0"/><BetMultipliers defaultIndex="0">1|2|3</BetMultipliers><CreditBets>40</CreditBets><Balances><Balance name="CASH_BALANCE" value="100000"/></Balances></GameResponse>';
  else {const step=fixture.steps[posts-1];assert(step);assert.equal(options.body,rhinoPayload(step.msgId,'synthetic-'+(posts-1)));text=step.responseXml;
   if(unknown&&posts===1)text=text.replace('<GameResult','<GameResult UNKNOWN="1"');}
  posts++;return {ok:true,headers:{getSetCookie:()=>[],get:()=>null},text:async()=>text};
 };
 let error;try{await runRhinoWorker({plan,baseGame:{mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'},shard:0,rpc,mappingHash:hash(profile),prepareRound:rhinoFields,evidence,shouldStop:()=>false,requestStop(){},onLease(){},commitSha:'a'.repeat(40),planHash:hash(plan),fetchImpl,limit:1,runId:'1',runAttempt:'1',job:'test'});}
 catch(e){error=e;}finally{parser.close();}
 return {error,posts,saved,record,pending,evidence};
}
test('Rhino worker persists Init, paid Logic, 13 free Logic and EndGame before full Python record',async()=>{
 const r=await run();assert.equal(r.error,undefined);assert.equal(r.posts,16);assert.equal(r.saved.length,16);assert.equal(r.record.normalized.bet,0.4);assert.equal(r.record.normalized.bonus,1);assert.equal(r.evidence.paidRoundRequests,1);assert(onePaidRound(basePlan,r.record.raw));
});
test('Rhino worker does not retry a response with unknown durability',async()=>{
 const r=await run({failDurability:true});assert.equal(r.error.code,'ACK_UNKNOWN');assert.equal(r.posts,2);assert(r.pending);assert.equal(r.record,null);
});
test('Rhino unknown feature is persisted before rejecting further requests',async()=>{
 const r=await run({unknown:true});assert.equal(r.error.code,'RHINO_UNKNOWN_FEATURE');assert.equal(r.posts,2);assert.equal(r.saved.length,2);assert.equal(r.record,null);
});
test('Rhino paid-round evidence counts the chain and rejects ambiguous continuation identities',()=>{
 const raw=rhinoFixture(8,{4:5});assert(onePaidRound(basePlan,raw));
 const prefix={...raw,steps:raw.steps.slice(0,5)};assert(!onePaidRound(basePlan,prefix));assert(onePaidRound(basePlan,prefix,{abandoned:true}));
 prefix.steps.at(-1).requestPayload=rhinoPayload('Logic','wrong');assert(!onePaidRound(basePlan,prefix,{abandoned:true}));
});
