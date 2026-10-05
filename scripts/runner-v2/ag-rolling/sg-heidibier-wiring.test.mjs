import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {heidibierSession,heidibierPayload} from './sg-heidibier-source.mjs';
import {heidibierCodec} from './sg-heidibier-codec.mjs';
import {bootstrap,review,settled,request} from './sg-heidibier-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32772'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20157" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>75|150|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=930)=>`<GameResponse type="Logic"><Header gameID="20157" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances><GameResult stake="75" stakePerLine="1" paylineCount="50" totalWin="5" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" winCountPL="1" winCountSC="0" spinWins="5" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5|6</ReelStops><PaylineWin index="0" winVal="5" awardIndex="0" awardTableIndex="0">0|1|2</PaylineWin></ReelSpin></ReelResults><MystInfo index="13"/><WildInfo Indices=""/><BonusReplacementInfo><Reel0><RD SS="23" DS="9"/><RD SS="24" DS="10"/><RD SS="25" DS="3"/><RD SS="26" DS="7"/><RD SS="27" DS="8"/><RD SS="28" DS="8"/><RD SS="29" DS="6"/><RD SS="30" DS="5"/><RD SS="31" DS="3"/><RD SS="32" DS="2"/></Reel0><Reel1><RD SS="23" DS="2"/><RD SS="24" DS="2"/><RD SS="25" DS="2"/><RD SS="26" DS="2"/><RD SS="27" DS="2"/><RD SS="28" DS="2"/><RD SS="29" DS="2"/><RD SS="30" DS="2"/><RD SS="31" DS="2"/><RD SS="32" DS="2"/></Reel1><Reel2><RD SS="23" DS="9"/><RD SS="24" DS="10"/><RD SS="25" DS="3"/><RD SS="26" DS="7"/><RD SS="27" DS="8"/><RD SS="28" DS="8"/><RD SS="29" DS="6"/><RD SS="30" DS="5"/><RD SS="31" DS="3"/><RD SS="32" DS="2"/></Reel2><Reel3><RD SS="23" DS="2"/><RD SS="24" DS="2"/><RD SS="25" DS="2"/><RD SS="26" DS="2"/><RD SS="27" DS="2"/><RD SS="28" DS="2"/><RD SS="29" DS="2"/><RD SS="30" DS="2"/><RD SS="31" DS="2"/><RD SS="32" DS="2"/></Reel3><Reel4><RD SS="23" DS="2"/><RD SS="24" DS="2"/><RD SS="25" DS="2"/><RD SS="26" DS="2"/><RD SS="27" DS="2"/><RD SS="28" DS="2"/><RD SS="29" DS="2"/><RD SS="30" DS="2"/><RD SS="31" DS="2"/><RD SS="32" DS="2"/><RD SS="33" DS="2"/><RD SS="34" DS="2"/></Reel4><Reel5></Reel5></BonusReplacementInfo><BaseGameInfo totalWagerWin="5" isMaxWin="N" maxWinValue="25000000"/></GameResult></GameResponse>`;
const end=(session='end',cash=930)=>`<GameResponse type="EndGame"><Header gameID="20157" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',heidibierPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',heidibierPayload({MSGID:'EndGame'},'paid'),end())]});
test('Heidi Bier Haus transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 75/Stake.total',async()=>{
 let calls=0;const guards=[];const s=heidibierSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=heidibierSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>heidibierSession({...ctx,plan:{...plan,runtimeGameId:20157},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(heidibierPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Heidi Bier Haus actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await heidibierCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,5/75);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,930);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Heidi Bier Haus rejects unknown awards, Payline, Myst/Wild/BonusReplacementInfo and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"75\"", "stake=\"76\""], ["stakePerLine=\"1\"", "stakePerLine=\"2\""], ["paylineCount=\"50\"", "paylineCount=\"51\""], ["isMaxWin=\"N\"", "isMaxWin=\"Y\""], ["maxWinValue=\"25000000\"", "maxWinValue=\"25000001\""], ["winVal=\"5\"", "winVal=\"6\""], ["awardIndex=\"0\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], ["index=\"0\"", "index=\"50\""], [">0|1|2</PaylineWin>", ">0|1|36</PaylineWin>"], ["spinWins=\"5\"", "spinWins=\"6\""], ["totalWin=\"5\"", "totalWin=\"6\""], ["<BaseGameInfo", "<UnknownFeature/><BaseGameInfo"], ["</GameResult>", "<FSInfo fSSpinsRemaining=\"5\" isMaxWin=\"N\" currentStickyWilds=\"\"/></GameResult>"], ["</GameResult>", "<WheelInfo WheelSpinsRemaining=\"1\" isMaxWin=\"N\"/></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"0\" winVal=\"0\">0|1</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""], ["<BaseGameInfo", "unexpected<BaseGameInfo"], ["<MystInfo index=\"13\"", "<MystInfo index=\"99\""], ["<WildInfo Indices=", "<WildInfo foreign=\"1\" Indices="], ["SS=\"23\"", "SS=\"999\""], ["DS=\"9\"", "DS=\"999\""], ["<Reel5></Reel5>", "<Reel5><RD SS=\"23\" DS=\"0\"/></Reel5>"], ["<BaseGameInfo", "<BaseGameInfo bgWinnings=\"0\""], ["<BonusReplacementInfo>", "<BonusReplacementInfo unknown=\"1\">"]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Heidi Bier Haus requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<Balances>','<AccountData/><Balances>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',931));assert.throws(()=>review(bad),/BALANCE/);
});
test('Heidi Bier Haus bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=heidibierPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('75|150|','74|150|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'heidibier_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Heidi Bier Haus unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32772'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>heidibierSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>heidibierCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Heidi Bier Haus without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32772',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Heidi Bier Haus pins the full Myst/Wild/RD joint without extra awards; unknown joint and duplicate lines stop',()=>{
 const r=raw();assert.equal(review(r).win,5);const s=r.steps[0];s.responsePayload=s.responseXml=s.responseXml.replace("<MystInfo index=\"13\"/><WildInfo Indices=\"\"/><BonusReplacementInfo><Reel0><RD SS=\"23\" DS=\"9\"/><RD SS=\"24\" DS=\"10\"/><RD SS=\"25\" DS=\"3\"/><RD SS=\"26\" DS=\"7\"/><RD SS=\"27\" DS=\"8\"/><RD SS=\"28\" DS=\"8\"/><RD SS=\"29\" DS=\"6\"/><RD SS=\"30\" DS=\"5\"/><RD SS=\"31\" DS=\"3\"/><RD SS=\"32\" DS=\"2\"/></Reel0><Reel1><RD SS=\"23\" DS=\"2\"/><RD SS=\"24\" DS=\"2\"/><RD SS=\"25\" DS=\"2\"/><RD SS=\"26\" DS=\"2\"/><RD SS=\"27\" DS=\"2\"/><RD SS=\"28\" DS=\"2\"/><RD SS=\"29\" DS=\"2\"/><RD SS=\"30\" DS=\"2\"/><RD SS=\"31\" DS=\"2\"/><RD SS=\"32\" DS=\"2\"/></Reel1><Reel2><RD SS=\"23\" DS=\"9\"/><RD SS=\"24\" DS=\"10\"/><RD SS=\"25\" DS=\"3\"/><RD SS=\"26\" DS=\"7\"/><RD SS=\"27\" DS=\"8\"/><RD SS=\"28\" DS=\"8\"/><RD SS=\"29\" DS=\"6\"/><RD SS=\"30\" DS=\"5\"/><RD SS=\"31\" DS=\"3\"/><RD SS=\"32\" DS=\"2\"/></Reel2><Reel3><RD SS=\"23\" DS=\"2\"/><RD SS=\"24\" DS=\"2\"/><RD SS=\"25\" DS=\"2\"/><RD SS=\"26\" DS=\"2\"/><RD SS=\"27\" DS=\"2\"/><RD SS=\"28\" DS=\"2\"/><RD SS=\"29\" DS=\"2\"/><RD SS=\"30\" DS=\"2\"/><RD SS=\"31\" DS=\"2\"/><RD SS=\"32\" DS=\"2\"/></Reel3><Reel4><RD SS=\"23\" DS=\"2\"/><RD SS=\"24\" DS=\"2\"/><RD SS=\"25\" DS=\"2\"/><RD SS=\"26\" DS=\"2\"/><RD SS=\"27\" DS=\"2\"/><RD SS=\"28\" DS=\"2\"/><RD SS=\"29\" DS=\"2\"/><RD SS=\"30\" DS=\"2\"/><RD SS=\"31\" DS=\"2\"/><RD SS=\"32\" DS=\"2\"/><RD SS=\"33\" DS=\"2\"/><RD SS=\"34\" DS=\"2\"/></Reel4><Reel5></Reel5></BonusReplacementInfo>","<MystInfo index=\"1\"/><WildInfo Indices=\"\"/>");assert.equal(review(r).win,5);
 s.responsePayload=s.responseXml=s.responseXml.replace('<MystInfo index="1"','<MystInfo index="99"');assert.throws(()=>review(r),/REPLACEMENT/);
 const p=raw();p.steps[0].responsePayload=p.steps[0].responseXml=p.steps[0].responseXml.replace('winCountPL="1"','winCountPL="2"').replace('</ReelSpin>',p.steps[0].responseXml.match(/<PaylineWin[^>]*>[^<]*<\/PaylineWin>/)[0]+'</ReelSpin>');assert.throws(()=>review(p),/PAYLINE/);
 for(const [from,to] of [['<Stake','unknown<Stake'],['total="75"','total="76"'],['total="75"','total="75" isBigBet="0"'],['Stake','WagerInfo']])assert.throws(()=>request(heidibierPayload({MSGID:'Logic'},'first',true).replace(from,to),'Logic',true));
});
