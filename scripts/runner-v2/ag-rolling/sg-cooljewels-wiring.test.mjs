import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cooljewelsSession,cooljewelsPayload} from './sg-cooljewels-source.mjs';
import {cooljewelsCodec} from './sg-cooljewels-codec.mjs';
import {bootstrap,review,settled} from './sg-cooljewels-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32758'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20150" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData>synthetic-account</AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>50|100|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=954)=>`<GameResponse type="Logic"><Header gameID="20150" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="50" stakePerLine="0" paylineCount="0" totalWin="4" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="0" winCountSC="0" spinWins="0" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops></ReelSpin></ReelResults><ReactorChain num_drops="2"><ReactorDrop drop_order="0" num_clusters="1"><ReactorLayout symbols="4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4"/><ReactorCluster id="0" cluster_positions="4,3|5,3|5,4|5,5" cluster_awards="1|1|1|1" rootSymbol="4" rootSymbolPos="0,0" watermark="0"/></ReactorDrop><ReactorDrop drop_order="1" num_clusters="0"><ReactorLayout symbols="4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4"/></ReactorDrop></ReactorChain><MaxWin_Info maxWinValue="25000000" maxWin="false" cappedWins="0"/></GameResult></GameResponse>`;
const end=(session='end',cash=954)=>`<GameResponse type="EndGame"><Header gameID="20150" versionID="1_0" isRecovering="N" sessionID="${session}"/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',cooljewelsPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',cooljewelsPayload({MSGID:'EndGame'},'paid'),end())]});
test('Cool Jewels transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for multiplier1/total50',async()=>{
 let calls=0;const guards=[];const s=cooljewelsSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=cooljewelsSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>cooljewelsSession({...ctx,plan:{...plan,runtimeGameId:20150},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(cooljewelsPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Cool Jewels actual Python IPC independently validates Init, ordinary routing, money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await cooljewelsCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,4/50);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,954);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Cool Jewels rejects special flags, unknown clusters/layouts/awards and nonterminal drops, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["paylineCount=\"0\"", "paylineCount=\"1\""], ["stake=\"50\"", "stake=\"51\""], ["maxWin=\"false\"", "maxWin=\"true\""], ["cappedWins=\"0\"", "cappedWins=\"1\""], ["maxWinValue=\"25000000\"", "maxWinValue=\"24000000\""], ["num_drops=\"2\"", "num_drops=\"3\""], ["drop_order=\"1\"", "drop_order=\"2\""], ["num_clusters=\"1\"", "num_clusters=\"2\""], ["cluster_awards=\"1|1|1|1\"", "cluster_awards=\"1|1|1|999\""], ["cluster_positions=\"4,3|5,3|5,4|5,5\"", "cluster_positions=\"4,3|5,3|5,4|6,5\""], ["rootSymbol=\"4\"", "rootSymbol=\"15\""], ["rootSymbolPos=\"0,0\"", "rootSymbolPos=\"5,5\""], ["watermark=\"0\"", "watermark=\"4\""], ["totalWin=\"4\"", "totalWin=\"5\""], ["spinWins=\"0\"", "spinWins=\"4\""], ["<ReactorChain", "<Feature index=\"0\"><FS_Info fsAwarded=\"8\"/></Feature><ReactorChain"], ["</GameResult>", "<Unknown/></GameResult>"], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4", "4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4|4"]]){
  const r=raw();r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Cool Jewels requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',955));assert.throws(()=>review(bad),/BALANCE/);
});
test('Cool Jewels bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=cooljewelsPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('50|100|','49|100|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'cooljewels_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Cool Jewels unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32758'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>cooljewelsSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>cooljewelsCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Cool Jewels without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32758',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});
