// Raging Rhino: independent counters and explicit EndGame confirmation.
import {parseXml,children,one,uint,need as verify} from './pearl-protocol.mjs';
const assert=(ok,code)=>verify(ok,'RHINO_'+code);
export const RHINO_SOURCE='ragingrhino-wms-v1';
export const RHINO_GUARANTEE_EXTENSION=RHINO_SOURCE+'-terminal-guarantee-v1';
export function rhinoRequest(text,msg){
 const q=parseXml(text);assert(q.tag==='GameRequest'&&exact(q.a,{type:msg}),'REQUEST');
 const h=one(q,'Header');assert(Object.keys(h.a).sort().join()==='affiliate,ccyCode,channel,freePlay,gameCodeRGI,gameID,glsID,lang,promotions,sessionID,userID,userType,versionID'&&!children(h).length,'REQUEST');
 assert(Object.entries({freePlay:'Y',gameID:'20124',gameCodeRGI:'ragingrhino_prt',versionID:'1_0',promotions:'N',channel:'I',lang:'en_US',userType:'C'}).every(([k,v])=>h.a[k]===v)&&h.a.sessionID?.length>0&&h.a.sessionID.length<=1024,'REQUEST_MODE');
 const tags=children(q).map(n=>n.tag).sort().join();
 if(msg==='Init'||msg==='EndGame')assert(tags==='Header','REQUEST');
 else {assert(msg==='Logic'&&tags==='AccountData,Header,WagerInfo','REQUEST');const w=one(q,'WagerInfo'),a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');
  assert(exact(w.a,{betMultiplier:'1'})&&!children(w).length&&!Object.keys(a.a).length&&children(a).length===1&&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','WAGER');}
 return h.a;
}
const exact=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const schema={GameResponse:['type','Header AccountData Balances GameResult'],Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],GameResult:['stake totalWin betID betMultiplier creditBet waysCount','ReelResults GameWinInfo GameRtpInfo Feature BaseGameRecoveryInfo'],ReelResults:['numSpins','ReelSpin'],ReelSpin:['anywayWinCount bonusAwarded freeSpin reelsetIndex scatterWinCount totalScatterWin totalSpinWin totalWayWin','ReelStops AnywayWin ScatterWin'],ReelStops:['',''],AnywayWin:['awardIndex ways winIndex winVal',''],ScatterWin:['awardIndex winIndex winVal',''],GameWinInfo:['isMaxWin maxWinValue totalBaseGameWin totalFreeSpinsWin totalWagerWin',''],GameRtpInfo:['targetedRtpValue',''],Feature:['index name','data'],data:['bonusAwarded extraFreeSpinsAwarded freeSpinsTriggerWin lastFreeSpin multiplier remainingFreeSpins totalFreeSpinsTriggered',''],BaseGameRecoveryInfo:['','GameResult']};
function shape(n){const x=schema[n.tag];assert(x&&Object.keys(n.a).every(k=>x[0].split(' ').includes(k))&&children(n).every(c=>x[1].split(' ').includes(c.tag)),'UNKNOWN_FEATURE');children(n).forEach(shape);}
export function rhinoReview(raw,{legacy=false}={}){
 assert(raw?.sourceKey==='ragingrhino-wms-v1'&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','PROFILE');assert(Array.isArray(raw.steps)&&raw.steps.length<=1026,'STEP_LIMIT');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session,identity,free,total=0,first=0,next='Logic',retriggers=0,guaranteeTotal=0,base;
 for(const [i,s] of raw.steps.entries()){
  if(!legacy)rhinoRequest(s.requestPayload,next);
  assert(next&&s.msgId===next,'SEQUENCE');const q=parseXml(s.requestPayload);assert(q.tag==='GameRequest'&&exact(q.a,{type:next}),'REQUEST');const header=one(q,'Header'),h=header.a;assert(Object.keys(h).sort().join()==='affiliate,ccyCode,channel,freePlay,gameCodeRGI,gameID,glsID,lang,promotions,sessionID,userID,userType,versionID'&&!children(header).length,'REQUEST');
  assert(Object.entries({freePlay:'Y',gameID:'20124',gameCodeRGI:'ragingrhino_prt',versionID:'1_0',promotions:'N',channel:'I',lang:'en_US',userType:'C'}).every(([k,v])=>h[k]===v),'REQUEST_MODE');
  assert(h.sessionID?.length>0&&h.sessionID.length<=1024&&(!session||h.sessionID===session),'SESSION');const id=Object.fromEntries(Object.entries(h).filter(([k])=>k!=='sessionID'));assert(!identity||exact(identity,id),'IDENTITY');identity=id;
  const tags=children(q).map(n=>n.tag).sort();if(next==='EndGame'||legacy&&i>0&&tags.join()==='Header')assert(tags.join()==='Header','REQUEST');else{
   assert(tags.join()==='AccountData,Header,WagerInfo'&&exact(one(q,'WagerInfo').a,{betMultiplier:'1'}),'WAGER');const a=one(q,'AccountData');assert(!Object.keys(a.a).length,'REQUEST');assert(legacy&&!children(a).length||one(a,'CurrencyMultiplier').children.map(n=>n.text??'').join('')==='1','CURRENCY');
  }
  assert(uint(s.elapsedMs)<=300000,'TIMING');const r=parseXml(s.responseXml);assert(JSON.stringify(r)===JSON.stringify(parseXml(s.responsePayload)),'XML_EVIDENCE');shape(r);assert(r.tag==='GameResponse'&&exact(r.a,{type:next}),'RESPONSE');
  const rh=one(r,'Header').a;assert(rh.gameID==='20124'&&rh.versionID==='1_0'&&rh.isRecovering==='N','RESPONSE_IDENTITY');session=rh.sessionID;assert(session?.length>0&&session.length<=1024,'SESSION');
  if(next==='EndGame'){assert(i===raw.steps.length-1&&!children(r).some(n=>n.tag==='GameResult'),'END');next=null;}
  else{
   const g=one(r,'GameResult');assert(Object.entries({stake:'40',creditBet:'40',betMultiplier:'1',waysCount:'4096'}).every(([k,v])=>g.a[k]===v),'WAGER');const award=uint(g.a.totalWin);if(!i){balance-=40;first=award;}balance+=award;win+=award;uint(balance);uint(win);
   if(!i)base={a:g.a,reels:one(g,'ReelResults')};
   const recovery=children(g).filter(n=>n.tag==='BaseGameRecoveryInfo');assert(recovery.length<=1&&(!recovery.length||i>0),'BASE_RECOVERY');
   if(recovery.length){const b=one(recovery[0],'GameResult');assert(children(recovery[0]).length===1&&children(b).length===1&&exact(b.a,base.a)&&JSON.stringify(one(b,'ReelResults'))===JSON.stringify(base.reels),'BASE_RECOVERY');}
   const info=one(g,'GameWinInfo').a;assert(info.isMaxWin==='N','FEATURE');assert(uint(info.totalBaseGameWin)===first&&uint(info.totalFreeSpinsWin)===win-first&&uint(info.totalWagerWin)===win,'TOTAL');
   const features=children(g).filter(n=>n.tag==='Feature'),fs=features.filter(n=>n.a.index==='1');assert(new Set(features.map(n=>n.a.index)).size===features.length,'FEATURE_DUPLICATE');if(free===undefined)free=!!fs.length;
   let guarantee=0;for(const f of features){assert(children(f).length===1,'FEATURE');const d=one(f,'data').a;if(f.a.index==='1')assert(f.a.name==='FreeSpins','FEATURE');else if(f.a.index==='3'){assert(exact(f.a,{index:'3',name:'BonusGuarantee'})&&Object.keys(d).join()==='bonusAwarded'&&i>0&&free,'GUARANTEE_SHAPE');guarantee=uint(d.bonusAwarded);assert(guarantee>0,'GUARANTEE_AMOUNT');}else{
    assert(exact(f.a,{index:'2',name:'WildInfo'})&&Object.keys(d).join()==='multiplier'&&i>0&&free,'FEATURE');const a=d.multiplier.split(',');assert(a.every(v=>/^(0|[1-9]\d*)\|[23]$/.test(v)&&Number(v.split('|')[0])<24)&&new Set(a.map(v=>v.split('|')[0])).size===a.length,'WILD_MULTIPLIER');}}
   let pending=false,awarded=0;if(free){assert(fs.length===1,'FREE_FEATURE');const d=one(fs[0],'data').a,keys=Object.keys(d).sort().join();
    assert(keys===(i?'extraFreeSpinsAwarded,freeSpinsTriggerWin,lastFreeSpin,remainingFreeSpins,totalFreeSpinsTriggered':'freeSpinsTriggerWin,lastFreeSpin,totalFreeSpinsTriggered'),'FREE_SHAPE');const add=i?uint(d.extraFreeSpinsAwarded):uint(d.totalFreeSpinsTriggered);
    awarded=add;uint(d.freeSpinsTriggerWin);assert(!i||i<=total,'FREE_AFTER_END');assert((i>0||add>0)&&add<=1024,'RETRIGGER');total+=add;if(i&&add)retriggers++;assert(total<=1024&&uint(d.totalFreeSpinsTriggered)===total,'FREE_TOTAL');pending=i<total;
    assert(d.lastFreeSpin===(pending?'N':'Y')&&(!i||uint(d.remainingFreeSpins)===total-i),'FREE_TERMINAL');
   }else assert(!i&&!features.length,'BASE_FEATURE');
   assert(!guarantee||free&&i>0&&!pending&&awarded===0,'GUARANTEE_TERMINAL');guaranteeTotal+=guarantee;
   const reels=one(g,'ReelResults'),spins=children(reels);assert(reels.a.numSpins==='1'&&spins.length===1&&spins[0].tag==='ReelSpin','REELS');const spin=spins[0],a=spin.a;
   assert(a.freeSpin===(i?'Y':'N')&&a.bonusAwarded===(awarded||guarantee?'Y':'N'),'FREE_FLAG');assert(uint(a.totalSpinWin)+guarantee===award&&uint(a.totalScatterWin)+uint(a.totalWayWin)+guarantee===award,'REEL_MONEY');
   for(const [tag,count,money]of[['AnywayWin','anywayWinCount','totalWayWin'],['ScatterWin','scatterWinCount','totalScatterWin']]){const wins=children(spin).filter(n=>n.tag===tag);assert(wins.length===uint(a[count])&&wins.reduce((s,n)=>s+uint(n.a.winVal),0)===uint(a[money]),'WIN_MONEY');}
   next=pending?'Logic':'EndGame';
  }
  const b=one(r,'Balances');assert(children(b).length===1&&exact(one(b,'Balance').a,{name:'CASH_BALANCE',value:String(balance)})&&uint(s.responseBalance)===balance,'BALANCE');
 }
 return {next,session,start,end:balance,win,betRaw:40,bonus:Number(!!free),retriggers,guarantee:guaranteeTotal};
}

export function rhinoNext(raw){const s=rhinoReview(raw);return s.next?{MSGID:s.next}:null;}
export function rhinoMapping(raw,mappingHash,extensionHash){
 const s=rhinoReview(raw);assert(s.next===null,'INCOMPLETE');assert(/^[a-f0-9]{64}$/.test(mappingHash),'MAPPING');
 const selected=s.guarantee?extensionHash:mappingHash;assert(/^[a-f0-9]{64}$/.test(selected??''),'GUARANTEE_MAPPING');
 return {buy:0,bonus:s.bonus,typeMappingHash:selected};
}
