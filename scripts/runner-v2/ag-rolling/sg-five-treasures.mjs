import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
// Offline WMS codec boundary. No source, scheduler, registry or storage calls.
export const SOURCE='fivetreasures-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'fivetreasures',gameID:'20442',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b);
const SCHEMA={
 GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake totalWin betID','ReelResults BGInfo FSInfo BaseGameRecoveryInfo JackpotInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['anywayWins bonusAwarded freeSpin reelsetIndex scatterWinCount spinIndex totalSpinWin','AnywayWin ReelStops ScatterWin'],
 AnywayWin:['awardIndex ways winIndex winVal',''],ReelStops:['',''],ScatterWin:['awardIndex winVal',''],
 BGInfo:['bgWinnings isMaxWin totalWagerWin',''],FSInfo:['extraSpinsAwarded freeSpinMode freeSpinNumber freeSpinsTotal fsWinnings',''],
 BaseGameRecoveryInfo:['','ReelResults'],JackpotInfo:['jackpotIndex jackpotWinnings',''],
};
const tags=n=>children(n).map(c=>c.tag);
function checkShape(n){const s=SCHEMA[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'WMS_FEATURE_NOT_ADAPTED');children(n).forEach(checkShape);}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg==='FreeSpinChoice'?'Logic':msg}),'WMS_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'WMS_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','Stake','PaylineCount','AccountData']),'WMS_REQUEST_MISMATCH');
  need(same(one(q,'Stake').a,{total:'176'})&&!children(one(q,'Stake')).length
   &&same(one(q,'PaylineCount').a,{count:'1'})&&!children(one(q,'PaylineCount')).length,'WMS_REQUEST_MODE');
  const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&children(a).length===1
   &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','WMS_REQUEST_MODE');
 }else if(msg==='FreeSpinChoice')need(same(tags(q),['Header','FreeSpinChoice'])&&same(Object.keys(one(q,'FreeSpinChoice').a),['type'])
  &&['0','1','2','3','4'].includes(one(q,'FreeSpinChoice').a.type)
  &&!children(one(q,'FreeSpinChoice')).length,'WMS_CHOICE_NOT_ADAPTED');
 else need(['Logic','EndGame'].includes(msg)&&same(tags(q),['Header']),'WMS_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function fiveResponse(text,msg){
 const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg==='FreeSpinChoice'?'Logic':msg})
  &&h.gameID==='20442'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function fiveBootstrap(step,session){
 const q=parseXml(step.requestPayload),h=one(q,'Header');
 need(step.msgId==='Init'&&q.tag==='GameRequest'&&same(q.a,{type:'Init'})&&same(tags(q),['Header'])
  &&!children(h).length&&same(h.a,{...HEADER,sessionID:session}),'WMS_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))
  &&uint(step.elapsedMs)<=300000&&!step.sourceRejected,'WMS_XML_EVIDENCE_MISMATCH');
 const result=fiveResponse(step.responsePayload,'Init'),nodes=[];
 const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(result.root);
 need(one(result.root,'Header').a.readyForEndGame==='N'
  &&!nodes.some(n=>['GameResult','BaseGameRecoveryInfo','Feature'].includes(n.tag)),'WMS_INIT_REQUIRES_REVIEW');
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(176)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'WMS_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===result.balance,'WMS_BALANCE_MISMATCH');
 return {validated:true,session:result.session,balanceRaw:result.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','WMS_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=8,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,first=0,session=null,free=null,number=0,next='Logic',choice=null;
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'WMS_SEQUENCE_MISMATCH');
  const qs=request(s.requestPayload,next,i===0);need(session===null||qs===session,'WMS_SESSION_CHAIN_MISMATCH');
  if(next==='FreeSpinChoice')choice=one(parseXml(s.requestPayload),'FreeSpinChoice').a.type;
  const r=parseXml(s.responsePayload);need(same(r,parseXml(s.responseXml)),'WMS_XML_EVIDENCE_MISMATCH');
  need(r.tag==='GameResponse'&&same(r.a,{type:next==='FreeSpinChoice'?'Logic':next}),'MESSAGE_ID_MISMATCH');checkShape(r);
  const h=one(r,'Header').a;need(h.gameID==='20442'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
  session=h.sessionID;need(typeof session==='string'&&session.length>0&&session.length<=1024,'WMS_SESSION_REQUIRED');
  need(uint(s.elapsedMs)<=300000&&!s.sourceRejected,'INVALID_TRIAL_TIMING');
  if(next==='EndGame'){need(i===raw.steps.length-1&&!children(r).some(n=>n.tag==='GameResult')&&h.readyForEndGame==='N','WMS_ENDGAME_MISMATCH');next=null;}
  else {const result=one(r,'GameResult');need(result.a.stake==='176','WMS_WAGER_MISMATCH');const award=uint(result.a.totalWin);
   if(i===0){balance-=176;first=award;}win+=award;balance+=award;uint(win);uint(balance);
   const bg=one(result,'BGInfo').a;need(bg.isMaxWin==='0'&&uint(bg.bgWinnings)===first&&uint(bg.totalWagerWin)===win,'WMS_CUMULATIVE_WIN_MISMATCH');
   const fs=children(result).filter(n=>n.tag==='FSInfo');if(free===null)free=fs.length>0;
   if(free){const f=one(result,'FSInfo').a;if(i){number++;need(choice!==null&&f.freeSpinMode===choice,'WMS_CHOICE_NOT_ADAPTED');}
    need(f.freeSpinsTotal==='6'&&f.extraSpinsAwarded==='0'&&uint(f.freeSpinNumber)===number&&number<=6,'WMS_FREE_COUNTER_MISMATCH');
    need(uint(f.fsWinnings)===win-first,'WMS_CUMULATIVE_WIN_MISMATCH');
   }else need(i===0&&!fs.length,'WMS_SEQUENCE_MISMATCH');
   const reels=one(result,'ReelResults'),spins=children(reels).filter(n=>n.tag==='ReelSpin');
   need(reels.a.numSpins==='1'&&spins.length===1&&spins[0].a.freeSpin===(i?'Y':'N')
    &&spins[0].a.bonusAwarded===(free&&i===0?'Y':'N'),'WMS_REEL_STATE_MISMATCH');
   const jackpots=children(result).filter(n=>n.tag==='JackpotInfo');need(jackpots.length<=1&&jackpots.every(n=>n.a.jackpotIndex==='0'),'WMS_JACKPOT_NOT_ADAPTED');
   need(uint(spins[0].a.totalSpinWin)+jackpots.reduce((a,n)=>a+uint(n.a.jackpotWinnings),0)===award,'WMS_REEL_WIN_MISMATCH');
   const pending=free&&number<6;need(h.readyForEndGame===(pending?'N':'Y'),'WMS_SETTLEMENT_FLAG_MISMATCH');
   next=free&&i===0?'FreeSpinChoice':pending?'Logic':'EndGame';
  }
  const b=one(r,'Balances');need(children(b).length===1&&same(one(b,'Balance').a,{name:'CASH_BALANCE',value:String(balance)})
   &&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,feature:!!free,start,balance,win};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===176,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:1.76,mul:s.win/176,buy:0,bonus:Number(s.feature),
  primaryBonusKind:s.feature?'freeGame':'none',typeMappingHash:mappingHash,
  money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:176}};
}
