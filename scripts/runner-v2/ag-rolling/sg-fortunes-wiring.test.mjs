import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {SOURCE,review,settled,bootstrap} from './sg-fortunes-megaways.mjs';
import {fortunesPayload,fortunesSession} from './sg-fortunes-source.mjs';
import {fortunesCodec} from './sg-fortunes-codec.mjs';
import {createProtocolSessions} from './sg-protocol-session.mjs';
const plan=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans['32751'];
const context={base:{mode:'demo',sessionId:'Free:offline-only',operatorId:'offline-only'},plan,
 queueId:'offline',kind:'worker',index:1,owner:'offline-owner',ordinal:1,guard:async()=>{}};
const reels=(free=false,bonus=false,win=0)=>`<ReelResults numSpins="1"><ReelSpin spinIndex="0" reelsetIndex="2" anywayWins="${win?1:0}" scatterWinCount="0" totalSpinWin="${win}" freeSpin="${free?'Y':'N'}" bonusAwarded="${bonus?'Y':'N'}"><ReelStops>1|2|3|4|5|6</ReelStops>${win?`<AnywayWin awardIndex="1" ways="1" winIndex="0" winVal="${win}"/>`:''}</ReelSpin></ReelResults>`;
const top=free=>`<TopReelInfo positions="37|38|39|40" reelSetIndex="${free?40:35}" reelStop="1"/>`;
const init=(session,stake=16)=>`<GameResponse type="Init"><Header gameID="20371" versionID="1_0" isRecovering="N" sessionID="${session}" readyForEndGame="N"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><GameInfo><Stakes>${stake}|32|</Stakes><PageInfo pageCount="1"/></GameInfo></GameResponse>`;
const answer=(msg,session,{number=null,balance=990,win=6}={})=>`<GameResponse type="${msg}"><Header gameID="20371" versionID="1_0" isRecovering="N" sessionID="${session}" readyForEndGame="${msg==='EndGame'?'N':number===null||number===10?'Y':'N'}"/><AccountData/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances>`+
 (msg==='EndGame'?'':`<GameResult stake="16" totalWin="${win}">${reels(number!==null&&number>0,number===0,win)}${number>0?`<BaseGameRecoveryInfo>${reels(false,true,0)}${top(false)}</BaseGameRecoveryInfo>`:''}<BGInfo gameMode="0" isMaxWin="0" reelHeights="2|2|2|2|2|2" bgWinnings="${number===null?win:0}" totalWagerWin="${win}"/>${top(number!==null&&number>0)}${number===0?'<PickerInfo pickerIndex="0"/><FSInfo freeSpinNumber="0" freeSpinsTotal="10" fsWinnings="0" isMaxWin="0" startCasMult="6"/>':number>0?`<FSInfo freeSpinNumber="${number}" freeSpinsTotal="10" fsWinnings="${win}" extraSpinsAwarded="0" reelHeights="2|2|2|2|2|2"/><CascadeInfo prevCascadeMult="6" curCascadeMult="6"/>`:''}</GameResult>`)+ '</GameResponse>';
const step=(msg,payload,xml)=>({msgId:msg,requestPayload:payload,responsePayload:xml,responseXml:xml,elapsedMs:0,
 responseBalance:Number(xml.match(/name="CASH_BALANCE" value="(\d+)"/)[1])});
function raw(feature=false){let session='offline-start';const r={fixtureOnly:false,protocol:'wms',sourceKey:SOURCE,
 roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,steps:[]};
 for(let i=0;i<(feature?11:1);i++){const s=step('Logic',fortunesPayload({MSGID:'Logic'},session,i===0),answer('Logic','offline-'+i,
  feature?{number:i,balance:984,win:0}:{balance:990,win:6}));r.steps.push(s);session='offline-'+i;}
 r.steps.push(step('EndGame',fortunesPayload({MSGID:'EndGame'},session),answer('EndGame','offline-end',{balance:feature?984:990})));return r;
}
const replace=(r,index,from,to)=>{const s=r.steps[index];s.responsePayload=s.responsePayload.replace(from,to);s.responseXml=s.responseXml.replace(from,to);return r;};
test('Megaways paid, automatic ten-free and EndGame are separate from incomplete prefixes',()=>{
 assert.equal(settled(raw(), 'a'.repeat(64)).money.totalWinRaw,6);
 assert.equal(settled(raw(true),'a'.repeat(64)).bonus,1);
 const partial=raw(true);partial.steps.pop();assert.equal(review(partial).next,'EndGame');
 assert.throws(()=>settled(partial,'a'.repeat(64)),/INCOMPLETE_ROUND/);
 const wrong=raw(true);wrong.steps.splice(2,9);assert.throws(()=>review(wrong),/SEQUENCE/);
});
test('Megaways rejects unknown picker, extra free awards, recovery drift and double counted awards',()=>{
 for(const [index,from,to] of [[0,'pickerIndex="0"','pickerIndex="2"'],[1,'extraSpinsAwarded="0"','extraSpinsAwarded="1"'],
  [1,'prevCascadeMult="6"','prevCascadeMult="5"'],[1,'<BaseGameRecoveryInfo>','<BaseGameRecoveryInfo><Feature/>']]){
  assert.throws(()=>review(replace(raw(true),index,from,to)),/COUNTER|FEATURE_NOT_ADAPTED/);
 }
 assert.throws(()=>review(replace(raw(),0,'totalWin="6"','totalWin="12"')),/CUMULATIVE|REEL_WIN/);
 assert.throws(()=>review({...raw(),steps:raw().steps.map((s,i)=>i===1?{...s,responseBalance:s.responseBalance+1}:s)}),/BALANCE/);
});
test('Megaways request, identity and per-frame session cannot borrow Five Treasures or paid gameMode',()=>{
 const r=raw();r.steps[1].requestPayload=fortunesPayload({MSGID:'EndGame'},'other');assert.throws(()=>review(r),/SESSION_CHAIN/);
 const wrong=raw();wrong.steps[0].requestPayload=wrong.steps[0].requestPayload.replace('gameMode="0"','gameMode="1"');assert.throws(()=>review(wrong),/WAGER/);
 assert.throws(()=>review(replace(raw(),0,'gameID="20371"','gameID="20442"')),/IDENTITY/);
});
test('Megaways Init capabilities and cash are independently bounded before the paid request',()=>{
 const q=fortunesPayload({MSGID:'Init'},'offline-start'),s=step('Init',q,init('rotated'));
 assert.equal(bootstrap(s,'offline-start').session,'rotated');
 assert.throws(()=>bootstrap(step('Init',q,init('rotated',15)),'offline-start'),/INIT_REQUIRES_REVIEW/);
 assert.throws(()=>bootstrap({...s,responseBalance:999},'offline-start'),/BALANCE/);
 assert.throws(()=>bootstrap(step('Init',q,init('rotated').replace('</GameInfo>','<NewBonus/></GameInfo>')),'offline-start'),/INIT_REQUIRES_REVIEW/);
});
test('Megaways transport isolates owners and ordinals; paid Logic has the BET resource guard',async()=>{
 let calls=0;const guards=[];
 const create=ordinal=>fortunesSession({...context,ordinal,guard:async r=>guards.push(r),fetchSource:async()=>{calls++;return {
  ok:true,status:200,headers:{getSetCookie:()=>[]},text:async()=>answer('Logic','rotated')};}});
 const a=create(1),b=create(2);assert.equal(calls,0);assert.notEqual(a.identity,b.identity);
 assert.throws(()=>fortunesSession({...context,plan:{...plan,runtimeGameId:20371},fetchSource:async()=>{}}),/SOURCE_SCOPE/);
 await a.send(fortunesPayload({MSGID:'Logic'},a.session,true),'Logic');assert.equal(calls,1);assert.equal(guards[0].msgId,'BET');a.close();b.close();
});
test('Megaways actual codec and Python record verification preserve complete money and reject tampering',async()=>{
 const historical=raw(),session={session:'offline-start',setSession(v){this.session=v;}};
 const codec=await fortunesCodec({plan,session,sequence:()=>1,worker:0,batchId:1});
 try{assert.equal(await codec.bootstrap(async(msg,payload)=>step(msg,payload,init('offline-start'))),1000);
  const prefix=codec.createRaw({balance:1000});for(const s of historical.steps){const next=await codec.next(prefix);
   assert.equal(codec.payload(next),s.requestPayload);prefix.steps.push(s);}
  assert.equal(await codec.next(prefix),null);const p=await codec.prepare(prefix,{attempt:'offline',sessionHash:'a'.repeat(64)});
  assert.equal(p.record.bet,0.16);assert.equal(p.endBalanceRaw,990);assert.equal(p.independentlyVerified,true);
  await assert.rejects(()=>codec.prepare(replace(raw(),0,'totalWin="6"','totalWin="7"'),{attempt:'offline',sessionHash:'a'.repeat(64)}),/CUMULATIVE|REEL_WIN/);
 }finally{codec.close();}
});
test('Megaways unknown HTTP outcome is journaled once without retry, response credit or another paid request',async()=>{
 let calls=0,intents=0,responses=0,closed;
 const protocol=createProtocolSessions({game:{gameId:'32751'},queueId:'offline',kind:'worker',index:1,owner:'offline',plan,
  guard:async()=>{},spoolFactory:()=>({append(){},confirmed(){},close(){}}),
  journal:{open:async()=>{},intent:async()=>{intents++;return {durable:true};},response:async()=>{responses++;return {durable:true};},close:async r=>{closed=r;},auditSources:async()=>{}},
  createSession:ctx=>fortunesSession({...context,...ctx,fetchSource:async()=>{calls++;throw Error('unknown');}}),
  createCodec:(_plan,session)=>fortunesCodec({plan,session,sequence:()=>1,worker:0,batchId:1})});
 const session=await protocol.open();await assert.rejects(()=>session.captureRound({}),/SOURCE_NETWORK_OUTCOME_UNKNOWN/);await session.close();
 assert.equal(calls,1);assert.equal(intents,1);assert.equal(responses,0);assert.equal(closed.unknownRequests,1);assert.equal(closed.ready,false);
});
