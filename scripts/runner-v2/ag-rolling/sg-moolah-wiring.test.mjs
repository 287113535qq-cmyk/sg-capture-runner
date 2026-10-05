import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {moolahSession,moolahPayload} from './sg-moolah-source.mjs';
import {moolahCodec} from './sg-moolah-codec.mjs';
import {bootstrap,review,settled,request} from './sg-moolah-base.mjs';
import {analyzer} from '../analyzer.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32776'];
const init=(session='rotated',balance=1000)=>`<GameResponse type="Init"><Header gameID="20145" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData/></AccountData><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameInfo><Stakes>25|50|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const step=(msg,payload,text)=>({msgId:msg,requestPayload:payload,responsePayload:text,responseXml:text,responseBalance:Number(text.match(/name="CASH_BALANCE" value="(\d+)"/)[1]),elapsedMs:0});
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
const ctx={base,plan,queueId:'offline',kind:'canary',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const logic=(session='paid',cash=980,game="<GameResult stake=\"25\" stakePerLine=\"1\" paylineCount=\"25\" totalWin=\"5\" betID=\"\"><ReelResults numSpins=\"1\"><ReelSpin spinIndex=\"0\" reelsetIndex=\"0\" cascadeCount=\"2\" winCountPL=\"1\" winCountSC=\"0\" spinWins=\"5\" freeSpin=\"N\" bonusAwarded=\"N\"><ReelStops>1|2|3|4|5</ReelStops><Cascade index=\"0\" winCountPL=\"1\" winCountSC=\"0\" cascadeWins=\"5\" cascadeMask=\"7168\"><PaylineWin index=\"2\" winVal=\"5\" awardIndex=\"3\" awardTableIndex=\"0\">10|11|12</PaylineWin></Cascade><Cascade index=\"1\" winCountPL=\"0\" winCountSC=\"0\" cascadeWins=\"0\" cascadeMask=\"0\"/></ReelSpin></ReelResults><BGInfo totalWagerWin=\"5\" bgWinnings=\"5\" baseGameSpinsRemaining=\"0\" isBigBet=\"0\" isMaxWin=\"0\"/></GameResult>")=>`<GameResponse type="Logic"><Header gameID="20145" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData></AccountData><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances>${game}</GameResponse>`;
const end=(session='end',cash=980)=>`<GameResponse type="EndGame"><Header gameID="20145" versionID="1_0" isRecovering="N" sessionID="${session}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances></GameResponse>`;
const raw=()=>({fixtureOnly:false,protocol:'wms',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,
 steps:[step('Logic',moolahPayload({MSGID:'Logic'},'first',true),logic()),step('EndGame',moolahPayload({MSGID:'EndGame'},'paid'),end())]});
test('Invaders of Planet Moolah transport has distinct anonymous owners, fixed catalog/WMS IDs and BET guard for the sole paid Logic for 25/Stake.total',async()=>{
 let calls=0;const guards=[];const s=moolahSession({...ctx,guard:async v=>guards.push(v),fetchSource:async()=>{
  calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init()};}});
 const other=moolahSession({...ctx,ordinal:2,fetchSource:async()=>{throw Error('unused');}});
 assert.equal(calls,0);assert.notEqual(s.identity,other.identity);assert.notEqual(s.session,other.session);
 assert.throws(()=>moolahSession({...ctx,plan:{...plan,runtimeGameId:20145},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await s.send(moolahPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');s.close();other.close();
});
test('Invaders of Planet Moolah actual Python IPC independently validates Init, ordinary routing, own Payline money and full record',async()=>{
 const parser=analyzer(),s={session:'first',setSession(v){this.session=v;}};const codec=await moolahCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21,createAnalyzer:()=>parser});
 try{
  assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('first'))),1000);
  const r=codec.createRaw({balance:1000}),a=await codec.next(r);assert.equal(a.MSGID,'Logic');assert.equal(codec.guardMsg(a.MSGID,codec.payload(a)),'BET');
  r.steps.push(step(a.MSGID,codec.payload(a),logic()));const b=await codec.next(r);assert.equal(b.MSGID,'EndGame');assert.equal(s.session,'paid');
  r.steps.push(step(b.MSGID,codec.payload(b),end()));assert.equal(await codec.next(r),null);
  const p=await codec.prepare(r,{attempt:'offline',sessionHash:'a'.repeat(64)});assert.equal(p.record.mul,5/25);assert.equal(p.record.bonus,0);assert.equal(p.endBalanceRaw,980);assert(p.independentlyVerified);
  const bad=structuredClone(p.record);bad.raw.steps[1].responseBalance++;
  await assert.rejects(()=>parser.call({op:'verify',plan,raw:bad.raw,record:bad}),/BALANCE/);
 }finally{codec.close();parser.close();}
});
test('Invaders of Planet Moolah rejects unknown awards, Payline, own cascade chain and feature states, wrong wager/money and mismatched session before EndGame',()=>{
 for(const [from,to] of [["freeSpin=\"N\"", "freeSpin=\"Y\""], ["bonusAwarded=\"N\"", "bonusAwarded=\"Y\""], ["winCountPL=\"1\"", "winCountPL=\"2\""], ["winCountSC=\"0\"", "winCountSC=\"1\""], ["stake=\"25\"", "stake=\"26\""], ["stakePerLine=\"1\"", "stakePerLine=\"2\""], ["paylineCount=\"25\"", "paylineCount=\"26\""], ["isMaxWin=\"0\"", "isMaxWin=\"1\""], ["isBigBet=\"0\"", "isBigBet=\"1\""], ["baseGameSpinsRemaining=\"0\"", "baseGameSpinsRemaining=\"1\""], ["winVal=\"5\"", "winVal=\"6\""], ["awardIndex=\"3\"", "awardIndex=\"99999\""], ["awardTableIndex=\"0\"", "awardTableIndex=\"1\""], [">10|11|12</PaylineWin>", ">0|1|15</PaylineWin>"], ["spinWins=\"5\"", "spinWins=\"6\""], ["totalWin=\"5\"", "totalWin=\"6\""], ["<BGInfo", "<UnknownFeature/><BGInfo"], ["</GameResult>", "<FSInfo/></GameResult>"], ["</ReelSpin>", "<ScatterWin awardIndex=\"0\" winVal=\"0\">0|1</ScatterWin></ReelSpin>"], ["reelsetIndex=\"0\"", "reelsetIndex=\"1\""], ["spinIndex=\"0\"", "spinIndex=\"1\""], ["<CurrencyMultiplier>1</CurrencyMultiplier>", "<CurrencyMultiplier>2</CurrencyMultiplier>"], ["isRecovering=\"N\"", "isRecovering=\"N\" readyForEndGame=\"Y\""], ["<BGInfo", "unexpected<BGInfo"], ["cascadeCount=\"2\"", "cascadeCount=\"3\""], ["cascadeMask=\"7168\"", "cascadeMask=\"65536\""], ["<Cascade", "<Cascade unknown=\"0\""]]){
  const r=raw();assert(r.steps[0].responsePayload.includes(from));r.steps[0].responsePayload=r.steps[0].responsePayload.replace(from,to);r.steps[0].responseXml=r.steps[0].responsePayload;assert.throws(()=>review(r));
 }
 const r=raw();r.steps[1].requestPayload=r.steps[1].requestPayload.replace('sessionID="paid"','sessionID="wrong"');assert.throws(()=>review(r),/SESSION/);
});
test('Invaders of Planet Moolah requires its own EndGame acknowledgement and rejects early, missing or changed-cash confirmation',()=>{
 const r=raw();assert.throws(()=>settled({...r,steps:r.steps.slice(0,1)},'a'.repeat(64)),/INCOMPLETE/);
 assert.throws(()=>review({...r,steps:[r.steps[1]]}),/SEQUENCE/);assert.throws(()=>review({...r,steps:[...r.steps,r.steps[1]]}),/STEPS/);

 const content=structuredClone(r);content.steps[1].responsePayload=content.steps[1].responseXml=content.steps[1].responseXml.replace('<AccountData/>','<AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>');assert.throws(()=>review(content),/ENDGAME_MISMATCH/);
 const bad=structuredClone(r);bad.steps[1]=step('EndGame',bad.steps[1].requestPayload,end('end',981));assert.throws(()=>review(bad),/BALANCE/);
});
test('Invaders of Planet Moolah bootstrap capability is restricted and cannot grant recovery, result, missing stake or unknown Init nodes',async()=>{
 const payload=moolahPayload({MSGID:'Init'},'first'),parser=analyzer();
 try{for(const text of [init().replace('25|50|','24|50|'),init().replace('isRecovering="N"','isRecovering="Y"'),
  init().replace('</GameResponse>','<GameResult/></GameResponse>'),init().replace('</GameResponse>','<Unknown/></GameResponse>'),init().replace('pageCount="1"','pageCount="2"')]){
  const d=step('Init',payload,text);assert.throws(()=>bootstrap(d,'first'));await assert.rejects(()=>parser.call({op:'moolah_bootstrap',plan,step:d,session:'first'}));
 }}finally{parser.close();}
});
test('Invaders of Planet Moolah unknown transport issues one Init and retains its unresolved durable intent with no retry or BET',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32776'},queueId:'offline',kind:'canary',index:1,owner:'offline-owner',plan,guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>moolahSession({...ctx,...c,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_p,s)=>moolahCodec({plan,session:s,sequence:()=>1,worker:20,batchId:21})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
test('Task factory selects Invaders of Planet Moolah without a supplied transport and final proof requires immutable full wiring evidence',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32776',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline-owner',plan,base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();
 const parser=analyzer();try{
  const changed={...plan,wmsGameId:20442};await assert.rejects(()=>parser.call({op:'plan',plan:changed}),/ROLLING_PLAN_CHANGED/);
 }finally{parser.close();}
});

test('Moolah all 283 own complete cascade chains enforce per-cascade line identity, money, order and no mask-based second award',()=>{
 const policy=JSON.parse(fs.readFileSync('config/ag-rolling-moolah-base-contract.json'));
 const xmlAttrs=a=>Object.entries(a).map(([k,v])=>`${k}="${v}"`).join(' ');
 let repeats=0;
 for(const chain of policy.cascadeChains){const w=chain.reduce((s,c)=>s+Number(c.attrs.cascadeWins),0),cnt=chain.reduce((s,c)=>s+c.paylines.length,0),lines=chain.flatMap(c=>c.paylines.map(p=>p.attrs.index));if(new Set(lines).size<lines.length)repeats++;
  const cascades=chain.map(c=>`<Cascade ${xmlAttrs(c.attrs)}>${c.paylines.map(p=>`<PaylineWin ${xmlAttrs(p.attrs)}>${p.text}</PaylineWin>`).join('')}</Cascade>`).join('');
  const g=`<GameResult stake="25" stakePerLine="1" paylineCount="25" totalWin="${w}" betID=""><ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="0" cascadeCount="${chain.length}" winCountPL="${cnt}" winCountSC="0" spinWins="${w}" freeSpin="N" bonusAwarded="N"><ReelStops>1|2|3|4|5</ReelStops>${cascades}</ReelSpin></ReelResults><BGInfo totalWagerWin="${w}" bgWinnings="${w}" baseGameSpinsRemaining="0" isBigBet="0" isMaxWin="0"/></GameResult>`;
  const r=raw();r.steps[0]=step('Logic',r.steps[0].requestPayload,logic('paid',975+w,g));r.steps[1]=step('EndGame',r.steps[1].requestPayload,end('end',975+w));assert.equal(review(r).win,w);
 }
 assert(repeats>0);
 const r=raw(),s=r.steps[0];s.responsePayload=s.responseXml=s.responseXml.replace('winCountPL="1"','winCountPL="2"').replace('</Cascade>',s.responseXml.match(/<PaylineWin[^>]*>[^<]*<\/PaylineWin>/)[0]+'</Cascade>');assert.throws(()=>review(r));
 for(const [a,b] of [['<Stake','unknown<Stake'],['total="25"','total="26"'],['<Stake','<Stake isBigBet="0"'],['Stake','WagerInfo']])assert.throws(()=>request(moolahPayload({MSGID:'Logic'},'first',true).replace(a,b),'Logic',true));
 const q=moolahPayload({MSGID:'Logic'},'first',true);assert.throws(()=>request(q.replace(/(<AccountData>.*?<\/AccountData>)(<Header[^>]*\/>)/,'$2$1'),'Logic',true));
});
