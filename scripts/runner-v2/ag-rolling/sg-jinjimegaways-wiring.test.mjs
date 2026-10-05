import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {jinjimegawaysSession,jinjimegawaysPayload} from './sg-jinjimegaways-source.mjs';
import {jinjimegawaysCodec} from './sg-jinjimegaways-codec.mjs';
import {bootstrap,review,settled,request} from './sg-jinjimegaways-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32777'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20468" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>88|176|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=924,game="<GameResult stake=\"88\" totalWin=\"12\" betID=\"\"><ReelResults numSpins=\"1\"><ReelSpin spinIndex=\"0\" reelsetIndex=\"0\" anywayWins=\"1\" scatterWinCount=\"0\" totalSpinWin=\"12\" freeSpin=\"N\" bonusAwarded=\"N\"><ReelStops>1|2|3|4|5|6</ReelStops><AnywayWin winIndex=\"0\" winVal=\"12\" ways=\"1\" awardIndex=\"0\">0|19|38</AnywayWin></ReelSpin></ReelResults><BGInfo totalWagerWin=\"12\" bgWinnings=\"12\" reelHeights=\"2|3|2|4|3|4\" isMaxWin=\"0\"/><TopReelInfo reelSetIndex=\"9\" reelStop=\"0\" positions=\"37|38|39|40\"/></GameResult>")=>`<GameResponse type="Logic"><Header gameID="20468" versionID="1_0" isRecovering="N" readyForEndGame="Y" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances>${game}<SymbolGrids/></GameResponse>`;
const end=(session='end',cash=924)=>`<GameResponse type="EndGame"><Header gameID="20468" versionID="1_0" isRecovering="N" readyForEndGame="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',jinjimegawaysPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',jinjimegawaysPayload({MSGID:'EndGame'},'paid'),end())]});
test('Jin Ji Bao Xi Endless Treasure Megaways transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 88/Stake.total',async()=>{
 let calls=0;const guards=[];const s=jinjimegawaysSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=jinjimegawaysSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>jinjimegawaysSession({...ctx,plan:{...plan,runtimeGameId:20468},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(jinjimegawaysPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Jin Ji Bao Xi Endless Treasure Megaways actual Python IPC independently validates Init, ordinary routing, own AnywayWin money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await jinjimegawaysCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,12/88);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,924);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Jin Ji Bao Xi Endless Treasure Megaways rejects unknown awards, Payline, own reel-height joint and TopReelInfo and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["anywayWins=\"1\"", "anywayWins=\"2\""], ["scatterWinCount=\"0\"", "scatterWinCount=\"1\""], ["stake=\"88\"", "stake=\"89\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["winVal=\"12\"", "winVal=\"13\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["ways=\"1\"", "ways=\"99999\""], ["winIndex=\"0\"", "winIndex=\"1\""], [">0|19|38</AnywayWin>", ">0|1|41</AnywayWin>"], ["totalSpinWin=\"12\"", "totalSpinWin=\"13\""], ["totalWin=\"12\"", "totalWin=\"13\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<PickInfo buyPassTrigger=\"0\" picksAwarded=\"1\"/></GameResult>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"4\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["readyForEndGame=\"Y\"", "readyForEndGame=\"N\""], ["<BGInfo", "unexpected<BGInfo"], ["reelHeights=\"2|3|2|4|3|4\"", "reelHeights=\"8|2|2|2|2|2\""], ["reelSetIndex=\"9\"", "reelSetIndex=\"8\""], ["reelStop=\"0\"", "reelStop=\"89\""], ["positions=\"37|38|39|40\"", "positions=\"37|38|40|39\""], ["<SymbolGrids/>", "<SymbolGrids>0</SymbolGrids>"], ["stake=\"88\"", "stake=\"88\" stakePerLine=\"1\""], ["<BGInfo", "<BGInfo isBigBet=\"0\""]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Jin Ji Bao Xi Endless Treasure Megaways requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',925));assert.throws(()=>review(bad),/BALANCE/);
});
test('Jin Ji Bao Xi Endless Treasure Megaways bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=jinjimegawaysPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('88|176|','87|176|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'jinjimegaways_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Jin Ji Bao Xi Endless Treasure Megaways unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32777'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>jinjimegawaysSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>jinjimegawaysCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Jin Ji Bao Xi Endless Treasure Megaways without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32777',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('JinjiMegaways all 937 own reel-height joints and TopReelInfo shapes add no second reward; wrong win order, requests and EndGame readiness stop',()=>{
 const policy=JSON.parse(fs.readFileSync('config/ag-rolling-jinjimegaways-base-contract.json'));
 for(const j of policy.reelHeightJointPatterns){const g=`<GameResult stake="88" totalWin="0" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="${j.reelsetIndex}" anywayWins="0" scatterWinCount="0" totalSpinWin="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops></ReelSpin></ReelResults><BGInfo totalWagerWin="0" bgWinnings="0" reelHeights="${j.reelHeights}" isMaxWin="0"/><TopReelInfo reelSetIndex="9" reelStop="88" positions="37|38|39|40"/></GameResult>`;
  const r=raw();r.steps[0]=step('Logic',r.steps[0].requestPayload,logic('paid',912,g));r.steps[1]=step('EndGame',r.steps[1].requestPayload,end('end',912));assert.equal(review(r).win,0);assert.equal(review(r).balance,912);
 }
 for(const [from,to] of [['<Stake','unknown<Stake'],['total="88"','total="89"'],['<Stake','<Stake isBigBet="0"'],['Stake','WagerInfo']])assert.throws(()=>request(jinjimegawaysPayload({MSGID:'Logic'},'first',true).replace(from,to),'Logic',true));
 const q=jinjimegawaysPayload({MSGID:'Logic'},'first',true);assert.throws(()=>request(q.replace(/(<AccountData>.*?<\/AccountData>)(<Header[^>]*\/>)/,'$2$1'),'Logic',true));
 const r=raw();r.steps[1].responsePayload=r.steps[1].responseXml=r.steps[1].responseXml.replace('readyForEndGame="N"','readyForEndGame="Y"');assert.throws(()=>review(r),/ENDGAME/);
});
