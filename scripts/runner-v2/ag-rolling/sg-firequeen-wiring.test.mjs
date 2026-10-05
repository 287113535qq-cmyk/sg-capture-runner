import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {firequeenSession,firequeenPayload} from './sg-firequeen-source.mjs';
import {firequeenCodec} from './sg-firequeen-codec.mjs';
import {bootstrap,review,settled,request} from './sg-firequeen-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32767'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20192" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>50|100|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=952)=>`<GameResponse type="Logic"><Header gameID="20192" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="50" stakePerLine="1" paylineCount="100" totalWin="2" betID=""><WildTransformedReels>1|5</WildTransformedReels><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="2" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6|7|8|9|10|11</ReelStops><PaylineWin index="0" winVal="2" awardIndex="0" awardTableIndex="0">19|22|24</PaylineWin></ReelSpin></ReelResults><GameWinInfo totalWagerWin="2" totalBGWin="2" totalFSWin="0" maxWinValue="25000000" isMaxWin="N" isEndGame="Y"/><GameVariantInfo rtp="95.95"/></GameResult></GameResponse>`;
const end=(session='end',cash=952)=>`<GameResponse type="EndGame"><Header gameID="20192" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',firequeenPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',firequeenPayload({MSGID:'EndGame'},'paid'),end())]});
test('Fire Queen transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 50/WagerInfo.totalStake',async()=>{
 let calls=0;const guards=[];const s=firequeenSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=firequeenSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>firequeenSession({...ctx,plan:{...plan,runtimeGameId:20192},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(firequeenPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Fire Queen actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await firequeenCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,2/50);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,952);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Fire Queen rejects unknown awards, Payline, own reelsets and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"50\"", "stake=\"51\""], ["stakePerLine=\"1\"", "stakePerLine=\"2\""], ["paylineCount=\"100\"", "paylineCount=\"101\""], ["isMaxWin=\"N\"", "isMaxWin=\"Y\""], ["winVal=\"2\"", "winVal=\"3\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"100\""], [">19|22|24</PaylineWin>", ">0|1|66</PaylineWin>"], ["spinWins=\"2\"", "spinWins=\"3\""], ["totalWin=\"2\"", "totalWin=\"3\""], ["<GameWinInfo", "<UnknownFeature/><GameWinInfo"], ["</GameResult>", "<FSInfo/></GameResult>"], ["</GameResult>", "<Feature index=\"1\" name=\"FreeSpins3\"/></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"39\" winVal=\"50\">0|1|2</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isEndGame=\"Y\"", "isEndGame=\"N\""], ["<GameWinInfo", "unexpected<GameWinInfo"], ["<GameWinInfo", "<BGInfo/><GameWinInfo"], ["rtp=\"95.95\"", "rtp=\"96\""], ["maxWinValue=\"25000000\"", "maxWinValue=\"1\""], ["totalFSWin=\"0\"", "totalFSWin=\"50\""], [">1|5</WildTransformedReels>", ">9|9</WildTransformedReels>"], ["<Header gameID", "<Header readyForEndGame=\"Y\" gameID"], ["1|2|3|4|5|6|7|8|9|10|11", "1|2|3|4|5"]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Fire Queen requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS|SEQUENCE/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData>unknown</AccountData>');assert.throws(()=>review(content),/FEATURE_NOT_ADAPTED/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',953));assert.throws(()=>review(bad),/BALANCE/);
});
test('Fire Queen bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=firequeenPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('50|100|','49|100|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'firequeen_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Fire Queen unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32767'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>firequeenSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>firequeenCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Fire Queen without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32767',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Fire Queen optional pinned WildTransformedReels preserves money and foreign terminal/request shapes stop',()=>{
 const r=raw();r.steps[0].responsePayload=r.steps[0].responseXml=r.steps[0].responseXml.replace(/<WildTransformedReels>[^<]+<\/WildTransformedReels>/,'');assert.equal(review(r).win,2);
 for(const [from,to]of [['<Header gameID','<Header readyForEndGame="N" gameID'],['<AccountData/>','']]){const bad=structuredClone(r);bad.steps[1].responsePayload=bad.steps[1].responseXml=bad.steps[1].responseXml.replace(from,to);assert.throws(()=>review(bad));}
 const unknown=structuredClone(r);unknown.steps[0].responsePayload=unknown.steps[0].responseXml=unknown.steps[0].responseXml.replace('</GameResult>','<Feature index="1" name="FreeSpins3"/></GameResult>');assert.throws(()=>review(unknown),/FEATURE_NOT_ADAPTED/);
 for(const payload of [firequeenPayload({MSGID:'Logic'},'first',true).replace('<WagerInfo','unknown<WagerInfo'),firequeenPayload({MSGID:'Logic'},'first',true).replace('totalStake="50"','totalStake="51"'),firequeenPayload({MSGID:'Logic'},'first',true).replace('<WagerInfo totalStake="50"/>','<Stake total="50"/>')])assert.throws(()=>request(payload,'Logic',true));
});
