import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {fiveSession,fivePayload} from './sg-five-source.mjs';
import {fiveCodec} from './sg-five-codec.mjs';
import {fiveBootstrap} from './sg-five-treasures.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32749'];
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline-only'};
const context={base,plan,queueId:'offline',kind:'worker',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const init=(session,balance=1000)=>`<GameResponse type="Init"><Header gameID="20442" versionID="1_0" isRecovering="N" sessionID="${session}" readyForEndGame="N"/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>176|352|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,response)=>({msgId:msg,requestPayload:payload,responsePayload:response,responseXml:response,
 responseBalance:Number(response.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const response=(msg,session,balance,award=0,total=0,number=null)=>`<GameResponse type="${msg==='FreeSpinChoice'?'Logic':msg}"><Header gameID="20442" versionID="1_0" isRecovering="N" sessionID="${session}" readyForEndGame="${msg==='EndGame'?'N':number===null||number===6?'Y':'N'}"/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances>`+
 (msg==='EndGame'?'':`<GameResult stake="176" totalWin="${award}"><BGInfo bgWinnings="10" totalWagerWin="${total}" isMaxWin="0"/>`+
 (number===null?'':`<FSInfo freeSpinsTotal="6" freeSpinNumber="${number}" extraSpinsAwarded="0" fsWinnings="${total-10}"${number?' freeSpinMode="4"':''}/>`)+
 `<ReelResults numSpins="1"><ReelSpin freeSpin="${number===null||number===0?'N':'Y'}" bonusAwarded="${number===0?'Y':'N'}" totalSpinWin="${award}"/></ReelResults></GameResult>`)+ '</GameResponse>';
test('Five transport separates catalog ID from WMS ID, scopes anonymous identities and never sends at construction',async()=>{
 let calls=0;const guard=[];
 const a=fiveSession({...context,guard:async r=>guard.push(r),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>['offline=one; Path=/']},text:async()=>init('rotated')};}});
 const b=fiveSession({...context,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(a.identity,b.identity);assert.notEqual(a.session,b.session);
 assert.throws(()=>fiveSession({...context,plan:{...plan,runtimeGameId:20442},fetchSource:async()=>{}}),/WMS_SOURCE_SCOPE/);
 const previous=a.session,answer=await a.send(fivePayload({MSGID:'Init'},previous),'Init');
 assert.equal(calls,1);assert.equal(answer.responseBalance,1000);assert.equal(a.session,previous);
 const checked=fiveBootstrap(answer,previous);a.setSession(checked.session);assert.equal(a.session,'rotated');
 assert.equal(b.session.startsWith('Free:'),true);assert.equal(guard[0].stage,'request');a.close();b.close();
});
test('Five bootstrap, all natural free choices, fields and full record verification use the actual Python IPC',async()=>{
 const session=fiveSession({...context,fetchSource:async()=>{throw Error('offline-only');}}),parser=analyzer();
 let codec;
 try{
  codec=await fiveCodec({plan,session,sequence:()=>1,worker:0,batchId:1,createAnalyzer:()=>parser});
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('offline-start'))),1000);
  const raw=codec.createRaw({balance:1000});let balance=1000,total=0,choiceCalls=0;
  for(let i=0;i<=6;i++){
   const next=await codec.next(raw,options=>{choiceCalls++;assert.equal(options.length,5);return options[4];});
   assert.equal(next.MSGID,i===1?'FreeSpinChoice':'Logic');
   const payload=codec.payload(next);assert.equal(codec.guardMsg(next.MSGID,payload),i===0?'BET':next.MSGID);
   const award=10+i;total+=award;balance+=award-(i===0?176:0);
   raw.steps.push(step(next.MSGID,payload,response(next.MSGID,'offline-'+i,balance,award,total,i)));
  }
  const end=await codec.next(raw);assert.equal(end.MSGID,'EndGame');
  raw.steps.push(step('EndGame',codec.payload(end),response('EndGame','offline-end',balance)));
  assert.equal(await codec.next(raw),null);assert.equal(choiceCalls,1);
  const prepared=await codec.prepare(raw,{attempt:'offline-attempt',sessionHash:'a'.repeat(64)});
  assert.equal(prepared.record.bet,1.76);assert.equal(prepared.record.bonus,1);
  assert.equal(prepared.endBalanceRaw,915);assert.equal(prepared.optionIndex,5);assert.equal(prepared.independentlyVerified,true);
  const wrong=structuredClone(prepared.record);wrong.raw.steps[4].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:wrong.raw,record:wrong}),/WMS_BALANCE_MISMATCH/);
 }finally{codec?.close();parser.close();session.close();}
});
test('Five Init rejects recovery, wrong stake capability and inconsistent cash before any paid request',()=>{
 const payload=fivePayload({MSGID:'Init'},'offline-init'),valid=step('Init',payload,init('offline-start'));
 for(const [from,to] of [['isRecovering="N"','isRecovering="Y"'],['176|352|','175|352|'],['readyForEndGame="N"','readyForEndGame="Y"']]){
  const bad={...valid,responsePayload:valid.responsePayload.replace(from,to),responseXml:valid.responseXml.replace(from,to)};
  assert.throws(()=>fiveBootstrap(bad,'offline-init'),/WMS_INIT_REQUIRES_REVIEW|WMS_RESPONSE_IDENTITY/);
 }
 assert.throws(()=>fiveBootstrap({...valid,responseBalance:999},'offline-init'),/BALANCE/);
});
test('Unknown Five source outcome preserves its durable intent and issues no retry or paid request',async()=>{
 let calls=0,intents=0,responses=0;let closed;
 const protocol=createProtocolSessions({game:{gameId:'32749'},queueId:'offline',kind:'worker',index:1,owner:'offline-owner',plan,
  guard:async()=>{},spoolFactory:()=>({append(){},confirmed(){},close(){}}),
  journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},
   close:async r=>{closed=r;},auditSources:async()=>{}},
  createSession:ctx=>fiveSession({...context,...ctx,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_plan,session)=>fiveCodec({plan,session,sequence:()=>1,worker:0,batchId:1})});
 const session=await protocol.open();
 await assert.rejects(()=>session.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await session.close();
 assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);
 assert.equal(closed.unknownRequests,1);assert.equal(closed.awaiting,1);assert.equal(closed.ready,false);
});
