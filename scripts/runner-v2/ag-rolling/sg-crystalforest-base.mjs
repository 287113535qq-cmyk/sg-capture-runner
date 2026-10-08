import {ownWmsInit} from './sg-own-wms-init.mjs';
import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-crystalforest-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='cea5b9022b20d763b51cf042457cda0ae15e33d67b1694b90c025cdaad960295','CRYSTALFOREST_POLICY_REQUIRED');
const awards=new Set(POLICY.awardPairs.map(stable)),positions=new Set(POLICY.positionPatterns),masks=new Set(POLICY.cascadeIndexMaskPatterns.map(stable));
export const SOURCE='crystalforest-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'crystalforesthd_prt',gameID:'20142',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex cascadeCount winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops Cascade'],
 ReelStops:['',''],Cascade:['index winCountPL winCountSC cascadeWins cascadeMask','PaylineWin'],
 PaylineWin:['index winVal awardIndex awardTableIndex',''],BGInfo:['totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'CRYSTALFOREST_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','CRYSTALFOREST_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'CRYSTALFOREST_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'CRYSTALFOREST_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['AccountData','Header','Stake']),'CRYSTALFOREST_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'25',lines:'25'})&&!children(stake).length,'CRYSTALFOREST_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'CRYSTALFOREST_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20142'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'CRYSTALFOREST_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 if(ownWmsInit(r.root,32759,25)){need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};}
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(25)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'CRYSTALFOREST_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','CRYSTALFOREST_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'CRYSTALFOREST_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','AccountData','Balances'])&&!one(r.root,'AccountData').children.length&&!children(r.root).some(n=>n.tag==='GameResult'),'CRYSTALFOREST_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'CRYSTALFOREST_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'CRYSTALFOREST_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['ReelResults','BGInfo']),'CRYSTALFOREST_FEATURE_NOT_ADAPTED');
   need(g.a.stake==='25'&&g.a.stakePerLine==='1'&&g.a.paylineCount==='25'&&g.a.betID==='','CRYSTALFOREST_WAGER_MISMATCH');win=uint(g.a.totalWin);
   const bg=one(g,'BGInfo');need(same(bg.a,{totalWagerWin:String(win),bgWinnings:String(win),baseGameSpinsRemaining:'0',isBigBet:'0',isMaxWin:'0'}),'CRYSTALFOREST_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),cs=children(spin).filter(n=>n.tag==='Cascade');
   need(same(reels.a,{numSpins:'1'})&&same(tags(reels),['ReelSpin']),'CRYSTALFOREST_REEL_STATE_MISMATCH');
   need(cs.length>=1&&cs.length<=4&&spin.a.spinIndex==='0'&&spin.a.reelsetIndex==='0'&&spin.a.cascadeCount===String(cs.length)
    &&spin.a.winCountSC==='0'&&spin.a.freeSpin==='N'&&spin.a.bonusAwarded==='N'
    &&same(tags(spin),['ReelStops',...cs.map(()=> 'Cascade')]),'CRYSTALFOREST_FEATURE_NOT_ADAPTED');
   const stops=one(spin,'ReelStops');need(!children(stops).length&&stops.children.map(n=>n.text??'').join('').split('|').length===5,'CRYSTALFOREST_REEL_STATE_MISMATCH');
   stops.children.map(n=>n.text??'').join('').split('|').forEach(uint);let sum=0,payCount=0;
   for(const [ci,c]of cs.entries()){
    const ps=children(c);need(same(tags(c),ps.map(()=> 'PaylineWin'))&&c.a.index===String(ci)&&c.a.winCountSC==='0'
     &&uint(c.a.winCountPL)===ps.length&&ps.length<=25&&(ci===cs.length-1?ps.length===0:ps.length>0),'CRYSTALFOREST_CASCADE_COUNTER');
    let cw=0;const lines=new Set(),union=new Set();
    for(const p of ps){const line=uint(p.a.index),award=uint(p.a.awardIndex),v=uint(p.a.winVal),text=p.children.map(n=>n.text??'').join('');
     need(line<25&&!lines.has(line)&&p.a.awardTableIndex==='0'&&awards.has(stable([award,v]))&&!children(p).length
      &&positions.has(text),'CRYSTALFOREST_PAYLINE_NOT_REVIEWED');lines.add(line);const xs=text.split('|').map(uint);
     need(xs.length>=3&&xs.length<=5&&new Set(xs).size===xs.length&&xs.every(x=>x<15),'CRYSTALFOREST_PAYLINE_NOT_REVIEWED');
     xs.forEach(x=>union.add(x));cw+=v;uint(cw);
    }
    // The mask is the union of this cascade's winning positions; it adds no award.
    const mask=[...union].reduce((v,x)=>v+2**x,0);need(uint(c.a.cascadeMask)===mask&&masks.has(stable([ci,mask])),'CRYSTALFOREST_CASCADE_MASK_NOT_REVIEWED');
    need(uint(c.a.cascadeWins)===cw,'CRYSTALFOREST_CASCADE_WIN_MISMATCH');sum+=cw;uint(sum);payCount+=ps.length;
   }
   need(payCount<=38&&uint(spin.a.winCountPL)===payCount&&uint(spin.a.spinWins)===sum&&sum===win,'CRYSTALFOREST_REEL_WIN_MISMATCH');balance=start-25+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===25,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:0.25,mul:s.win/25,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:25}};
}
