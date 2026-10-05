import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-fudaole-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='889dfa755444e51012b03a9eb62ab5fe739d7016e4fb8bb4305f9fd45828f93f','FUDAOLE_POLICY_REQUIRED');
const awards=new Set(POLICY.awardWaysWinPatterns.map(stable)),positions=new Set(POLICY.positionPatterns),mysteryPatterns=new Set(POLICY.mysteryJointPatterns.map(stable));

export const SOURCE='fudaole-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'fudaole',gameID:'20135',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['totalStake waysCount totalWin betID','MysteryRepSymbol ReelResults GameWinInfo GameRtpInfo'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['reelsetIndex anywayWinCount scatterWinCount totalWayWin totalScatterWin totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'],
 ReelStops:['',''],AnywayWin:['winIndex winVal ways awardIndex',''],MysteryRepSymbol:['isSymPresent replacementSymbolIndex isNudgingWild nudgingWildPositions isRedEnvlpJkpt',''],GameWinInfo:['totalWagerWin totalBaseGameWin totalFreeSpinsWin totalPickJkptWin maxWinValue isMaxWin',''],GameRtpInfo:['targetedRtpValue','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'FUDAOLE_FEATURE_NOT_ADAPTED');
 need(!n.children.map(c=>c.text??'').join('').trim()||['CurrencyMultiplier','ReelStops','AnywayWin','Stakes'].includes(n.tag),'FUDAOLE_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1&&a.children.every(c=>!c.text?.trim())
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','FUDAOLE_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'FUDAOLE_REQUEST_MISMATCH');
 const requestText=n=>{need(!n.children.map(c=>c.text??'').join('').trim()||n.tag==='CurrencyMultiplier','FUDAOLE_REQUEST_MODE');children(n).forEach(requestText);};requestText(q);
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'FUDAOLE_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','WagerInfo','AccountData']),'FUDAOLE_REQUEST_MISMATCH');
  const stake=one(q,'WagerInfo');need(same(stake.a,{totalStake:'200',featureBet:'0'})&&!children(stake).length,'FUDAOLE_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'FUDAOLE_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20135'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'FUDAOLE_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(200)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'FUDAOLE_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','FUDAOLE_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'FUDAOLE_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','AccountData','Balances'])&&one(r.root,'AccountData').children.length===0&&!children(r.root).some(n=>n.tag==='GameResult'),'FUDAOLE_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'FUDAOLE_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'FUDAOLE_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['MysteryRepSymbol','ReelResults','GameWinInfo','GameRtpInfo']),'FUDAOLE_FEATURE_NOT_ADAPTED');win=uint(g.a.totalWin);
   need(same(g.a,{totalStake:'200',waysCount:'243',totalWin:String(win),betID:''}),'FUDAOLE_WAGER_MISMATCH');
   need(same(one(g,'GameWinInfo').a,{totalWagerWin:String(win),totalBaseGameWin:String(win),totalFreeSpinsWin:'0',totalPickJkptWin:'0',maxWinValue:'25000000',isMaxWin:'N'}),'FUDAOLE_CUMULATIVE_WIN_MISMATCH');
   need(same(one(g,'GameRtpInfo').a,{targetedRtpValue:'96.06'}),'FUDAOLE_RTP_NOT_REVIEWED');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),ps=children(spin).filter(n=>n.tag==='AnywayWin');
   need(same(reels.a,{numSpins:'1'})&&same(tags(reels),['ReelSpin']),'FUDAOLE_REEL_STATE_MISMATCH');
   need(ps.length<=POLICY.maxAnywayWins&&same(spin.a,{reelsetIndex:'0',anywayWinCount:String(ps.length),scatterWinCount:'0',totalWayWin:String(win),totalScatterWin:'0',totalSpinWin:String(win),freeSpin:'N',bonusAwarded:'N'})
    &&same(tags(spin),['ReelStops',...ps.map(()=> 'AnywayWin')]),'FUDAOLE_FEATURE_NOT_ADAPTED');
   const mystery=one(g,'MysteryRepSymbol');need(!children(mystery).length&&mysteryPatterns.has(stable(mystery.a)),'FUDAOLE_MYSTERY_NOT_REVIEWED');
   const stops=one(spin,'ReelStops'),stopText=stops.children.map(n=>n.text??'').join('');need(!children(stops).length&&stopText.split('|').length===5,'FUDAOLE_REEL_STATE_MISMATCH');
   stopText.split('|').forEach(uint);let sum=0;
   for(const [wi,p]of ps.entries()){
    const award=uint(p.a.awardIndex),ways=uint(p.a.ways),v=uint(p.a.winVal),text=p.children.map(n=>n.text??'').join('');
    need(same(p.a,{winIndex:String(wi),winVal:String(v),ways:String(ways),awardIndex:String(award)})&&awards.has(stable([award,ways,v]))&&!children(p).length&&positions.has(text),'FUDAOLE_ANYWAY_NOT_REVIEWED');
    const xs=text.split('|').map(uint);need(POLICY.positionLengths.includes(xs.length)&&new Set(xs).size===xs.length&&xs.every(x=>x<POLICY.positionMaxExclusive),'FUDAOLE_ANYWAY_POSITIONS_NOT_REVIEWED');
    // Each own winVal already includes its ways award; add it once.
    sum+=v;uint(sum);
   }
   need(sum===win,'FUDAOLE_REEL_WIN_MISMATCH');balance=start-200+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===200,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:2,mul:s.win/200,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:200}};
}
