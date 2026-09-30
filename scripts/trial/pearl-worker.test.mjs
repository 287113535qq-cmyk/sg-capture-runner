import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';import {analyzer} from '../runner-v2/analyzer.mjs';
import {protocolHash as hash} from '../runner-v2/protocol-resume.mjs';
import {runPearlWorker} from './pearl-worker.mjs';import {pearlFixture} from './pearl-fixture.mjs';
import {pearlPayload,pearlSession,PEARL_ENDPOINT} from './pearl-session.mjs';
import {retriggerFixture} from './pearl-retrigger-fixture.mjs';
import {PEARL_RETRIGGER_EXTENSION} from './pearl-retrigger-protocol.mjs';
import {applyFormalCount} from '../runner-v2/formal-count-plan.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {pearlFields}=require('../../collector/sg.pearl.ts');
const {pearlRetriggerFields}=require('../../collector/sg.pearl-retrigger.ts');
const basePlan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32795'];
const plan={...basePlan,demoGeneration:'f'.repeat(64)};
const profile=JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles[plan.sourceKey];

async function run({failDurability=false,unknown=false,formal=false,repair=false}={}){
 const plan=repair?applyFormalCount({32795:basePlan},JSON.parse(fs.readFileSync('config/formal-repair-pearl-20260930.json','utf8')))[32795]:{...basePlan,...(formal?{countAllocation:'b'.repeat(64)}:{demoGeneration:'f'.repeat(64)})};
 const analyzerPlan=repair?plan:basePlan;
 const parser=analyzer({python:process.env.PYTHON||'python3'});let posts=0,pending=null,raw=null,record=null,bootAwaiting=null;
 const saved=[],fixture=repair?retriggerFixture():pearlFixture(!formal),evidence={sourceRequests:0,paidRoundRequests:0,completedThisRun:0};
 if(formal&&!repair)for(const s of fixture.steps){s.responseXml=s.responseXml.replaceAll('="400"','="0"').replace('value="100200"','value="2400"');s.responsePayload=s.responseXml;}
 const baseGame={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
 const rawBase={fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:formal&&!repair?2600:100000,steps:[]};
 const lease={durable:0,sequenceTarget:100,batchId:1,epoch:1,...(formal?{countAllocation:plan.countAllocation}:{shortRunLimit:1}),pendingRound:null};
 let finished=false;
 const rpc=async(op,data)=>{
  if(op==='register')return {workerEpoch:1};if(op==='next')return lease;
  if(op==='bootstrap_intent'){bootAwaiting=data.requestPayload;return {};}
  if(op==='bootstrap_frame'){assert.equal(data.step.requestPayload,bootAwaiting);saved.push(data.step);await parser.call({op:'bootstrap',plan:analyzerPlan,raw:{},step:data.step});bootAwaiting=null;return {};}
  if(op==='begin'||op==='intent'){
   assert.equal(pending,null);if(op==='begin')raw=structuredClone(rawBase);
   await parser.call({op:'intent',plan:analyzerPlan,raw,payload:data.requestPayload});pending=data.requestPayload;return {};
  }
  if(op==='exchange_journal'){
   assert.equal(data.step.requestPayload,pending);
   if(failDurability)throw Object.assign(Error('ACK_UNKNOWN'),{code:'ACK_UNKNOWN'});
   saved.push(data.step);raw.steps.push(data.step);pending=null;
   const next=await parser.call({op:'next',plan:analyzerPlan,raw});
   if(!next){record=await parser.call({op:'record',plan:analyzerPlan,raw,normalized:data.normalized,sequence:1,attempt:'00000000-0000-0000-0000-000000000001',sessionHash:'b'.repeat(64),worker:0,batchId:1});}
   return {complete:!next,followingIntentDurable:false,checkpoint:0,...(record?{endBalanceRaw:record.normalized.money.endBalanceRaw}:{})};
  }
  if(op==='release'){assert(record);return {status:formal?'complete':'partial',checkpoint:1};}
  if(op==='finish_run'){finished=true;return {released:true};}
  if(op==='status')return {confirmed:record?1:0};throw Error('UNEXPECTED_RPC');
 };
 const fetchImpl=async(url,options)=>{
  assert.equal(url,PEARL_ENDPOINT);assert.equal(options.redirect,'manual');assert.equal(bootAwaiting??pending,options.body,'Every source call requires the durable matching intent');
  let text;
  if(posts===0){if(!formal)assert.equal(options.body,pearlPayload('Init',pearlSession(baseGame,plan,0)));
   text='<GameResponse type="Init"><Header gameID="20327" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="synthetic-0"/><Stakes defaultIndex="0">200|400</Stakes><Balances><Balance name="CASH_BALANCE" value="100000"/></Balances></GameResponse>';
   if(formal&&!repair)text=text.replace('value="100000"','value="2600"');
  }else{const step=fixture.steps[posts-1];assert(step);assert.equal(options.body,pearlPayload(step.msgId,'synthetic-'+(posts-1)));text=step.responseXml;
   if(unknown&&posts===1)text=text.replace('<BGInfo','<BGInfo NEWFEATURE="1"');}
  posts++;return {ok:true,headers:{getSetCookie:()=>[],get:()=>null},text:async()=>text};
 };
 let error;
 const extension=JSON.parse(fs.readFileSync('service/round_types.json','utf8')).profiles[PEARL_RETRIGGER_EXTENSION];
 try{await runPearlWorker({plan,baseGame,shard:0,rpc,mappingHash:hash(profile),extensionHash:repair?hash(extension):undefined,prepareRound:repair?pearlRetriggerFields:pearlFields,evidence,shouldStop:()=>repair&&evidence.completedThisRun>=1,requestStop(){},onLease(){},commitSha:'a'.repeat(40),planHash:hash(plan),fetchImpl,limit:1,runId:'1',runAttempt:'1',job:'test'});}
 catch(e){error=e;}finally{parser.close();}
 return {posts,error,saved,record,evidence,pending,finished};
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

test('formal session identity changes per process and cannot reuse a pilot generation',()=>{
 const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'},formal={...basePlan,countAllocation:'b'.repeat(64)};
 const a=pearlSession(base,formal,0,'11:1:00000000-0000-0000-0000-000000000001');
 const b=pearlSession(base,formal,0,'11:1:00000000-0000-0000-0000-000000000002');
 assert.notEqual(a,b);assert.notEqual(a,pearlSession(base,plan,0));
 assert.throws(()=>pearlSession(base,{...formal,demoGeneration:plan.demoGeneration},0,'11:1:00000000-0000-0000-0000-000000000001'));
 assert.throws(()=>pearlSession(base,formal,0,'11:2:00000000-0000-0000-0000-000000000001'));
});

test('formal worker finishes EndGame and releases before rotating a low demo balance',async()=>{
 const r=await run({formal:true});assert.equal(r.error,undefined);assert.equal(r.posts,3);
 assert.equal(r.evidence.completedThisRun,1);assert.equal(r.record.normalized.money.endBalanceRaw,2400);
 assert.equal(r.evidence.sessionBoundary,'settled-low-demo-balance');assert.equal(r.finished,true);
});

test('repaired worker persists sixteen free responses and EndGame through independent Python and collector',async()=>{
 const old=process.env.SG_FORMAL_COUNT_PROFILE;process.env.SG_FORMAL_COUNT_PROFILE='formal-repair-pearl-20260930.json';
 try{const r=await run({formal:true,repair:true});assert.equal(r.error,undefined);assert.equal(r.posts,19);assert.equal(r.saved.length,19);
  assert.equal(r.evidence.paidRoundRequests,1);assert.equal(r.evidence.completedThisRun,1);assert.equal(r.record.raw.steps.length,18);assert(r.finished);
 }finally{if(old===undefined)delete process.env.SG_FORMAL_COUNT_PROFILE;else process.env.SG_FORMAL_COUNT_PROFILE=old;}
});
