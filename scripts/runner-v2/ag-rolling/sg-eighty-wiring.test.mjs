import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SOURCE,request,bootstrap,review,settled} from './sg-eighty-fortunes.mjs';
import {eightySession,eightyPayload} from './sg-eighty-source.mjs';import {eightyCodec} from './sg-eighty-codec.mjs';
import {analyzer} from '../analyzer.mjs';import {createProtocolSessions} from './sg-protocol-session.mjs';import {createTaskRuntime} from './sg-task-runtime.mjs';
const plan=()=>JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32750'];
const header=s=>`<Header gameID="20077" versionID="1_0" isRecovering="N" sessionID="${s}"/>`;
const text=(msg,s,cash,body='')=>`<GameResponse type="${msg}">${header(s)}<Balances><Balance name="CASH_BALANCE" value="${cash}"/></Balances>${body}</GameResponse>`;
const reels=(free=false,first=true,bonus=false)=>`<ReelResults numSpins="1"><ReelSpin reelsetIndex="${first?4:9}" anywayWinCount="0" scatterWinCount="0" totalWayWin="0" totalScatterWin="0" totalSpinWin="0" freeSpin="${free&&first?'Y':'N'}" bonusAwarded="${bonus&&first?'Y':'N'}"><ReelStops>1|2|3|4|5</ReelStops></ReelSpin></ReelResults>`;
const attributes='stake="176" creditBet="88" betMultiplier="2" waysCount="243" totalWin="0" betID=""';
const info=(total,base,free)=>`<GameWinInfo totalWagerWin="${total}" totalBaseGameWin="${base}" totalFreeSpinsWin="${free}" maxWinValue="25000000" isMaxWin="N"/><GameRtpInfo targetedRtpValue="96.00"/>`;
const feature=(left,trigger,win)=>`<Feature index="1" name="FreeGame"><data totalFreeSpinsWin="${win}" remainingFreeSpins="${left}" extraFreeSpinsAwarded="0" freeSpinTriggerWin="${trigger}" lastFreeSpin="${left===0?'Y':'N'}"/></Feature>`;
const step=(msg,q,p,cash)=>({msgId:msg,requestPayload:q,responsePayload:p,responseXml:p,responseBalance:cash,elapsedMs:0});
export function freeRaw(trigger=880){const raw={fixtureOnly:false,protocol:'wms',sourceKey:SOURCE,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:10000,steps:[]};
 for(let i=0;i<=10;i++){const body=`<GameResult ${attributes}>${reels(true,i===0,i===0)}${feature(10-i,i===0?trigger:0,trigger)}${info(trigger,0,trigger)}${i?`<BaseGameRecoveryInfo><GameResult ${attributes}>${reels(true,true,true)}</GameResult></BaseGameRecoveryInfo>`:''}</GameResult>`;
  const cash=10000-176+(i?trigger:0);raw.steps.push(step('Logic',eightyPayload({MSGID:'Logic'},'s'+i,i===0),text('Logic','s'+(i+1),cash,body),cash));}
 const cash=10000-176+trigger;raw.steps.push(step('EndGame',eightyPayload({MSGID:'EndGame'},'s11'),text('EndGame','end',cash),cash));return raw;}
function normal(){return {...freeRaw(),steps:[step('Logic',eightyPayload({MSGID:'Logic'},'s0',true),text('Logic','s1',9824,`<GameResult ${attributes}>${reels()}${info(0,0,0)}</GameResult>`),9824),step('EndGame',eightyPayload({MSGID:'EndGame'},'s1'),text('EndGame','end',9824),9824)]};}
const init=s=>text('Init',s,10000,'<GameInfo><Stakes>176|352|</Stakes><PageInfo pageCount="1"/></GameInfo>');
const base={mode:'demo',sessionId:'Free:offline-only',operatorId:'offline'};
test('88 Fortunes deferred trigger is credited on first free continuation once, with ten counters and final confirmation',()=>{
 const r=freeRaw();const first=review({...r,steps:r.steps.slice(0,1)}),second=review({...r,steps:r.steps.slice(0,2)});
 assert.equal(first.balance,9824);assert.equal(first.win,880);assert.equal(first.next,'Logic');assert.equal(second.balance,10704);assert.equal(review(r).next,null);
 const f=settled(r,'a'.repeat(64));assert.equal(f.money.totalWinRaw,880);assert.equal(f.money.betRaw,176);assert.equal(f.bonus,1);
 const early={...r,steps:[r.steps[0],step('EndGame',eightyPayload({MSGID:'EndGame'},'s1'),text('EndGame','end',9824),9824)]};assert.throws(()=>review(early),/SEQUENCE/);
});
test('88 Fortunes real codec and Python IPC route full ordinary and free records through record and verify',async()=>{
 const parser=analyzer();try{for(const raw of [normal(),freeRaw()]){
  const session={session:'s0',setSession(v){this.session=v;}},codec=await eightyCodec({plan:plan(),session,sequence:()=>1,worker:1,batchId:2,createAnalyzer:()=>({call:q=>parser.call(q),close(){}})});
  const prefix=codec.createRaw({balance:raw.startBalanceRaw});for(const s of raw.steps){const n=await codec.next(prefix);assert.equal(n.MSGID,s.msgId);assert.equal(codec.payload(n),s.requestPayload);prefix.steps.push(s);}
  assert.equal(await codec.next(prefix),null);const result=await codec.prepare(prefix,{attempt:'offline',sessionHash:'a'.repeat(64)});assert(result.independentlyVerified);codec.close();
 }}finally{parser.close();}
});
test('88 Fortunes terminal evidence never extends from reviewed trigger880 to unseen trigger1760',async()=>{
 const r=freeRaw(1760);assert.equal(review({...r,steps:r.steps.slice(0,2)}).next,'Logic');assert.throws(()=>review(r),/UNREVIEWED_FREE_TERMINAL/);
 const parser=analyzer();try{await assert.rejects(()=>parser.call({op:'next',plan:plan(),raw:r}),/UNREVIEWED_FREE_TERMINAL/);}finally{parser.close();}
});
test('88 Fortunes fixed Jackpot award is separate from reels and permits no unobserved pick or type',()=>{
 const r=normal();let s=r.steps[0];s.responseXml=s.responsePayload=s.responsePayload.replace('totalWin="0"','totalWin="4000"').replace('bonusAwarded="N"','bonusAwarded="Y"').replace(info(0,0,0),`<Feature index="2" name="BG_FuBat_Jackpot"><data pickLength="7" jackpotWin="4000" jackpotType="0"/></Feature>${info(4000,4000,0)}`).replace('value="9824"','value="13824"');s.responseBalance=13824;
 r.steps[1]=step('EndGame',eightyPayload({MSGID:'EndGame'},'s1'),text('EndGame','end',13824),13824);assert.equal(settled(r,'a'.repeat(64)).primaryBonusKind,'feature');
 s.responseXml=s.responsePayload=s.responseXml.replace('jackpotType="0"','jackpotType="2"');assert.throws(()=>review(r),/JACKPOT_NOT_REVIEWED/);
});
test('88 Fortunes rejects extra spins, changed recovery reference, unknown features, money drift and absent EndGame',()=>{
 const original=freeRaw();for(const [index,a,b] of [[1,'remainingFreeSpins="9"','remainingFreeSpins="8"'],[1,'extraFreeSpinsAwarded="0"','extraFreeSpinsAwarded="1"'],[1,'freeSpinTriggerWin="0"','freeSpinTriggerWin="880"'],[0,'name="FreeGame"','name="Unknown"'],[0,'isMaxWin="N"','isMaxWin="Y"']]){
  const r=structuredClone(original),s=r.steps[index];s.responseXml=s.responsePayload=s.responsePayload.replace(a,b);assert.throws(()=>review(r));}
 const wrong=structuredClone(original);wrong.steps[1].responseXml=wrong.steps[1].responsePayload=wrong.steps[1].responsePayload.replace('<BaseGameRecoveryInfo><GameResult stake="176"','<BaseGameRecoveryInfo><GameResult stake="177"');assert.throws(()=>review(wrong),/RECOVERY/);
 const cash=structuredClone(original);cash.steps[1].responseBalance++;assert.throws(()=>review(cash),/BALANCE/);assert.throws(()=>settled({...original,steps:original.steps.slice(0,11)},'a'.repeat(64)),/INCOMPLETE/);
});
test('88 Fortunes anonymous transport has scoped identities, own IDs and BET resource guard on SpinInfo',async()=>{
 let calls=0;const guards=[];const ctx={base,plan:plan(),queueId:'offline',kind:'canary',index:1,owner:'offline',ordinal:1,guard:async v=>guards.push(v),fetchSource:async()=>{calls++;return {ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>init('new')};}};
 const s=eightySession(ctx),other=eightySession({...ctx,ordinal:2});assert.notEqual(s.identity,other.identity);assert.equal(calls,0);await s.send(eightyPayload({MSGID:'Logic'},s.session,true),'Logic');assert.equal(guards[0].msgId,'BET');assert.equal(calls,1);
 assert.throws(()=>eightySession({...ctx,plan:{...plan(),runtimeGameId:20077}}),/SOURCE_SCOPE/);s.close();other.close();
});
test('88 Fortunes bootstrap rejects unreviewed Init capabilities and paid or recovering responses',async()=>{
 const parser=analyzer(),q=eightyPayload({MSGID:'Init'},'first');try{for(const p of [init('next').replace('176|352|','175|352|'),init('next').replace('pageCount="1"','pageCount="2"'),init('next').replace('isRecovering="N"','isRecovering="Y"'),init('next').replace('</GameResponse>','<Unknown/></GameResponse>')]){
  const s=step('Init',q,p,10000);assert.throws(()=>bootstrap(s,'first'));await assert.rejects(()=>parser.call({op:'eighty_bootstrap',plan:plan(),step:s,session:'first'}));}
 }finally{parser.close();}
});
test('88 Fortunes unknown request remains durable once without retry, subsequent BET or manufactured response',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32750'},queueId:'offline',kind:'canary',index:1,owner:'offline',plan:plan(),guard:async()=>{},
  spoolFactory:()=>({append(){},confirmed(){},close(){}}),journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async v=>{closed=v;},auditSources:async()=>{}},
  createSession:c=>eightySession({base,...c,plan:plan(),guard:async()=>{},fetchSource:async()=>{calls++;throw Error('unknown');}}),createCodec:(_p,s)=>eightyCodec({plan:plan(),session:s,sequence:()=>1,worker:1,batchId:2})});
 const s=await protocol.open();await assert.rejects(()=>s.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await s.close();assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.awaiting,1);assert.equal(closed.unknownRequests,1);
});
test('88 Fortunes task factory selects only its own source and exact immutable plan',async()=>{
 const runtime=createTaskRuntime({store:{},transport:{},game:{gameId:'32750',baseline:0},queueId:'offline',kind:'canary',index:1,quota:10,owner:'offline',plan:plan(),base,guard:async()=>{}});
 await assert.rejects(()=>runtime.protocol.open(),/SG_GITHUB_SOURCE_REQUIRED/);await runtime.close();const parser=analyzer();try{await assert.rejects(()=>parser.call({op:'plan',plan:{...plan(),wmsGameId:20442}}),/ROLLING_PLAN_CHANGED/);}finally{parser.close();}
});
