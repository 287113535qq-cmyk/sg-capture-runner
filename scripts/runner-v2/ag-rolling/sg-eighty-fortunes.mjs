import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
export const SOURCE='eightyeightfortunes-deferred-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'eightyeightfortunes',gameID:'20077',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag),text=n=>n.children.map(c=>c.text??'').join('');
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake creditBet betMultiplier waysCount totalWin betID','ReelResults Feature GameWinInfo GameRtpInfo BaseGameRecoveryInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['reelsetIndex anywayWinCount scatterWinCount totalWayWin totalScatterWin totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin ScatterWin'],
 ReelStops:['',''],AnywayWin:['winIndex winVal ways awardIndex',''],ScatterWin:['winIndex winVal awardIndex',''],
 Feature:['index name','data'],data:['totalFreeSpinsWin remainingFreeSpins extraFreeSpinsAwarded freeSpinTriggerWin lastFreeSpin pickLength jackpotWin jackpotType',''],
 GameWinInfo:['totalWagerWin totalBaseGameWin totalFreeSpinsWin maxWinValue isMaxWin',''],GameRtpInfo:['targetedRtpValue',''],BaseGameRecoveryInfo:['','GameResult']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))&&tags(n).every(k=>s[1].split(' ').includes(k)),'EIGHTY_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function keys(n,names){need(same(Object.keys(n.a).sort(),names.split(' ').sort()),'EIGHTY_FEATURE_SHAPE');}
export function request(payload,msg,first=false){
 const q=parseXml(payload);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'EIGHTY_REQUEST_MISMATCH');const h=one(q,'Header');
 need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'EIGHTY_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','AccountData','SpinInfo']),'EIGHTY_REQUEST_MODE');
  const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier'),s=one(q,'SpinInfo');
  need(!Object.keys(a.a).length&&tags(a).length===1&&!Object.keys(c.a).length&&!children(c).length&&text(c)==='1'
   &&same(s.a,{creditBet:'88',betMultiplier:'2'})&&!children(s).length,'EIGHTY_REQUEST_MODE');
 }else need(['Init','Logic','EndGame'].includes(msg)&&same(tags(q),['Header']),'EIGHTY_REQUEST_MODE');return h.a.sessionID;
}
export function response(payload,msg){const root=parseXml(payload),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20077'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');const b=one(root,'Balances');
 need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'EIGHTY_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');shape(r.root,{...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']});
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&text(stakes[0]).split('|').filter(Boolean).map(uint).includes(176)&&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'EIGHTY_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
function reels(g,first,free,feature){const r=one(g,'ReelResults'),s=one(r,'ReelSpin');
 need(r.a.numSpins==='1'&&children(r).length===1&&s.a.reelsetIndex===(first?'4':'9')&&s.a.freeSpin===(free&&first?'Y':'N')
  &&s.a.bonusAwarded===(first&&feature?'Y':'N'),'EIGHTY_REEL_STATE_MISMATCH');
 const stops=one(s,'ReelStops');need(!children(stops).length&&text(stops).split('|').length===5,'EIGHTY_REEL_STATE_MISMATCH');text(stops).split('|').forEach(uint);
 let way=0,scatter=0;
 for(const [tag,count] of [['AnywayWin','anywayWinCount'],['ScatterWin','scatterWinCount']]){
  const wins=children(s).filter(n=>n.tag===tag);need(wins.length===uint(s.a[count])&&wins.length<=(tag==='AnywayWin'?3:1),'EIGHTY_REEL_WIN_MISMATCH');
  wins.forEach((n,i)=>{need(uint(n.a.winIndex)===i&&!children(n).length,'EIGHTY_REEL_WIN_MISMATCH');
   if(tag==='AnywayWin'){need(uint(n.a.awardIndex)<=46&&[1,2,3,4,6,8,9,12].includes(uint(n.a.ways)),'EIGHTY_REEL_WIN_NOT_REVIEWED');way+=uint(n.a.winVal);uint(way);}
   else {need([48,49,50].includes(uint(n.a.awardIndex))&&n.a.winVal==='0','EIGHTY_REEL_WIN_NOT_REVIEWED');scatter+=uint(n.a.winVal);}});
 }
 need(uint(s.a.totalWayWin)===way&&uint(s.a.totalScatterWin)===scatter&&uint(s.a.totalSpinWin)===way+scatter,'EIGHTY_REEL_WIN_MISMATCH');return way+scatter;
}
export function review(raw){need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','EIGHTY_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=12,'INVALID_ROUND_STEPS');const start=uint(raw.startBalanceRaw);
 let balance=start,win=0,base=0,trigger=0,left=null,session=null,next='Logic',kind='none',firstResult=null;
 for(let i=0;i<raw.steps.length;i++){
  const step=raw.steps[i];need(next!==null&&step.msgId===next,'EIGHTY_SEQUENCE_MISMATCH');const prior=request(step.requestPayload,next,i===0);
  need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(step.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){need(i===raw.steps.length-1&&!tags(r.root).includes('GameResult'),'EIGHTY_ENDGAME_MISMATCH');next=null;}
  else {
   const g=one(r.root,'GameResult');need(g.a.stake==='176'&&g.a.creditBet==='88'&&g.a.betMultiplier==='2'&&g.a.waysCount==='243'&&g.a.betID==='','EIGHTY_WAGER_MISMATCH');
   const award=uint(g.a.totalWin),f=children(g).filter(n=>n.tag==='Feature');need(f.length<=1,'EIGHTY_FEATURE_SHAPE');
   if(i===0){base=award;balance-=176;uint(balance);firstResult=g;if(f.length)kind=f[0].a.name==='FreeGame'?'freeGame':f[0].a.name==='BG_FuBat_Jackpot'?'feature':'unreviewed';need(kind!=='unreviewed','EIGHTY_FEATURE_NOT_ADAPTED');}
   else need(kind==='freeGame','EIGHTY_SEQUENCE_MISMATCH');
   let jackpot=0;
   if(kind==='freeGame'){
    const feature=one(g,'Feature'),d=one(feature,'data');need(same(feature.a,{index:'1',name:'FreeGame'})&&children(feature).length===1,'EIGHTY_FEATURE_SHAPE');
    keys(d,'totalFreeSpinsWin remainingFreeSpins extraFreeSpinsAwarded freeSpinTriggerWin lastFreeSpin');const remaining=uint(d.a.remainingFreeSpins);
    need(d.a.extraFreeSpinsAwarded==='0'&&remaining===(i===0?10:left-1)&&d.a.lastFreeSpin===(remaining===0?'Y':'N'),'EIGHTY_FREE_COUNTER_MISMATCH');
    if(i===0){trigger=uint(d.a.freeSpinTriggerWin);need([880,1760].includes(trigger),'EIGHTY_FREE_TRIGGER_NOT_REVIEWED');}
    else {need(d.a.freeSpinTriggerWin==='0','EIGHTY_FREE_COUNTER_MISMATCH');if(i===1)balance+=trigger;
     const ref=one(g,'BaseGameRecoveryInfo'),old=one(ref,'GameResult');need(children(ref).length===1&&same(old.a,firstResult.a)&&same(tags(old),['ReelResults'])&&same(one(old,'ReelResults'),one(firstResult,'ReelResults')),'EIGHTY_RECOVERY_REFERENCE_MISMATCH');}
    left=remaining;need(uint(d.a.totalFreeSpinsWin)===win+award+trigger-base,'EIGHTY_CUMULATIVE_WIN_MISMATCH');
   }else if(kind==='feature'){
    const feature=one(g,'Feature'),d=one(feature,'data');need(i===0&&same(feature.a,{index:'2',name:'BG_FuBat_Jackpot'})&&children(feature).length===1,'EIGHTY_FEATURE_SHAPE');
    keys(d,'pickLength jackpotWin jackpotType');need(['7|4000|0','8|4000|0','9|7500|1'].includes([d.a.pickLength,d.a.jackpotWin,d.a.jackpotType].join('|')),'EIGHTY_JACKPOT_NOT_REVIEWED');jackpot=uint(d.a.jackpotWin);
   }else need(i===0&&!f.length,'EIGHTY_FEATURE_SHAPE');
   need((i===0||kind!=='freeGame')&&!tags(g).includes('BaseGameRecoveryInfo')||i>0&&kind==='freeGame','EIGHTY_RECOVERY_REFERENCE_MISMATCH');
   need(reels(g,i===0,kind==='freeGame',kind!=='none')+jackpot===award,'EIGHTY_REEL_WIN_MISMATCH');win+=award;balance+=award;uint(win);uint(balance);
   const wi=one(g,'GameWinInfo');need(wi.a.isMaxWin==='N'&&wi.a.maxWinValue==='25000000'&&uint(wi.a.totalWagerWin)===win+trigger
    &&uint(wi.a.totalBaseGameWin)===base&&uint(wi.a.totalFreeSpinsWin)===(kind==='freeGame'?win+trigger-base:0),'EIGHTY_CUMULATIVE_WIN_MISMATCH');
   const rt=one(g,'GameRtpInfo');need(same(rt.a,{targetedRtpValue:'96.00'}),'EIGHTY_RESPONSE_MODE');
   if(kind==='freeGame'&&left===0)need(trigger===880,'EIGHTY_UNREVIEWED_FREE_TERMINAL');next=kind==='freeGame'&&left>0?'Logic':'EndGame';
  }
  need(r.balance===balance&&uint(step.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,kind,start,balance,win:win+trigger};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===176,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,
 bet:1.76,mul:s.win/176,buy:0,bonus:Number(s.kind!=='none'),primaryBonusKind:s.kind,typeMappingHash:mappingHash,
 money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:176}};
}
