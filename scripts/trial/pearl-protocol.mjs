import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {XMLParser,XMLValidator}=require('../../collector/node_modules/fast-xml-parser');
export const PEARL_SOURCE='pearlofthecaribbean-wms-v1';
export const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
export const uint=v=>{need((typeof v==='number'&&Number.isSafeInteger(v)||typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v))&&Number.isSafeInteger(Number(v))&&Number(v)>=0,'INVALID_WMS_MONEY');return Number(v);};
const parser=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
export function parseXml(text){
 need(typeof text==='string'&&text.length>0&&text.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(text)&&XMLValidator.validate(text)===true,'INVALID_WMS_XML');
 const convert=entry=>{const keys=Object.keys(entry).filter(k=>k!==':@');need(keys.length===1,'INVALID_WMS_XML');const tag=keys[0];return {tag,a:entry[':@']??{},children:tag==='#text'?[]:entry[tag].filter(x=>!Object.hasOwn(x,'?xml')).map(convert),text:tag==='#text'?entry[tag]:null};};
 const roots=parser.parse(text).filter(x=>!Object.hasOwn(x,'?xml')&&!Object.hasOwn(x,'#text'));
 need(roots.length===1,'INVALID_WMS_XML');return convert(roots[0]);
}
export const children=n=>n.children.filter(x=>x.tag!=='#text');
export const one=(n,tag)=>{const a=children(n).filter(x=>x.tag===tag);need(a.length===1,'AMBIGUOUS_WMS_STRUCTURE');return a[0];};
const equal=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const headerKeys='affiliate ccyCode channel freePlay gameCodeRGI gameID glsID lang promotions sessionID userID userType versionID'.split(' ').sort();
const mode={freePlay:'Y',gameCodeRGI:'pearlofthecaribbean',gameID:'20327',lang:'en_US',promotions:'N',userType:'C',versionID:'1_0',channel:'I'};
const withoutSession=h=>Object.fromEntries(Object.entries(h).filter(([k])=>k!=='sessionID'));
export function pearlRequest(text,msg,{legacy=false}={}){
 const root=parseXml(text);need(root.tag==='GameRequest'&&equal(root.a,{type:msg}),'WMS_REQUEST_MISMATCH');
 const h=one(root,'Header');need(JSON.stringify(Object.keys(h.a).sort())===JSON.stringify(headerKeys)&&children(h).length===0,'WMS_REQUEST_MISMATCH');
 need(Object.entries(mode).every(([k,v])=>h.a[k]===v),'WMS_REQUEST_MODE');need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const tags=children(root).map(n=>n.tag);
 if(msg==='EndGame'||legacy&&tags.length===1)need(tags.length===1&&tags[0]==='Header','WMS_REQUEST_MISMATCH');
 else {need(msg==='Logic'&&JSON.stringify([...tags].sort())==='["AccountData","Header","Stake"]','WMS_REQUEST_MISMATCH');
  const stake=one(root,'Stake');need(equal(stake.a,{total:'200',isBigBet:'0'})&&!children(stake).length,'WMS_REQUEST_MODE');
  const a=one(root,'AccountData');need(!Object.keys(a.a).length,'WMS_REQUEST_MISMATCH');
  if(!legacy||children(a).length){const c=one(a,'CurrencyMultiplier');need(children(a).length===1&&!Object.keys(c.a).length&&!children(c).length&&c.children.map(x=>x.text??'').join('')==='1','WMS_REQUEST_MODE');}}
 return h.a;
}
const schema={
 GameResponse:['type','Header AccountData Balances GameResult'],Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo FSInfo WildReels BaseGameRecoveryInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['bonusAwarded freeSpin reelsetIndex spinIndex spinWins winCountPL winCountSC','ReelStops PaylineWin ScatterWin'],
 ReelStops:['',''],PaylineWin:['awardIndex awardTableIndex index winVal',''],ScatterWin:['awardIndex winVal',''],
 BGInfo:['baseGameSpinsRemaining bgWinnings isBigBet isMaxWin totalWagerWin',''],FSInfo:['freeSpinNumber freeSpinsAwarded freeSpinsTotal fsWinnings isMaxWin',''],
 WildReels:['reelSet0 reelSet1 reelSet2 reelSet3 reelSet4',''],BaseGameRecoveryInfo:['','ReelResults WildReels']};
function checkShape(n){const spec=schema[n.tag];need(spec&&Object.keys(n.a).every(k=>spec[0].split(' ').includes(k))&&children(n).every(c=>spec[1].split(' ').includes(c.tag)),'PEARL_FEATURE_NOT_ADAPTED');children(n).forEach(checkShape);}
export function pearlReview(raw,{legacy=false}={}){
 need(raw?.sourceKey===PEARL_SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','PEARL_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=10,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session,identity,firstWin,free,next='Logic';
 raw.steps.forEach((s,i)=>{
  need(next!==null&&s.msgId===next,'WMS_SEQUENCE_MISMATCH');const q=pearlRequest(s.requestPayload,next,{legacy});
  if(legacy&&i===0)one(parseXml(s.requestPayload),'Stake');
  const id=withoutSession(q);need(identity===undefined||equal(identity,id),'WMS_REQUEST_IDENTITY_CHANGED');identity=id;
  need(session===undefined||q.sessionID===session,'WMS_SESSION_CHAIN_MISMATCH');
  const root=parseXml(s.responsePayload);need(JSON.stringify(root)===JSON.stringify(parseXml(s.responseXml)),'WMS_XML_EVIDENCE_MISMATCH');
  need(root.tag==='GameResponse'&&equal(root.a,{type:next}),'MESSAGE_ID_MISMATCH');checkShape(root);
  const rh=one(root,'Header').a;need(rh.gameID==='20327'&&rh.versionID==='1_0'&&rh.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
  session=rh.sessionID;need(typeof session==='string'&&session.length>0&&session.length<=1024,'WMS_SESSION_REQUIRED');need(uint(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
  if(next==='EndGame'){need(i===raw.steps.length-1&&!children(root).some(n=>n.tag==='GameResult')&&rh.readyForEndGame==='N','WMS_ENDGAME_MISMATCH');next=null;}
  else {const r=one(root,'GameResult');need(r.a.stake==='200'&&r.a.stakePerLine==='4'&&r.a.paylineCount==='50','WMS_WAGER_MISMATCH');
   const award=uint(r.a.totalWin);if(i===0){balance-=200;firstWin=award;}win+=award;balance+=award;uint(win);uint(balance);
   const bg=one(r,'BGInfo').a;need(['isBigBet','isMaxWin','baseGameSpinsRemaining'].every(k=>bg[k]==='0'),'PEARL_FEATURE_NOT_ADAPTED');
   need(uint(bg.bgWinnings)===firstWin&&uint(bg.totalWagerWin)===win,'WMS_CUMULATIVE_WIN_MISMATCH');
   const fs=children(r).filter(n=>n.tag==='FSInfo');if(free===undefined)free=fs.length>0;
   let pending=false;
   if(free){const f=one(r,'FSInfo').a;need(f.isMaxWin==='0'&&f.freeSpinsTotal==='8'&&f.freeSpinsAwarded===(i?'0':'8'),'PEARL_FEATURE_NOT_ADAPTED');
    need(i<=8&&uint(f.freeSpinNumber)===i,'WMS_FREE_COUNTER_MISMATCH');need(uint(f.fsWinnings)===win-firstWin,'WMS_CUMULATIVE_WIN_MISMATCH');pending=i<8;
   }else need(i===0&&!fs.length,'WMS_SEQUENCE_MISMATCH');
   need(rh.readyForEndGame===(pending?'N':'Y'),'WMS_SETTLEMENT_FLAG_MISMATCH');
   const reels=one(r,'ReelResults'),spins=children(reels);need(reels.a.numSpins==='5'&&spins.length===5&&spins.every(n=>n.tag==='ReelSpin'),'PEARL_FEATURE_NOT_ADAPTED');
   need(spins.every(n=>n.a.freeSpin===(i?'Y':'N')),'WMS_FREE_STATE_MISMATCH');need(spins.every(n=>['Y','N'].includes(n.a.bonusAwarded)),'PEARL_FEATURE_NOT_ADAPTED');
   need(!spins.some(n=>n.a.bonusAwarded==='Y')||free&&i===0,'PEARL_FEATURE_NOT_ADAPTED');need(spins.reduce((sum,n)=>sum+uint(n.a.spinWins),0)===award,'WMS_REEL_WIN_MISMATCH');
   next=pending?'Logic':'EndGame';}
  const balances=one(root,'Balances');need(children(balances).length===1&&equal(one(balances,'Balance').a,{name:'CASH_BALANCE',value:String(balance)})&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 });
 return {next,session,feature:!!free,start,balance,win};
}
export function pearlNext(raw){const {next}=pearlReview(raw);return next?{MSGID:next}:null;}
export function pearlMapping(raw,typeMappingHash){const s=pearlReview(raw);need(s.next===null,'INCOMPLETE_ROUND');need(/^[a-f0-9]{64}$/.test(typeMappingHash??''),'PEARL_MAPPING_REQUIRED');return {buy:0,bonus:Number(s.feature),typeMappingHash};}
