import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {arthurSession,arthurPayload} from './sg-arthur-source.mjs';
import {arthurCodec} from './sg-arthur-codec.mjs';
import {bootstrap,review,settled} from './sg-arthur-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32754'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20467" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>200|400|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const legacyPlan=({...(({arthurFeatureContract,arthurFeatureContractHash,...p})=>p)(plan),maxSteps:2});
const ctx={base,plan:legacyPlan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=850)=>`<GameResponse type="Logic"><Header gameID="20467" versionID="1_0" isRecovering="N" readyForEndGame="Y" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="200" stakePerLine="10" paylineCount="20" totalWin="50" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="50" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="50" awardIndex="1" awardTableIndex="0"/></ReelSpin></ReelResults><BGInfo totalWagerWin="50" bgWinnings="50" isMaxWin="0"/></GameResult><SymbolGrids>0|1|2|3|4;5|6|7|8|9;10|1|2|3|4</SymbolGrids></GameResponse>`;
const end=(session='end',cash=850)=>`<GameResponse type="EndGame"><Header gameID="20467" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',arthurPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',arthurPayload({MSGID:'EndGame'},'paid'),end())]});
test('Arthur transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic',async()=>{
 let calls=0;const guards=[];const s=arthurSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=arthurSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>arthurSession({...ctx,plan:{...legacyPlan,runtimeGameId:20467},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(arthurPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Arthur actual Python IPC independently validates Init, ordinary routing, money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await arthurCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,0.25);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,850);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Arthur rejects special flags, unknown nodes/grids, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [['freeSpin="N"','freeSpin="Y"'],['bonusAwarded="N"','bonusAwarded="Y"'],['reelsetIndex="0"','reelsetIndex="1"'],
  ['isMaxWin="0"','isMaxWin="1"'],['awardIndex="1"','awardIndex="18"'],['paylineCount="20"','paylineCount="19"'],
  ['winVal="50"','winVal="51"'],['10|1|2|3|4</SymbolGrids>','11|1|2|3|4</SymbolGrids>'],['<SymbolGrids>0|1|2|3|4;','<SymbolGrids>0|1|2|3;'],['readyForEndGame="Y"','readyForEndGame="N"'],['</GameResult>','<FSInfo/></GameResult>']]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Arthur requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',851));assert.throws(()=>review(bad),/BALANCE/);
});
test('Arthur bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=arthurPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('200|400|','99|400|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'arthur_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Arthur unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32754'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>arthurSession({...ctx,...c,plan:legacyPlan,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>arthurCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Arthur without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32754',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});
