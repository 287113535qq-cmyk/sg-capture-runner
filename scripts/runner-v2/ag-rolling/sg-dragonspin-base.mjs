import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-dragonspin-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='e0d02babaa9e090ea111ca8c06aa3f98da96f3b043e56c5a4d63b7960ca20f2f','DRAGONSPIN_POLICY_REQUIRED');
const awards=new Set(POLICY.awardTableWinPatterns.map(stable)),positions=new Set(POLICY.positionPatterns),msPatterns=new Set(POLICY.msReplacementJointPatterns.map(stable));

export const SOURCE='dragonspin-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'dragonspin',gameID:'20117',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','BonusData ReelResults MSReplacement BGInfo'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],BGInfo:['totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin',''],BonusData:['BonusBet',''],MSReplacement:['symbolCount','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'DRAGONSPIN_FEATURE_NOT_ADAPTED');
 need(!n.children.map(c=>c.text??'').join('').trim()||['CurrencyMultiplier','ReelStops','PaylineWin','MSReplacement','Stakes'].includes(n.tag),'DRAGONSPIN_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1&&a.children.every(c=>!c.text?.trim())
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','DRAGONSPIN_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'DRAGONSPIN_REQUEST_MISMATCH');
 const requestText=n=>{need(!n.children.map(c=>c.text??'').join('').trim()||n.tag==='CurrencyMultiplier','DRAGONSPIN_REQUEST_MODE');children(n).forEach(requestText);};requestText(q);
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'DRAGONSPIN_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['AccountData','Header','Stake']),'DRAGONSPIN_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'210'})&&!children(stake).length,'DRAGONSPIN_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'DRAGONSPIN_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20117'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'DRAGONSPIN_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(210)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'DRAGONSPIN_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','DRAGONSPIN_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'DRAGONSPIN_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','Balances'])&&!children(r.root).some(n=>n.tag==='GameResult'),'DRAGONSPIN_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'DRAGONSPIN_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'DRAGONSPIN_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['BonusData','ReelResults','MSReplacement','BGInfo']),'DRAGONSPIN_FEATURE_NOT_ADAPTED');win=uint(g.a.totalWin);
   need(same(g.a,{stake:'210',stakePerLine:'7',paylineCount:'30',totalWin:String(win),betID:''}),'DRAGONSPIN_WAGER_MISMATCH');
   const bg=one(g,'BGInfo');need(same(bg.a,{totalWagerWin:String(win),bgWinnings:String(win),baseGameSpinsRemaining:'0',isMaxWin:'0'}),'DRAGONSPIN_CUMULATIVE_WIN_MISMATCH');
   const bonus=one(g,'BonusData'),ms=one(g,'MSReplacement'),msText=ms.children.map(n=>n.text??'').join(''),count=uint(ms.a.symbolCount);
   need(same(bonus.a,{BonusBet:'0'})&&!children(bonus).length&&same(ms.a,{symbolCount:String(count)})&&!children(ms).length
    &&msPatterns.has(stable([String(count),msText])),'DRAGONSPIN_REPLACEMENT_NOT_REVIEWED');
   const symbols=msText.split('|').map(uint);need(symbols.length===5&&symbols.every(x=>x<=9),'DRAGONSPIN_REPLACEMENT_NOT_REVIEWED');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),ps=children(spin).filter(n=>n.tag==='PaylineWin'),spinWin=uint(spin.a.spinWins);
   need(same(reels.a,{numSpins:'1'})&&same(tags(reels),['ReelSpin']),'DRAGONSPIN_REEL_STATE_MISMATCH');
   need(ps.length<=POLICY.maxPaylines&&POLICY.reelsetIndices.includes(uint(spin.a.reelsetIndex))
    &&same(spin.a,{spinIndex:'0',reelsetIndex:spin.a.reelsetIndex,winCountPL:String(ps.length),winCountSC:'0',spinWins:String(spinWin),freeSpin:'N',bonusAwarded:'N'})
    &&same(tags(spin),['ReelStops',...ps.map(()=> 'PaylineWin')]),'DRAGONSPIN_FEATURE_NOT_ADAPTED');
   const stops=one(spin,'ReelStops'),stopText=stops.children.map(n=>n.text??'').join('');need(!children(stops).length&&stopText.split('|').length===5,'DRAGONSPIN_REEL_STATE_MISMATCH');
   stopText.split('|').forEach(uint);let sum=0;const lines=new Set();
   for(const p of ps){
    const line=uint(p.a.index),award=uint(p.a.awardIndex),table=uint(p.a.awardTableIndex),v=uint(p.a.winVal),text=p.children.map(n=>n.text??'').join('');
    need(line<30&&!lines.has(line)&&same(p.a,{index:String(line),winVal:String(v),awardIndex:String(award),awardTableIndex:String(table)})
     &&awards.has(stable([award,table,v]))&&!children(p).length&&positions.has(text),'DRAGONSPIN_PAYLINE_NOT_REVIEWED');
    const xs=text.split('|').map(uint);need(POLICY.positionLengths.includes(xs.length)&&new Set(xs).size===xs.length&&xs.every(x=>x<15),'DRAGONSPIN_PAYLINE_POSITIONS_NOT_REVIEWED');
    lines.add(line);sum+=v;uint(sum);
   }
   need(sum===spinWin&&sum===win,'DRAGONSPIN_REEL_WIN_MISMATCH');balance=start-210+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===210,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:2.1,mul:s.win/210,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:210}};
}
