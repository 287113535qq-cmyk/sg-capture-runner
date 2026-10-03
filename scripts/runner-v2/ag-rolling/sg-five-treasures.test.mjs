import assert from 'node:assert/strict';
import test from 'node:test';
import {SOURCE,review,settled} from './sg-five-treasures.mjs';
const header={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'fivetreasures',gameID:'20442',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const attrs=o=>Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ');
// Synthetic, offline-only money/session evidence; never used as source data.
function raw(free=false){let balance=1000,total=0;const steps=[];
 for(let i=0;i<=(free?6:0);i++){
  const msg=i===1&&free?'FreeSpinChoice':'Logic',award=10+i;total+=award;balance+=award-(i?0:176);
  const requestPayload=`<GameRequest type="Logic"><Header ${attrs({...header,sessionID:'offline-'+i})}/>`+
   (i===0?'<Stake total="176"/><PaylineCount count="1"/><AccountData><CurrencyMultiplier>1</CurrencyMultiplier></AccountData>':
    msg==='FreeSpinChoice'?'<FreeSpinChoice type="0"/>':'')+'</GameRequest>';
  const responsePayload=`<GameResponse type="Logic"><Header gameID="20442" versionID="1_0" isRecovering="N" sessionID="offline-${i+1}" readyForEndGame="${free&&i<6?'N':'Y'}"/>`+
   `<Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances><GameResult stake="176" totalWin="${award}" betID="">`+
   `<BGInfo bgWinnings="10" totalWagerWin="${total}" isMaxWin="0"/>`+
   (free?`<FSInfo fsWinnings="${total-10}" freeSpinsTotal="6" freeSpinNumber="${i}" extraSpinsAwarded="0"${i?' freeSpinMode="0"':''}/>`:'')+
   `<ReelResults numSpins="1"><ReelSpin freeSpin="${i?'Y':'N'}" bonusAwarded="${free&&i===0?'Y':'N'}" totalSpinWin="${award}"/></ReelResults></GameResult></GameResponse>`;
  steps.push({msgId:msg,requestPayload,responsePayload,responseXml:responsePayload,responseBalance:balance,elapsedMs:0});
 }
 const responsePayload=`<GameResponse type="EndGame"><Header gameID="20442" versionID="1_0" isRecovering="N" sessionID="offline-end" readyForEndGame="N"/><Balances><Balance name="CASH_BALANCE" value="${balance}"/></Balances></GameResponse>`;
 steps.push({msgId:'EndGame',requestPayload:`<GameRequest type="EndGame"><Header ${attrs({...header,sessionID:'offline-'+(free?7:1)})}/></GameRequest>`,
  responsePayload,responseXml:responsePayload,responseBalance:balance,elapsedMs:0});
 return {fixtureOnly:false,protocol:'wms',sourceKey:SOURCE,roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:1000,steps};
}
const changeResponse=(r,i,from,to)=>{const s=r.steps[i];s.responsePayload=s.responsePayload.replace(from,to);s.responseXml=s.responsePayload;return r;};
test('WMS ordinary and chosen six-free rounds settle only after explicit EndGame',()=>{
 const base=settled(raw(),'a'.repeat(64)),free=settled(raw(true),'a'.repeat(64));
 assert.equal(base.money.betRaw,176);assert.equal(base.money.totalWinRaw,10);assert.equal(base.bonus,0);
 assert.equal(free.money.totalWinRaw,91);assert.equal(free.bonus,1);assert.equal(free.money.endBalanceRaw,915);
 for(const r of [raw(),raw(true)]){r.steps.pop();assert.equal(review(r).next,'EndGame');assert.throws(()=>settled(r,'a'.repeat(64)),/INCOMPLETE_ROUND/);}
});
test('WMS FreeSpinChoice is a Logic XML message and cannot skip the reviewed choice or free spins',()=>{
 const r=raw(true);assert.equal(r.steps[1].msgId,'FreeSpinChoice');assert.match(r.steps[1].requestPayload,/GameRequest type="Logic"/);
 for(const prefix of [1,2,4]){const v=structuredClone(r);v.steps=v.steps.slice(0,prefix);assert.notEqual(review(v).next,null);assert.throws(()=>settled(v,'a'.repeat(64)),/INCOMPLETE_ROUND/);}
 const skipped=structuredClone(r);skipped.steps.splice(1,1);assert.throws(()=>review(skipped),/SEQUENCE/);
 for(const option of ['1','2','3','4']){const valid=structuredClone(r);valid.steps[1].requestPayload=valid.steps[1].requestPayload.replace('Choice type="0"',`Choice type="${option}"`);
  for(let i=1;i<=6;i++)changeResponse(valid,i,'freeSpinMode="0"',`freeSpinMode="${option}"`);assert.equal(settled(valid,'a'.repeat(64)).bonus,1);}
 const bad=structuredClone(r);bad.steps[1].requestPayload=bad.steps[1].requestPayload.replace('Choice type="0"','Choice type="5"');assert.throws(()=>review(bad),/CHOICE/);
 const changed=changeResponse(raw(true),3,'freeSpinMode="0"','freeSpinMode="1"');assert.throws(()=>review(changed),/CHOICE/);
});
test('WMS checks every rolling session and refuses a second paid request inside a feature',()=>{
 const broken=raw(true);broken.steps[2].requestPayload=broken.steps[2].requestPayload.replace('offline-2','other');assert.throws(()=>review(broken),/SESSION_CHAIN/);
 const paid=raw(true);paid.steps[3].requestPayload=paid.steps[0].requestPayload.replace('offline-0','offline-3');assert.throws(()=>review(paid),/REQUEST/);
 const purchase=raw();purchase.steps[0].requestPayload=purchase.steps[0].requestPayload.replace('total="176"','total="352"');assert.throws(()=>review(purchase),/REQUEST/);
});
test('WMS independently reconciles spin awards, cumulative totals, free counters and each cash balance',()=>{
 for(const [i,from,to] of [[0,'totalSpinWin="10"','totalSpinWin="11"'],[2,'totalWagerWin="33"','totalWagerWin="34"'],
  [3,'freeSpinNumber="3"','freeSpinNumber="4"'],[4,'extraSpinsAwarded="0"','extraSpinsAwarded="2"'],
  [5,'value="899"','value="900"'],[6,'readyForEndGame="Y"','readyForEndGame="N"']]){
  const r=changeResponse(raw(true),i,from,to);assert.throws(()=>review(r));
 }
 const r=raw(true);r.steps[2].responseBalance++;assert.throws(()=>review(r),/BALANCE/);
});
test('unreviewed WMS extensions, ambiguous XML, recovery and divergent raw evidence fail closed',()=>{
 for(const [from,to] of [['<BGInfo','<NewFeature/><BGInfo'],['isRecovering="N"','isRecovering="Y"'],
  ['<Balances>','<Balances><Balance name="CASH_BALANCE" value="834"/>'],['<GameResult','<GameResult unknown="Y"']]){
  assert.throws(()=>review(changeResponse(raw(),0,from,to)));
 }
 const r=raw();r.steps[0].responseXml=r.steps[0].responseXml.replace('totalWin="10"','totalWin="11"');assert.throws(()=>review(r),/XML_EVIDENCE/);
});
test('WMS separately accounts for the evidenced jackpot without double counting reel awards',()=>{
 const r=raw();for(const [from,to] of [['totalWin="10"','totalWin="42"'],['bgWinnings="10"','bgWinnings="42"'],
  ['totalWagerWin="10"','totalWagerWin="42"'],['</GameResult>','<JackpotInfo jackpotIndex="0" jackpotWinnings="32"/></GameResult>']])changeResponse(r,0,from,to);
 for(let i=0;i<2;i++){changeResponse(r,i,'value="834"','value="866"');r.steps[i].responseBalance=866;}
 assert.equal(settled(r,'a'.repeat(64)).money.totalWinRaw,42);
 for(const [from,to] of [['jackpotIndex="0"','jackpotIndex="1"'],['jackpotWinnings="32"','jackpotWinnings="33"']]){
  assert.throws(()=>review(changeResponse(structuredClone(r),0,from,to)));
 }
});
