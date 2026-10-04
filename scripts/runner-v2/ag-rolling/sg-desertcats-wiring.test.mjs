import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {desertcatsSession,desertcatsPayload} from './sg-desertcats-source.mjs';
import {desertcatsCodec} from './sg-desertcats-codec.mjs';
import {bootstrap,review,settled} from './sg-desertcats-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32762'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20315" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>200|400|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=2804)=>`<GameResponse type="Logic"><Header gameID="20315" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="200" stakePerLine="4" paylineCount="50" totalWin="2004" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="4" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6|7</ReelStops><PaylineWin index="0" winVal="4" awardIndex="0" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><BGInfo totalWagerWin="2004" bgWinnings="2004" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0"/><QuickHits winValue="2000" numOfGems="6"/><Symbol replacement="1"/><WildReel pattern="0|0|0|0|0|1|1"/></GameResult></GameResponse>`;
const end=(session='end',cash=2804)=>`<GameResponse type="EndGame"><Header gameID="20315" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',desertcatsPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',desertcatsPayload({MSGID:'EndGame'},'paid'),end())]});
test('Desert Cats transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 200/Stake.total/PaylineCount50',async()=>{
 let calls=0;const guards=[];const s=desertcatsSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=desertcatsSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>desertcatsSession({...ctx,plan:{...plan,runtimeGameId:20315},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(desertcatsPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Desert Cats actual Python IPC independently validates Init, ordinary routing, separate QuickHits money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await desertcatsCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,2004/200);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,2804);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Desert Cats rejects unknown awards, Payline, QuickHits, Symbol/WildReel and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"200\"", "stake=\"201\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["isBigBet=\"0\"", "isBigBet=\"1\""], ["baseGameSpinsRemaining=\"0\"", "baseGameSpinsRemaining=\"1\""], ["winVal=\"4\"", "winVal=\"5\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"50\""], [">0|1|2</PaylineWin>", ">0|1|28</PaylineWin>"], ["spinWins=\"4\"", "spinWins=\"2004\""], ["totalWin=\"2004\"", "totalWin=\"2000\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<DecisionInfo/></GameResult>"], ["</GameResult>", "<FSInfo/></GameResult>"], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["numOfGems=\"6\"", "numOfGems=\"7\""], ["winValue=\"2000\"", "winValue=\"0\""], ["replacement=\"1\"", "replacement=\"11\""], ["pattern=\"0|0|0|0|0|1|1\"", "pattern=\"0|0|0|0|0|0|0\""], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""]]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Desert Cats requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData>unknown</AccountData>');assert.throws(()=>review(content),/FEATURE_NOT_ADAPTED/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',2805));assert.throws(()=>review(bad),/BALANCE/);
});
test('Desert Cats bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=desertcatsPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('200|400|','199|400|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'desertcats_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Desert Cats unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32762'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>desertcatsSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>desertcatsCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Desert Cats without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32762',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Desert Cats adds the separate QuickHits award once and keeps the reel spinWins at the Payline sum',()=>{
 const r=raw();assert.equal(review(r).win,2004);assert.equal(review(r).balance,2804);
 const doubled=structuredClone(r);for(const s of doubled.steps){s.responsePayload=s.responseXml=s.responseXml.replaceAll('2004','4004').replaceAll('2804','4804');s.responseBalance=4804;}assert.throws(()=>review(doubled),/REEL_WIN/);
 const b=structuredClone(r);b.steps[0].responsePayload=b.steps[0].responseXml=b.steps[0].responseXml.replace('<QuickHits','<QuickHits unknown="1"');assert.throws(()=>review(b));
});
