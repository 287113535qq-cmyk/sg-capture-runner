import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
export const SOURCE='cheshirecat-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'cheshirecat',gameID:'20132',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],BGInfo:['totalWagerWin bgWinnings mysterySymbol isMaxWin maxWin','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'CHESHIRE_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','CHESHIRE_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'CHESHIRE_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'CHESHIRE_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['AccountData','Header','Stake']),'CHESHIRE_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'240',lines:'40'})&&!children(stake).length,'CHESHIRE_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'CHESHIRE_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20132'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'CHESHIRE_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(240)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'CHESHIRE_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','CHESHIRE_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'CHESHIRE_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','AccountData','Balances'])&&!children(one(r.root,'AccountData')).length&&!children(r.root).some(n=>n.tag==='GameResult'),'CHESHIRE_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'CHESHIRE_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'CHESHIRE_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['ReelResults','BGInfo']),'CHESHIRE_FEATURE_NOT_ADAPTED');
   need(g.a.stake==='240'&&g.a.stakePerLine==='6'&&g.a.paylineCount==='40'&&g.a.betID==='','CHESHIRE_WAGER_MISMATCH');win=uint(g.a.totalWin);
   const bg=one(g,'BGInfo');need(bg.a.isMaxWin==='0'&&uint(bg.a.mysterySymbol)>=1&&uint(bg.a.mysterySymbol)<=10&&bg.a.maxWin==='25000000'&&uint(bg.a.totalWagerWin)===win&&uint(bg.a.bgWinnings)===win,'CHESHIRE_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin');need(reels.a.numSpins==='1'&&children(reels).filter(n=>n.tag==='ReelSpin').length===1,'CHESHIRE_REEL_STATE_MISMATCH');
   need(spin.a.spinIndex==='0'&&spin.a.reelsetIndex==='0'&&spin.a.winCountSC==='0'&&spin.a.freeSpin==='N'&&spin.a.bonusAwarded==='N','CHESHIRE_FEATURE_NOT_ADAPTED');
   need(same(tags(reels),['ReelSpin']),'CHESHIRE_REEL_STATE_MISMATCH');
   const stops=one(spin,'ReelStops');need(!children(stops).length&&stops.children.map(n=>n.text??'').join('').split('|').length===5,'CHESHIRE_REEL_STATE_MISMATCH');
   stops.children.map(n=>n.text??'').join('').split('|').forEach(uint);
   const pays=children(spin).filter(n=>n.tag==='PaylineWin'),lines=new Set();let sum=0;
   need(uint(spin.a.winCountPL)===pays.length&&pays.length<=40&&uint(spin.a.spinWins)===win,'CHESHIRE_REEL_WIN_MISMATCH');
   for(const p of pays){const line=uint(p.a.index);need(line<40&&!lines.has(line)&&p.a.awardTableIndex==='0'&&[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31].includes(uint(p.a.awardIndex)),'CHESHIRE_PAYLINE_NOT_REVIEWED');need(!children(p).length&&["0|1|2", "0|1|2|3", "0|1|2|3|4", "0|1|2|8", "0|1|2|8|14", "0|1|3|4|7", "0|1|3|7", "0|1|7", "0|1|7|13", "0|1|7|13|14", "0|2|3|4|6", "0|2|3|6", "0|2|4|6|8", "0|2|6", "0|2|6|8", "0|4|6|7|8", "0|4|6|8|12", "0|6|12", "0|6|12|13", "0|6|12|13|14", "0|6|7", "0|6|7|8", "0|6|7|8|14", "0|6|8|12", "10|11|12", "10|11|12|13", "10|11|12|13|14", "10|11|13|14|17", "10|11|13|17", "10|11|17", "10|12|14|16|18", "10|12|16", "10|12|16|18", "10|14|16|17|18", "10|16|17", "10|16|17|18", "11|12|13|15", "11|12|13|15|19", "11|12|15", "11|13|15|17", "11|13|15|17|19", "11|15|17", "11|15|17|18", "11|15|17|18|19", "12|15|16", "12|15|16|18", "12|15|16|18|19", "13|15|16|17", "15|16|17", "15|16|17|18", "15|16|17|18|19", "1|2|3|5", "1|2|3|5|9", "1|2|5", "1|3|5|7", "1|3|5|7|9", "1|5|7", "1|5|7|13", "1|5|7|9|13", "2|5|6", "2|5|6|8", "2|5|6|8|9", "2|6|10", "2|6|8|10", "2|6|8|10|14", "3|4|7|10|11", "3|7|10|11", "5|11|12", "5|11|12|13", "5|11|13|17", "5|11|17", "5|6|12", "5|6|12|18", "5|6|12|18|19", "5|6|7", "5|6|7|8", "5|6|7|8|9", "5|6|8|12", "5|6|8|9|12", "5|7|11", "5|7|11|13", "5|7|9|11|13", "5|9|11|12|13", "5|9|11|13|17", "6|10|12", "6|7|10", "6|7|8|10", "6|7|8|10|14", "6|8|10|12", "6|8|10|12|14", "7|10|11", "7|10|11|13", "7|10|11|13|14", "7|11|13|15", "7|11|13|15|19", "7|11|15", "7|8|11|15", "7|8|9|11|15", "8|10|12|14|16", "8|10|12|16", "8|12|15|16", "8|9|12|15|16", "9|11|12|13|15", "9|13|15|16|17"].includes(p.children.map(n=>n.text??'').join('')),'CHESHIRE_PAYLINE_POSITIONS_NOT_REVIEWED');lines.add(line);sum+=uint(p.a.winVal);uint(sum);}
   need(sum===win,'CHESHIRE_REEL_WIN_MISMATCH');balance=start-240+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===240,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:2.4,mul:s.win/240,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:240}};
}
