// Independent original-XML settlement hypothesis. Never grants source permission.
import {parseXml,children,one,need} from './pearl-protocol.mjs';
import {reviewVeryFruityActions} from './veryfruity-action-review.mjs';
const headerKeys='affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split(' ');
const eq=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const money=v=>{need((typeof v==='number'||typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'VERYFRUITY_MONEY_INTEGER');return Number(v);};
const text=n=>n.children.map(c=>c.text??'').join('');
export function reviewVeryFruitySettlement(raw,{expectedHeader,stakePerLine,paylineCount}){
 need(expectedHeader&&eq(Object.fromEntries(Object.keys(expectedHeader).map(k=>[k,true])),Object.fromEntries(headerKeys.filter(k=>k!=='sessionID').map(k=>[k,true]))),'VERYFRUITY_MONEY_IDENTITY');
 const route=reviewVeryFruityActions(raw,{expectedHeader});
 const line=money(stakePerLine),lines=money(paylineCount);need(line>0&&lines>0&&lines<=100,'VERYFRUITY_MONEY_STAKE');
 const stake=money(line*lines),start=money(raw.startBalanceRaw);need(start>=stake,'VERYFRUITY_MONEY_BALANCE');
 let total=0,balance;
 for(const step of raw.steps){
  need(money(step.elapsedMs)<=300000,'VERYFRUITY_MONEY_TIMING');
  const q=parseXml(step.requestPayload),r=parseXml(step.responseXml),logic=step.msgId==='Logic';
  need(eq(q.a,{type:step.msgId})&&eq(r.a,{type:step.msgId}),'VERYFRUITY_MONEY_REQUEST');
  const h=one(q,'Header');need(eq(Object.fromEntries(Object.keys(h.a).map(k=>[k,true])),Object.fromEntries(headerKeys.map(k=>[k,true]))),'VERYFRUITY_MONEY_IDENTITY');
  need(children(q).map(n=>n.tag).sort().join(',')===(logic?'AccountData,Header,PaylineCount,Stake':'AccountData,Header'),'VERYFRUITY_MONEY_REQUEST');
  const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');
  need(!Object.keys(a.a).length&&children(a).length===1&&!Object.keys(c.a).length&&!children(c).length&&text(c)==='1','VERYFRUITY_MONEY_CURRENCY');
  if(logic){
   const bet=one(q,'Stake'),count=one(q,'PaylineCount');
   need(!children(bet).length&&eq(bet.a,{perLine:stakePerLine,total:String(stake)})&&!children(count).length&&eq(count.a,{count:paylineCount}),'VERYFRUITY_MONEY_STAKE');
   const g=one(r,'GameResult');need(g.a.stake===String(stake)&&g.a.stakePerLine===stakePerLine&&g.a.paylineCount===paylineCount,'VERYFRUITY_MONEY_STAKE');
   total=money(total+money(g.a.totalWin));need(money(one(g,'BGInfo').a.totalWagerWin)===total,'VERYFRUITY_MONEY_CUMULATIVE');
  }
  const balances=one(r,'Balances'),cash=one(balances,'Balance');
  need(!Object.keys(balances.a).length&&children(balances).length===1&&!children(cash).length&&Object.keys(cash.a).sort().join(',')==='name,value'&&cash.a.name==='CASH_BALANCE','VERYFRUITY_MONEY_BALANCE');
  balance=money(cash.a.value);need(balance===start-stake+total,'VERYFRUITY_MONEY_MOVEMENT');
 }
 return {nextRequestHypothesis:route.nextRequestHypothesis,endGameAcknowledged:route.endGameAcknowledged,
  moneyEvidenceVerified:true,complete:false,captureAuthorization:false,requiresNaturalCanary:true,
  betRaw:stake,winRaw:total,startBalanceRaw:start,endBalanceRaw:balance,classificationStatus:'pending',bonus:null};
}
