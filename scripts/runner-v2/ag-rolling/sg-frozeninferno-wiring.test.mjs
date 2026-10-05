import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frozeninfernoSession,frozeninfernoPayload} from './sg-frozeninferno-source.mjs';
import {frozeninfernoCodec} from './sg-frozeninferno-codec.mjs';
import {bootstrap,review,settled,request} from './sg-frozeninferno-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32768'];
const init=(session='rotated',balance=10000)=>`<GameResponse type="Init"><Header gameID="20090" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>5000|10000|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=5625)=>`<GameResponse type="Logic"><Header gameID="20090" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="5000" stakePerLine="125" paylineCount="40" totalWin="625" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="625" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="625" awardIndex="0" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><WildInfo><WildData mode="0" wildCount="1" previousWild="0" CurrentWild="-1" direction="1">5</WildData></WildInfo><BaseGame gameMode="0" isMaxWin="N" maxWinValue="25000000"/></GameResult></GameResponse>`;
const end=(session='end',cash=5625)=>`<GameResponse type="EndGame"><Header gameID="20090" versionID="1_0" isRecovering="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:10000,
 steps:[step('Logic',frozeninfernoPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',frozeninfernoPayload({MSGID:'EndGame'},'paid'),end())]});
test('Frozen Inferno transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 5000/SpinInfo.total',async()=>{
 let calls=0;const guards=[];const s=frozeninfernoSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=frozeninfernoSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>frozeninfernoSession({...ctx,plan:{...plan,runtimeGameId:20090},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(frozeninfernoPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Frozen Inferno actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await frozeninfernoCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),10000);
  const r=codec.createRaw({balance:10000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,625/5000);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,5625);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Frozen Inferno rejects unknown awards, Payline, WildData, BaseGame and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"5000\"", "stake=\"5001\""], ["stakePerLine=\"125\"", "stakePerLine=\"126\""], ["paylineCount=\"40\"", "paylineCount=\"41\""], ["isMaxWin=\"N\"", "isMaxWin=\"Y\""], ["winVal=\"625\"", "winVal=\"626\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"40\""], [">0|1|2</PaylineWin>", ">0|1|20</PaylineWin>"], ["spinWins=\"625\"", "spinWins=\"626\""], ["totalWin=\"625\"", "totalWin=\"626\""], ["<BaseGame", "<UnknownFeature/><BaseGame"], ["</GameResult>", "<FSInfo/></GameResult>"], ["</GameResult>", "<Feature index=\"1\" name=\"FreeGames\"><data mode=\"0\" bonusPos=\"9\"/></Feature></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"0\" winVal=\"0\">0|1</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["<Header gameID", "<Header readyForEndGame=\"Y\" gameID"], ["<BaseGame", "unexpected<BaseGame"], ["maxWinValue=\"25000000\"", "maxWinValue=\"1\""], ["gameMode=\"0\"", "gameMode=\"1\""], ["<WildData", "<WildData unknown=\"1\""], ["CurrentWild=\"-1\"", "CurrentWild=\"-2\""], ["direction=\"1\"", "direction=\"4\""], ["<WildInfo><WildData mode=\"0\" wildCount=\"1\" previousWild=\"0\" CurrentWild=\"-1\" direction=\"1\">5</WildData></WildInfo>", "<WildInfo><WildData mode=\"0\" wildCount=\"1\" previousWild=\"999\" CurrentWild=\"-1\" direction=\"1\">5</WildData></WildInfo>"]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Frozen Inferno requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<Balances>','<AccountData/><Balances>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',5626));assert.throws(()=>review(bad),/BALANCE/);
});
test('Frozen Inferno bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=frozeninfernoPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('5000|10000|','4999|10000|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'frozeninferno_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Frozen Inferno unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32768'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>frozeninfernoSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>frozeninfernoCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Frozen Inferno without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32768',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Frozen Inferno pinned WildData joint shape does not add an award and own SpinInfo modes stay fixed',()=>{
 const r=raw();assert.equal(review(r).win,625);r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace("<WildInfo><WildData mode=\"0\" wildCount=\"1\" previousWild=\"0\" CurrentWild=\"-1\" direction=\"1\">5</WildData></WildInfo>","<WildInfo><WildData mode=\"0\" wildCount=\"4\" previousWild=\"9|14|13|18\" CurrentWild=\"-1\" direction=\"2\">8|13|12|17</WildData></WildInfo>");assert.equal(review(r).win,625);
 const bad=structuredClone(r);bad.steps[0].responsePayload=bad.steps[0].responseXml=bad.steps[0].responseXml.replace('direction="2"','direction="4"');assert.throws(()=>review(bad),/WILD/);
 for(const [from,to] of [['<SpinInfo','unknown<SpinInfo'],['total="5000"','total="5001"'],['mode="0"','mode="1"'],['isReset="0"','isReset="1"'],['modeChange="0"','modeChange="1"'],['perLine="125"','perLine="126"']])assert.throws(()=>request(frozeninfernoPayload({MSGID:'Logic'},'first',true).replace(from,to),'Logic',true));
});
