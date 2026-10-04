import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {drumsexplosionSession,drumsexplosionPayload} from './sg-drumsexplosion-source.mjs';
import {drumsexplosionCodec} from './sg-drumsexplosion-codec.mjs';
import {bootstrap,review,settled} from './sg-drumsexplosion-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32761'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20454" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><AccountData><AccountData>synthetic-account</AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>176|352|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=834)=>`<GameResponse type="Logic"><Header gameID="20454" versionID="1_0" isRecovering="N" readyForEndGame="Y" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="176" totalWin="10" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="1" scatterWinCount="0" totalSpinWin="10" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex="0" winVal="10" ways="1" awardIndex="0">0|1|2</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin="10" bgWinnings="10" isMaxWin="0" wildReplace="0|0|0|0|0" bonusReplace="0|0|0|0|0"/></GameResult></GameResponse>`;
const end=(session='end',cash=834)=>`<GameResponse type="EndGame"><Header gameID="20454" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',drumsexplosionPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',drumsexplosionPayload({MSGID:'EndGame'},'paid'),end())]});
test('Dancing Drums Explosion transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 176/Stake.total',async()=>{
 let calls=0;const guards=[];const s=drumsexplosionSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=drumsexplosionSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>drumsexplosionSession({...ctx,plan:{...plan,runtimeGameId:20454},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(drumsexplosionPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Dancing Drums Explosion actual Python IPC independently validates Init, ordinary routing, money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await drumsexplosionCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,10/176);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,834);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Dancing Drums Explosion rejects unknown awards, ways, positions, DecisionInfo and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["anywayWins=\"1\"", "anywayWins=\"2\""], ["scatterWinCount=\"0\"", "scatterWinCount=\"1\""], ["stake=\"176\"", "stake=\"177\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["winVal=\"10\"", "winVal=\"11\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["ways=\"1\"", "ways=\"9999\""], ["winIndex=\"0\"", "winIndex=\"1\""], [">0|1|2</AnywayWin>", ">0|1|15</AnywayWin>"], ["totalSpinWin=\"10\"", "totalSpinWin=\"20\""], ["totalWin=\"10\"", "totalWin=\"20\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<DecisionInfo picksAwarded=\"1\" picksUsed=\"0\"/></GameResult>"], ["</GameResult>", "<FSInfo/></GameResult>"], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["<GameResult stake=\"176\"", "<GameResult stake=\"176\" stakePerLine=\"176\""], ["readyForEndGame=\"Y\"", "readyForEndGame=\"N\""], ["wildReplace=\"0|0|0|0|0\"", "wildReplace=\"1|0|0|0|0\""], ["bonusReplace=\"0|0|0|0|0\"", "bonusReplace=\"0|1|0|0|0\""]]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Dancing Drums Explosion requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);
 const ready=structuredClone(r);ready.steps[1].responsePayload=ready.steps[1].responseXml=ready.steps[1].responseXml.replace('readyForEndGame="N"','readyForEndGame="Y"');assert.throws(()=>review(ready),/ENDGAME/);
 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData>unknown</AccountData>');assert.throws(()=>review(content),/ENDGAME/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',835));assert.throws(()=>review(bad),/BALANCE/);
});
test('Dancing Drums Explosion bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=drumsexplosionPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('176|352|','175|352|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'drumsexplosion_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Dancing Drums Explosion unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32761'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>drumsexplosionSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>drumsexplosionCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Dancing Drums Explosion without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32761',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});
