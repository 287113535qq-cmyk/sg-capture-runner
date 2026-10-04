import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
export const SOURCE='acornpixie-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'acornpixie',gameID:'20174',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'],ReelResults:['numSpins','WildClusterMask ReelSpin'],
 WildClusterMask:['',''],ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],BGInfo:['totalWagerWin bgWinnings isMaxWin isBuyABonus','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'ACORN_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','ACORN_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'ACORN_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'ACORN_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','Stake','AccountData']),'ACORN_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'100',lines:'30',fsOn:'1',isBuyABonus:'0'})&&!children(stake).length,'ACORN_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'ACORN_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20174'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'ACORN_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(100)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'ACORN_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','ACORN_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'ACORN_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&!children(r.root).some(n=>n.tag==='GameResult'),'ACORN_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0,'ACORN_SEQUENCE_MISMATCH');const g=one(r.root,'GameResult');
   need(g.a.stake==='100'&&g.a.stakePerLine==='2'&&g.a.paylineCount==='30'&&g.a.betID==='','ACORN_WAGER_MISMATCH');win=uint(g.a.totalWin);
   const bg=one(g,'BGInfo');need(bg.a.isMaxWin==='0'&&bg.a.isBuyABonus==='0'&&uint(bg.a.totalWagerWin)===win&&uint(bg.a.bgWinnings)===win,'ACORN_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin');need(reels.a.numSpins==='1'&&children(reels).filter(n=>n.tag==='ReelSpin').length===1,'ACORN_REEL_STATE_MISMATCH');
   need(spin.a.spinIndex==='0'&&spin.a.reelsetIndex==='0'&&spin.a.winCountSC==='0'&&spin.a.freeSpin==='N'&&spin.a.bonusAwarded==='N','ACORN_FEATURE_NOT_ADAPTED');
   const mask=one(reels,'WildClusterMask');need(!children(mask).length&&[0,99,198,396,792,3168,6336,12672,25344].includes(uint(mask.children.map(n=>n.text??'').join(''))),'ACORN_WILD_MASK_NOT_REVIEWED');
   const stops=one(spin,'ReelStops');need(!children(stops).length&&stops.children.map(n=>n.text??'').join('').split('|').length===5,'ACORN_REEL_STATE_MISMATCH');
   stops.children.map(n=>n.text??'').join('').split('|').forEach(uint);
   const pays=children(spin).filter(n=>n.tag==='PaylineWin'),lines=new Set();let sum=0;
   need(uint(spin.a.winCountPL)===pays.length&&pays.length<=30&&uint(spin.a.spinWins)===win,'ACORN_REEL_WIN_MISMATCH');
   for(const p of pays){const line=uint(p.a.index);need(line<30&&!lines.has(line)&&p.a.awardTableIndex==='0'&&uint(p.a.awardIndex)<=32,'ACORN_PAYLINE_NOT_REVIEWED');lines.add(line);sum+=uint(p.a.winVal);uint(sum);}
   need(sum===win,'ACORN_REEL_WIN_MISMATCH');balance=start-100+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===100,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:1,mul:s.win/100,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:100}};
}
