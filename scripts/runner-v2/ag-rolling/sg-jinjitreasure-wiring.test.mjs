import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {jinjitreasureSession,jinjitreasurePayload} from './sg-jinjitreasure-source.mjs';
import {jinjitreasureCodec} from './sg-jinjitreasure-codec.mjs';
import {bootstrap,review,settled,request} from './sg-jinjitreasure-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32778'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20322" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>16|32|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=994,game="<GameResult stake=\"16\" totalWin=\"10\" betID=\"\"><ReelResults numSpins=\"1\"><ReelSpin spinIndex=\"0\" reelsetIndex=\"0\" anywayWins=\"1\" scatterWinCount=\"0\" totalSpinWin=\"10\" freeSpin=\"N\" bonusAwarded=\"N\"><ReelStops>1|2|3|4|5</ReelStops><AnywayWin winIndex=\"0\" winVal=\"10\" ways=\"1\" awardIndex=\"3\">0|11|12</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin=\"10\" bgWinnings=\"10\" baseGameSpinsRemaining=\"0\" isMaxWin=\"0\" goldChanceAwarded=\"0\" jackpotAwarded=\"0\" gameMode=\"0\"/><MysterySymbol replacementSym=\"6\"/><ScatterInfo totalValue=\"48\" numScatters=\"3\" values=\"0|0|16|0|16|0|0|16|0|0|0|0|0|0|0\"/></GameResult>")=>`<GameResponse type="Logic"><Header gameID="20322" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances>${game}</GameResponse>`;
const end=(session='end',cash=994)=>`<GameResponse type="EndGame"><Header gameID="20322" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',jinjitreasurePayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',jinjitreasurePayload({MSGID:'EndGame'},'paid'),end())]});
test('Jin Ji Bao Xi Endless Treasures transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 16/Stake.total',async()=>{
 let calls=0;const guards=[];const s=jinjitreasureSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=jinjitreasureSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>jinjitreasureSession({...ctx,plan:{...plan,runtimeGameId:20322},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(jinjitreasurePayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Jin Ji Bao Xi Endless Treasures actual Python IPC independently validates Init, ordinary routing, own AnywayWin money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await jinjitreasureCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,10/16);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,994);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Jin Ji Bao Xi Endless Treasures rejects unknown awards, Payline, own MysterySymbol/ScatterInfo joint and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["anywayWins=\"1\"", "anywayWins=\"2\""], ["scatterWinCount=\"0\"", "scatterWinCount=\"1\""], ["stake=\"16\"", "stake=\"17\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["goldChanceAwarded=\"0\"", "goldChanceAwarded=\"1\""], ["jackpotAwarded=\"0\"", "jackpotAwarded=\"1\""], ["gameMode=\"0\"", "gameMode=\"1\""], ["baseGameSpinsRemaining=\"0\"", "baseGameSpinsRemaining=\"1\""], ["winVal=\"10\"", "winVal=\"11\""], ["awardIndex=\"3\"", "awardIndex=\"99999\""], ["ways=\"1\"", "ways=\"99999\""], ["winIndex=\"0\"", "winIndex=\"1\""], [">0|11|12</AnywayWin>", ">0|1|15</AnywayWin>"], ["totalSpinWin=\"10\"", "totalSpinWin=\"11\""], ["totalWin=\"10\"", "totalWin=\"11\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<DecisionInfo picksAwarded=\"1\" picksUsed=\"0\"/></GameResult>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""], ["<BGInfo", "unexpected<BGInfo"], ["replacementSym=\"6\"", "replacementSym=\"99999\""], ["totalValue=\"48\"", "totalValue=\"99999\""], ["numScatters=\"3\"", "numScatters=\"99\""], ["values=\"0|0|16|0|16|0|0|16|0|0|0|0|0|0|0\"", "values=\"0|16\""], ["stake=\"16\"", "stake=\"16\" stakePerLine=\"1\""], ["<BGInfo", "<BGInfo isBigBet=\"0\""]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Jin Ji Bao Xi Endless Treasures requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',995));assert.throws(()=>review(bad),/BALANCE/);
});
test('Jin Ji Bao Xi Endless Treasures bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=jinjitreasurePayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('16|32|','15|32|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'jinjitreasure_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Jin Ji Bao Xi Endless Treasures unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32778'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>jinjitreasureSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>jinjitreasureCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Jin Ji Bao Xi Endless Treasures without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32778',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('JinjiTreasure all 279 own MysterySymbol/ScatterInfo joints are shapes with no added ScatterInfo award; foreign request and win order stop',()=>{
 const policy=JSON.parse(fs.readFileSync('config/ag-rolling-jinjitreasure-base-contract.json'));
 for(const j of policy.stateJointPatterns){const g=`<GameResult stake="16" totalWin="0" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" anywayWins="0" scatterWinCount="0" totalSpinWin="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops></ReelSpin></ReelResults><BGInfo totalWagerWin="0" bgWinnings="0" baseGameSpinsRemaining="0" isMaxWin="0" goldChanceAwarded="0" jackpotAwarded="0" gameMode="0"/><MysterySymbol replacementSym="${j.mystery.replacementSym}"/><ScatterInfo totalValue="${j.scatter.totalValue}" numScatters="${j.scatter.numScatters}" values="${j.scatter.values}"/></GameResult>`;
  const r=raw();r.steps[0]=step('Logic',r.steps[0].requestPayload,logic('paid',984,g));r.steps[1]=step('EndGame',r.steps[1].requestPayload,end('end',984));assert.equal(review(r).win,0);assert.equal(review(r).balance,984);
 }
 for(const [from,to] of [['<Stake','unknown<Stake'],['total="16"','total="17"'],['gameMode="0"','gameMode="1"'],['count="1"','count="2"'],['<Stake','<Stake isBigBet="0"'],['Stake','WagerInfo']])assert.throws(()=>request(jinjitreasurePayload({MSGID:'Logic'},'first',true).replace(from,to),'Logic',true));
 const q=jinjitreasurePayload({MSGID:'Logic'},'first',true);assert.throws(()=>request(q.replace(/(<Header[^>]*\/>)(<Stake[^>]*\/>)/,'$2$1'),'Logic',true));
 const r=raw();r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace('winIndex="0"','winIndex="1"');assert.throws(()=>review(r),/ANYWAY/);
});
