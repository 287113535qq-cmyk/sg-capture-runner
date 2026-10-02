// Offline independent XML review. No transport, mapping or source admission.
import {parseXml,children,one,need} from './pearl-protocol.mjs';
const headerKeys='affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split(' ');
const eq=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const exact=(o,keys)=>eq(Object.fromEntries(Object.keys(o).map(k=>[k,true])),Object.fromEntries(keys.map(k=>[k,true])));
const text=n=>n.children.map(c=>c.text??'').join('');
const number=v=>{need(typeof v==='string'&&v.length<=16&&/^(0|[1-9]\d*)$/.test(v)&&Number.isSafeInteger(Number(v)),'VERYFRUITY_INVALID_INTEGER');return Number(v);};
const money=v=>{need((typeof v==='number'||typeof v==='string'&&/^\d+$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'VERYFRUITY_REVIEW_MONEY');return Number(v);};
const schema={
 GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo ScatterWinInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['freeSpin reelsetIndex spinIndex spinWins winCountPL winCountSC','ReelStops PaylineWin ScatterWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],ScatterWin:['index win',''],
 BGInfo:['totalWagerWin bgWinnings isMaxWin mysterySymbol',''],ScatterWinInfo:['scatterCount totalWin','ScatterWin']};
function shape(n){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))&&children(n).every(c=>s[1].split(' ').includes(c.tag)),'VERYFRUITY_UNREVIEWED_XML');children(n).forEach(shape);}
const tags=n=>children(n).map(c=>c.tag).sort().join(',');
const noChildren=n=>children(n).length===0;
export function reviewVeryFruityCash(raw,{expectedHeader,stakePerLine,paylineCount}){
 need(expectedHeader&&exact(expectedHeader,headerKeys.filter(k=>k!=='sessionID'))&&Object.values(expectedHeader).every(v=>typeof v==='string'&&v.length<=1024),'VERYFRUITY_REVIEW_IDENTITY');
 need(expectedHeader.freePlay==='Y'&&expectedHeader.promotions==='N','VERYFRUITY_DEMO_REQUIRED');
 const line=number(stakePerLine),lines=number(paylineCount),stake=money(line*lines);
 need(line>0&&lines>0&&lines<=100,'VERYFRUITY_REVIEW_STAKE');
 need(raw&&exact(raw,['startBalanceRaw','steps']),'VERYFRUITY_REVIEW_RAW');
 const start=money(raw.startBalanceRaw);need(start>=stake,'VERYFRUITY_REVIEW_BALANCE');
 need(Array.isArray(raw.steps)&&raw.steps.length>=1&&raw.steps.length<=2,'VERYFRUITY_ORDINARY_STEPS');
 let session,win,balance;
 raw.steps.forEach((s,i)=>{
  const msg=i?'EndGame':'Logic';
  need(s&&exact(s,['msgId','requestPayload','responsePayload','responseXml','elapsedMs'])&&s.msgId===msg,'VERYFRUITY_ORDINARY_SEQUENCE');
  need(money(s.elapsedMs)<=300000,'VERYFRUITY_REVIEW_TIMING');
  const q=parseXml(s.requestPayload),r=parseXml(s.responseXml);
  need(s.responsePayload===s.responseXml,'VERYFRUITY_XML_EVIDENCE');
  need(q.tag==='GameRequest'&&eq(q.a,{type:msg}),'VERYFRUITY_REQUEST');
  const h=one(q,'Header');need(exact(h.a,headerKeys)&&noChildren(h),'VERYFRUITY_REQUEST_IDENTITY');
  need(eq(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),expectedHeader),'VERYFRUITY_REQUEST_IDENTITY');
  need(h.a.sessionID.length>0&&h.a.sessionID.length<=1024&&(session===undefined||h.a.sessionID===session),'VERYFRUITY_SESSION');
  need(tags(q)===(i?'AccountData,Header':'AccountData,Header,PaylineCount,Stake'),'VERYFRUITY_REQUEST');
  const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');
  need(!Object.keys(a.a).length&&children(a).length===1&&!Object.keys(c.a).length&&noChildren(c)&&text(c)==='1','VERYFRUITY_CURRENCY');
  if(!i){const bet=one(q,'Stake'),count=one(q,'PaylineCount');need(eq(bet.a,{perLine:stakePerLine,total:String(stake)})&&noChildren(bet)&&eq(count.a,{count:paylineCount})&&noChildren(count),'VERYFRUITY_REQUEST_STAKE');}
  shape(r);need(r.tag==='GameResponse'&&eq(r.a,{type:msg}),'VERYFRUITY_RESPONSE');
  const accounts=children(r).filter(n=>n.tag==='AccountData');
  need(accounts.length<=1&&tags(r)===[...['Header','Balances'],...(!i?['GameResult']:[]),...(accounts.length?['AccountData']:[])].sort().join(','),'VERYFRUITY_RESPONSE_SHAPE');
  if(accounts.length){const currency=one(accounts[0],'CurrencyMultiplier');need(children(accounts[0]).length===1&&text(currency)==='1','VERYFRUITY_CURRENCY');}
  const rh=one(r,'Header').a;need(['gameID','versionID','ccyCode','lang'].every(k=>rh[k]===expectedHeader[k])&&rh.isRecovering==='N','VERYFRUITY_RESPONSE_IDENTITY');
  session=rh.sessionID;need(typeof session==='string'&&session.length>0&&session.length<=1024,'VERYFRUITY_SESSION');
  const balances=one(r,'Balances'),cash=one(balances,'Balance');
  need(children(balances).length===1&&cash.a.name==='CASH_BALANCE'&&exact(cash.a,['name','value']),'VERYFRUITY_CASH_BALANCE');balance=number(cash.a.value);
  if(!i){
   const g=one(r,'GameResult');need(exact(g.a,['stake','stakePerLine','paylineCount','totalWin','betID'])&&g.a.betID.length>0&&g.a.betID.length<=256&&g.a.stake===String(stake)&&g.a.stakePerLine===stakePerLine&&g.a.paylineCount===paylineCount,'VERYFRUITY_RESPONSE_STAKE');
   win=number(g.a.totalWin);const bg=one(g,'BGInfo').a;
   need(exact(bg,['totalWagerWin','bgWinnings','isMaxWin','mysterySymbol'])&&bg.isMaxWin==='0'&&bg.mysterySymbol==='0'&&number(bg.totalWagerWin)===win&&number(bg.bgWinnings)===win,'VERYFRUITY_CASH_WIN_SCOPE');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin');
   need(eq(reels.a,{numSpins:'1'})&&children(reels).length===1&&exact(spin.a,['freeSpin','reelsetIndex','spinIndex','spinWins','winCountPL','winCountSC'])&&spin.a.reelsetIndex==='0'&&spin.a.freeSpin==='N'&&spin.a.spinIndex==='0','VERYFRUITY_ORDINARY_REELS');
   const stops=text(one(spin,'ReelStops')).split('|');need(stops.length===5,'VERYFRUITY_REEL_STOPS');stops.forEach(number);
   const pay=children(spin).filter(n=>n.tag==='PaylineWin');
   need(number(spin.a.winCountPL)===pay.length&&spin.a.winCountSC==='0'&&!children(spin).some(n=>n.tag==='ScatterWin')&&!children(g).some(n=>n.tag==='ScatterWinInfo'),'VERYFRUITY_SCATTER_NOT_REVIEWED');
   const seen=new Set();let total=0;
   for(const item of pay){const idx=number(item.a.index);need(idx<lines&&!seen.has(idx)&&exact(item.a,['index','winVal','awardIndex','awardTableIndex']),'VERYFRUITY_PAYLINE');seen.add(idx);number(item.a.awardIndex);number(item.a.awardTableIndex);const positions=text(item).split('|');need(positions.length>=1&&positions.length<=5&&new Set(positions).size===positions.length&&positions.every(p=>number(p)<15),'VERYFRUITY_PAYLINE_POSITION');total=money(total+number(item.a.winVal));}
   need(total===win&&number(spin.a.spinWins)===win,'VERYFRUITY_PAYLINE_WIN');
  }
  need(balance===start-stake+win,'VERYFRUITY_CASH_MOVEMENT');
 });
 return {nextRequestHypothesis:raw.steps.length===1?'EndGame':null,endGameAcknowledged:raw.steps.length===2,betRaw:stake,winRaw:win,endBalanceRaw:balance,captureAuthorization:false,independentIdentityAndNaturalXmlRequired:true};
}
