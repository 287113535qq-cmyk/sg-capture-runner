import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fudaoleSession,fudaolePayload} from './sg-fudaole-source.mjs';
import {fudaoleCodec} from './sg-fudaole-codec.mjs';
import {bootstrap,review,settled,request} from './sg-fudaole-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32769'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20135" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>200|400|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=825)=>`<GameResponse type="Logic"><Header gameID="20135" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult totalStake="200" waysCount="243" totalWin="25" betID=""><MysteryRepSymbol isNudgingWild="N" isRedEnvlpJkpt="N" isSymPresent="N" replacementSymbolIndex="0"/><ReelResults numSpins="1"><ReelSpin reelsetIndex="0" anywayWinCount="1" scatterWinCount="0" totalWayWin="25" totalScatterWin="0" totalSpinWin="25" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex="0" winVal="25" ways="1" awardIndex="0">0|11|12</AnywayWin></ReelSpin></ReelResults><GameWinInfo totalWagerWin="25" totalBaseGameWin="25" totalFreeSpinsWin="0" totalPickJkptWin="0" maxWinValue="25000000" isMaxWin="N"/><GameRtpInfo targetedRtpValue="96.06"/></GameResult></GameResponse>`;
const end=(session='end',cash=825)=>`<GameResponse type="EndGame"><Header gameID="20135" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',fudaolePayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',fudaolePayload({MSGID:'EndGame'},'paid'),end())]});
test('Fu Dao Le transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 200/WagerInfo.totalStake',async()=>{
 let calls=0;const guards=[];const s=fudaoleSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=fudaoleSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>fudaoleSession({...ctx,plan:{...plan,runtimeGameId:20135},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(fudaolePayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Fu Dao Le actual Python IPC independently validates Init, ordinary routing, own AnywayWin money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await fudaoleCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,25/200);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,825);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Fu Dao Le rejects unknown awards, AnywayWin, MysteryRepSymbol, GameWinInfo and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["anywayWinCount=\"1\"", "anywayWinCount=\"2\""], ["scatterWinCount=\"0\"", "scatterWinCount=\"1\""], ["totalStake=\"200\"", "totalStake=\"201\""], ["waysCount=\"243\"", "waysCount=\"244\""], ["isMaxWin=\"N\"", "isMaxWin=\"Y\""], ["totalFreeSpinsWin=\"0\"", "totalFreeSpinsWin=\"1\""], ["totalPickJkptWin=\"0\"", "totalPickJkptWin=\"1\""], ["winVal=\"25\"", "winVal=\"26\""], ["ways=\"1\"", "ways=\"99999\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["winIndex=\"0\"", "winIndex=\"1\""], [">0|11|12</AnywayWin>", ">0|1|15</AnywayWin>"], ["totalWayWin=\"25\"", "totalWayWin=\"26\""], ["totalSpinWin=\"25\"", "totalSpinWin=\"26\""], ["totalScatterWin=\"0\"", "totalScatterWin=\"1\""], ["totalWin=\"25\"", "totalWin=\"26\""], ["totalBaseGameWin=\"25\"", "totalBaseGameWin=\"26\""], ["totalWagerWin=\"25\"", "totalWagerWin=\"26\""], ["</GameResult>", "<Feature index=\"1\" name=\"FreeGame\"><data remainingFreeSpins=\"8\" extraFreeSpinsAwarded=\"0\" totalFreeSpinsPlayed=\"0\" freeSpinTriggerWin=\"400\"/></Feature></GameResult>"], ["</GameResult>", "<Feature index=\"2\" name=\"PickGame\"/></GameResult>"], ["</ReelSpin>", "<ScatterWin winIndex=\"0\" awardIndex=\"30\" winVal=\"3800\">0|1|2</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["<Header gameID", "<Header readyForEndGame=\"Y\" gameID"], ["<GameWinInfo", "unexpected<GameWinInfo"], ["maxWinValue=\"25000000\"", "maxWinValue=\"1\""], ["targetedRtpValue=\"96.06\"", "targetedRtpValue=\"96.07\""], ["isRedEnvlpJkpt=\"N\"", "isRedEnvlpJkpt=\"Y\""], ["<MysteryRepSymbol", "<MysteryRepSymbol unknown=\"1\""], ["replacementSymbolIndex=\"0\"", "replacementSymbolIndex=\"10\""], ["</GameResult>", "<BGInfo/></GameResult>"]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Fu Dao Le requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<Balances>','<AccountData/><Balances>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',826));assert.throws(()=>review(bad),/BALANCE/);
});
test('Fu Dao Le bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=fudaolePayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('200|400|','199|400|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'fudaole_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Fu Dao Le unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32769'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>fudaoleSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>fudaoleCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Fu Dao Le without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32769',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Fu Dao Le pinned MysteryRepSymbol joint shapes do not add awards and WagerInfo featureBet stays fixed',()=>{
 const r=raw();assert.equal(review(r).win,25);r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace("<MysteryRepSymbol isNudgingWild=\"N\" isRedEnvlpJkpt=\"N\" isSymPresent=\"N\" replacementSymbolIndex=\"0\"/>","<MysteryRepSymbol isNudgingWild=\"Y\" isRedEnvlpJkpt=\"N\" isSymPresent=\"Y\" nudgingWildPositions=\"7|12\" replacementSymbolIndex=\"9\"/>");assert.equal(review(r).win,25);
 const bad=structuredClone(r);bad.steps[0].responsePayload=bad.steps[0].responseXml=bad.steps[0].responseXml.replace('nudgingWildPositions="7|12"','nudgingWildPositions="0"');assert.throws(()=>review(bad),/MYSTERY/);
 for(const [from,to] of [['<WagerInfo','unknown<WagerInfo'],['totalStake="200"','totalStake="201"'],['featureBet="0"','featureBet="1"'],['WagerInfo','Stake']])assert.throws(()=>request(fudaolePayload({MSGID:'Logic'},'first',true).replace(from,to),'Logic',true));
});
