import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dragonspinSession,dragonspinPayload} from './sg-dragonspin-source.mjs';
import {dragonspinCodec} from './sg-dragonspin-codec.mjs';
import {bootstrap,review,settled,request} from './sg-dragonspin-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32764'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20117" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>210|420|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=804)=>`<GameResponse type="Logic"><Header gameID="20117" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="210" stakePerLine="7" paylineCount="30" totalWin="14" betID=""><BonusData BonusBet="0"/><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="14" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="14" awardIndex="4" awardTableIndex="0">10|11|12</PaylineWin></ReelSpin></ReelResults><MSReplacement symbolCount="2">5|5|5|7|7</MSReplacement><BGInfo totalWagerWin="14" bgWinnings="14" baseGameSpinsRemaining="0" isMaxWin="0"/></GameResult></GameResponse>`;
const end=(session='end',cash=804)=>`<GameResponse type="EndGame"><Header gameID="20117" versionID="1_0" isRecovering="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',dragonspinPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',dragonspinPayload({MSGID:'EndGame'},'paid'),end())]});
test('Dragon Spin transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 210/Stake.total',async()=>{
 let calls=0;const guards=[];const s=dragonspinSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=dragonspinSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>dragonspinSession({...ctx,plan:{...plan,runtimeGameId:20117},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(dragonspinPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Dragon Spin actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await dragonspinCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,14/210);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,804);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Dragon Spin rejects unknown awards, Payline, BonusData, MSReplacement and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"210\"", "stake=\"211\""], ["stakePerLine=\"7\"", "stakePerLine=\"8\""], ["paylineCount=\"30\"", "paylineCount=\"31\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["baseGameSpinsRemaining=\"0\"", "baseGameSpinsRemaining=\"1\""], ["winVal=\"14\"", "winVal=\"15\""], ["awardIndex=\"4\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"30\""], [">10|11|12</PaylineWin>", ">0|1|15</PaylineWin>"], ["spinWins=\"14\"", "spinWins=\"15\""], ["totalWin=\"14\"", "totalWin=\"15\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<FSInfo/></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"0\" winVal=\"0\">0|1</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""], ["<BGInfo", "unexpected<BGInfo"], ["BonusBet=\"0\"", "BonusBet=\"1\""], ["symbolCount=\"2\"", "symbolCount=\"4\""], [">5|5|5|7|7</MSReplacement>", ">0|0|0|0|10</MSReplacement>"], ["<MSReplacement", "<MSReplacement unknown=\"1\""]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Dragon Spin requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<Balances>','<AccountData/><Balances>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',805));assert.throws(()=>review(bad),/BALANCE/);
});
test('Dragon Spin bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=dragonspinPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('210|420|','209|420|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'dragonspin_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Dragon Spin unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32764'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>dragonspinSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>dragonspinCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Dragon Spin without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32764',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Dragon Spin pins its own MSReplacement count/text without treating replacement as another award',()=>{
 const r=raw();assert.equal(review(r).win,14);
 r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace('<MSReplacement symbolCount="2">5|5|5|7|7</MSReplacement>','<MSReplacement symbolCount="3">0|0|0|1|2</MSReplacement>');assert.equal(review(r).win,14);
 const bad=structuredClone(r);bad.steps[0].responsePayload=bad.steps[0].responseXml=bad.steps[0].responseXml.replace('symbolCount="3"','symbolCount="4"');assert.throws(()=>review(bad),/REPLACEMENT/);
 for(const payload of [dragonspinPayload({MSGID:'Logic'},'first',true).replace('<Stake','unknown<Stake'),dragonspinPayload({MSGID:'Logic'},'first',true).replace('total="210"','total="211"')])assert.throws(()=>request(payload,'Logic',true));
});
