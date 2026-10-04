import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {jekyllSession,jekyllPayload} from './sg-jekyll-source.mjs';
import {jekyllCodec} from './sg-jekyll-codec.mjs';
import {bootstrap,review,settled,request} from './sg-jekyll-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32763'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20126" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>100|200|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=950)=>`<GameResponse type="Logic"><Header gameID="20126" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="100" stakePerLine="10" paylineCount="10" totalWin="50" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="50" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops><PaylineWin index="0" winVal="50" awardIndex="0" awardTableIndex="0">6|10</PaylineWin></ReelSpin></ReelResults><BGInfo totalWagerWin="50" bgWinnings="50" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0"/></GameResult></GameResponse>`;
const end=(session='end',cash=950)=>`<GameResponse type="EndGame"><Header gameID="20126" versionID="1_0" isRecovering="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',jekyllPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',jekyllPayload({MSGID:'EndGame'},'paid'),end())]});
test('Dr. Jekyll Goes Wild transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 100/Stake.total/isBigBet0',async()=>{
 let calls=0;const guards=[];const s=jekyllSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=jekyllSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>jekyllSession({...ctx,plan:{...plan,runtimeGameId:20126},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(jekyllPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Dr. Jekyll Goes Wild actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await jekyllCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,50/100);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,950);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Dr. Jekyll Goes Wild rejects unknown awards, Payline, QuickHits, Symbol/WildReel and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"100\"", "stake=\"101\""], ["stakePerLine=\"10\"", "stakePerLine=\"11\""], ["paylineCount=\"10\"", "paylineCount=\"11\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["isBigBet=\"0\"", "isBigBet=\"1\""], ["baseGameSpinsRemaining=\"0\"", "baseGameSpinsRemaining=\"1\""], ["winVal=\"50\"", "winVal=\"51\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"10\""], [">6|10</PaylineWin>", ">0|1|15</PaylineWin>"], ["spinWins=\"50\"", "spinWins=\"51\""], ["totalWin=\"50\"", "totalWin=\"51\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<FSInfo/></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"0\" winVal=\"0\">0|1</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"2\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""], ["<BGInfo", "unexpected<BGInfo"]]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Dr. Jekyll Goes Wild requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<Balances>','<AccountData/><Balances>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',951));assert.throws(()=>review(bad),/BALANCE/);
});
test('Dr. Jekyll Goes Wild bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=jekyllPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('100|200|','99|200|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'jekyll_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Dr. Jekyll Goes Wild unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32763'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>jekyllSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>jekyllCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Dr. Jekyll Goes Wild without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32763',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Dr. Jekyll Goes Wild ordinary reelset 1 and its own two-position Payline do not authorize a zero-win scatter state',()=>{
 const r=raw();r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace('reelsetIndex="0"','reelsetIndex="1"');assert.equal(review(r).win,50);
 const bonus=structuredClone(r);bonus.steps[0].responsePayload=bonus.steps[0].responseXml=bonus.steps[0].responseXml.replace('bonusAwarded="N"','bonusAwarded="Y"');assert.throws(()=>review(bonus),/FEATURE/);
 for(const payload of [jekyllPayload({MSGID:'Logic'},'first',true).replace('<Stake','unknown<Stake'),jekyllPayload({MSGID:'Logic'},'first',true).replace('isBigBet="0"','isBigBet="1"')])assert.throws(()=>request(payload,'Logic',true));
});
