import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {blazingSession,blazingPayload} from './sg-blazing-source.mjs';
import {blazingCodec} from './sg-blazing-codec.mjs';
import {bootstrap,review,settled} from './sg-blazing-x.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32755'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20363" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>240|480|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=820)=>`<GameResponse type="Logic"><Header gameID="20363" versionID="1_0" isRecovering="N" readyForEndGame="Y" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="240" stakePerLine="20" paylineCount="40" totalWin="60" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="60" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="60" awardIndex="1" awardTableIndex="0"/></ReelSpin></ReelResults><XInfo currentX="1" previousX="1" currSpinToReset="0" prevSpinToReset="0"/><BGInfo totalWagerWin="60" bgWinnings="60" isMaxWin="0"/></GameResult></GameResponse>`;
const end=(session='end',cash=820)=>`<GameResponse type="EndGame"><Header gameID="20363" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',blazingPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',blazingPayload({MSGID:'EndGame'},'paid'),end())]});
test('Blazing X transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic',async()=>{
 let calls=0;const guards=[];const s=blazingSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=blazingSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>blazingSession({...ctx,plan:{...plan,runtimeGameId:20363},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(blazingPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Blazing X actual Python IPC independently validates Init, ordinary routing, money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await blazingCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,0.25);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,820);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Blazing X rejects special flags, unknown nodes/X states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [['freeSpin="N"','freeSpin="Y"'],['bonusAwarded="N"','bonusAwarded="Y"'],['currentX="1"','currentX="4"'],
  ['isMaxWin="0"','isMaxWin="1"'],['prevSpinToReset="0"','prevSpinToReset="4"'],['paylineCount="40"','paylineCount="39"'],
  ['winVal="60"','winVal="61"'],['readyForEndGame="Y"','readyForEndGame="N"'],['</GameResult>','<FSInfo/></GameResult>']]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Blazing X requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',821));assert.throws(()=>review(bad),/BALANCE/);
});
test('Blazing X bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=blazingPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('240|480|','99|480|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'blazing_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Blazing X unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32755'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>blazingSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>blazingCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Blazing X without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32755',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

const freeRaw=()=>JSON.parse(fs.readFileSync('service/tests/fixtures/blazing-ten-free.json'));
test('Blazing X actual dual IPC follows all ten Header-only free Logics and credits the trigger once',async()=>{
 const r=freeRaw(),parser=analyzer(),session={session:'synthetic-0',setSession(v){this.session=v;}};
 const codec=await blazingCodec({plan,session,sequence:()=>1,worker:1,batchId:2,createAnalyzer:()=>parser});
 try{const prefix=codec.createRaw({balance:r.startBalanceRaw});for(const s of r.steps){const n=await codec.next(prefix);assert.equal(n.MSGID,s.msgId);assert.equal(codec.guardMsg(n.MSGID,codec.payload(n)),prefix.steps.length===0?'BET':s.msgId);prefix.steps.push(s);}
  assert.equal(await codec.next(prefix),null);const p=await codec.prepare(prefix,{attempt:'offline-free',sessionHash:'a'.repeat(64)});
  assert.equal(p.record.bonus,1);assert.equal(p.record.normalized.money.totalWinRaw,8540);assert.equal(p.endBalanceRaw,108300);
  assert.throws(()=>settled({...r,steps:r.steps.slice(0,11)},'a'.repeat(64)),/INCOMPLETE/);
  for(const [index,from,to] of [[1,'freeSpinNumber="1"','freeSpinNumber="2"'],[1,'prevFSX="2"','prevFSX="1"'],[1,'fsWinnings="2760"','fsWinnings="2761"'],[2,'freeSpinsTotal="10"','freeSpinsTotal="11"'],[1,'<ReelStops>','<Unknown/> <ReelStops>'],[10,'readyForEndGame="Y"','readyForEndGame="N"']]){
   const bad=structuredClone(r),s=bad.steps[index];assert(s.responsePayload.includes(from));s.responsePayload=s.responseXml=s.responseXml.replace(from,to);assert.throws(()=>review(bad));await assert.rejects(()=>parser.call({op:'fields',plan,raw:bad}));
  }
 }finally{codec.close();parser.close();}
});
test('Blazing X sole paid request is resource-guarded BET while Header-only free remains Logic',async()=>{
 const guards=[],s=blazingSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>({ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>logic()})});
 try{await s.send(blazingPayload({MSGID:'Logic'},s.session,true),'Logic');await s.send(blazingPayload({MSGID:'Logic'},s.session,false),'Logic');assert.deepEqual(guards.map(v=>v.msgId),['BET','Logic']);assert(!blazingPayload({MSGID:'Logic'},s.session).includes('<Stake'));}finally{s.close();}
});
