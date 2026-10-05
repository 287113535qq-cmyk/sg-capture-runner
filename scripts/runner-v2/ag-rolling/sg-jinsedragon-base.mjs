import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-jinsedragon-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='5544bd8d6b4e4f715a0e50387d344b5c7c05c50368dfe37a325ba29e7b993561','JINSEDRAGON_POLICY_REQUIRED');
const joints=new Set(POLICY.stateJointPatterns.map(stable));

export const SOURCE='jinsedaodragon-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'jinsedaodragon',gameID:'20401',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID readyForEndGame isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo Orbs'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex anywayWins scatterWinCount totalSpinWin freeSpin bonusAwarded','ReelStops AnywayWin'],
 ReelStops:['',''],AnywayWin:['winIndex winVal ways awardIndex',''],BGInfo:['totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin expReelTriggerType reelHeights',''],Orbs:['numJackpotWins','Orb'],Orb:['awardIndex amount position winning isJackpot','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'JINSEDRAGON_FEATURE_NOT_ADAPTED');
 need(!n.children.map(c=>c.text??'').join('').trim()||['CurrencyMultiplier','ReelStops','AnywayWin','Stakes'].includes(n.tag),'JINSEDRAGON_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1&&a.children.every(c=>!c.text?.trim())
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','JINSEDRAGON_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'JINSEDRAGON_REQUEST_MISMATCH');
 const requestText=n=>{need(!n.children.map(c=>c.text??'').join('').trim()||n.tag==='CurrencyMultiplier','JINSEDRAGON_REQUEST_MODE');children(n).forEach(requestText);};requestText(q);
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'JINSEDRAGON_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['AccountData','Header','Stake']),'JINSEDRAGON_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'100'})&&!children(stake).length,'JINSEDRAGON_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'JINSEDRAGON_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20401'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'JINSEDRAGON_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(100)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'JINSEDRAGON_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','JINSEDRAGON_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=10,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'JINSEDRAGON_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&one(r.root,'Header').a.readyForEndGame==='N'&&same(tags(r.root),['Header','AccountData','Balances'])&&!Object.keys(one(r.root,'AccountData').a).length&&!children(one(r.root,'AccountData')).length&&!children(r.root).some(n=>n.tag==='GameResult'),'JINSEDRAGON_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'JINSEDRAGON_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'JINSEDRAGON_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['ReelResults','BGInfo','Orbs']),'JINSEDRAGON_FEATURE_NOT_ADAPTED');win=uint(g.a.totalWin);
   need(same(g.a,{stake:'100',stakePerLine:'100',paylineCount:'1',totalWin:String(win),betID:''}),'JINSEDRAGON_WAGER_MISMATCH');
   const bg=one(g,'BGInfo'),orbs=one(g,'Orbs'),items=children(orbs);
   need(orbs.a.numJackpotWins==='0'&&items.every(n=>!(n.a.isJackpot==='y'&&n.a.winning==='y')),'JINSEDRAGON_FEATURE_NOT_ADAPTED');
   need(one(r.root,'Header').a.readyForEndGame==='Y','JINSEDRAGON_FEATURE_NOT_ADAPTED');
   need(same(bg.a,{totalWagerWin:String(win),bgWinnings:String(win),baseGameSpinsRemaining:'0',isMaxWin:'0',expReelTriggerType:bg.a.expReelTriggerType,reelHeights:bg.a.reelHeights}),'JINSEDRAGON_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),ps=children(spin).filter(n=>n.tag==='AnywayWin'),spinWin=uint(spin.a.totalSpinWin);
   need(same(reels.a,{numSpins:'1'})&&same(tags(reels),['ReelSpin']),'JINSEDRAGON_REEL_STATE_MISMATCH');
   need(ps.length<=2&&same(spin.a,{spinIndex:'0',reelsetIndex:'0',anywayWins:String(ps.length),scatterWinCount:'0',totalSpinWin:String(spinWin),freeSpin:'N',bonusAwarded:'N'})&&same(tags(spin),['ReelStops',...ps.map(()=> 'AnywayWin')]),'JINSEDRAGON_FEATURE_NOT_ADAPTED');
   need(joints.has(stable({expReelTriggerType:bg.a.expReelTriggerType,reelHeights:bg.a.reelHeights,orbs:{attrs:orbs.a,items:items.map(n=>n.a)}})),'JINSEDRAGON_STATE_JOINT_NOT_REVIEWED');
   need(same(orbs.a,{numJackpotWins:'0'})&&POLICY.orbCounts.includes(items.length)&&same(tags(orbs),items.map(()=> 'Orb')),'JINSEDRAGON_ORBS_NOT_REVIEWED');
   let orbWin=0;
   for(const [index,n]of items.entries()) {const award=uint(n.a.awardIndex),amount=uint(n.a.amount);need(same(n.a,{awardIndex:String(award),amount:String(amount),position:String(index),winning:n.a.winning,isJackpot:n.a.isJackpot})&&!children(n).length&&['n','y'].includes(n.a.winning)&&['n','y'].includes(n.a.isJackpot)&&POLICY.orbAwardAmountPatterns.some(t=>same(t,[award,amount])),'JINSEDRAGON_ORBS_NOT_REVIEWED');if(n.a.winning==='y'){orbWin+=amount;uint(orbWin);}}
   const stops=one(spin,'ReelStops'),stopText=stops.children.map(n=>n.text??'').join('');need(!children(stops).length&&stopText.split('|').length===5,'JINSEDRAGON_REEL_STATE_MISMATCH');stopText.split('|').forEach(uint);
   let sum=0;
   for(const [index,p]of ps.entries()){
    const award=uint(p.a.awardIndex),ways=uint(p.a.ways),v=uint(p.a.winVal),text=p.children.map(n=>n.text??'').join('');
    need(same(p.a,{winIndex:String(index),winVal:String(v),ways:String(ways),awardIndex:String(award)})&&POLICY.awardWaysWinPatterns.some(t=>same(t,[award,ways,v]))&&!children(p).length&&POLICY.positionPatterns.includes(text),'JINSEDRAGON_ANYWAY_NOT_REVIEWED');
    const xs=text.split('|').map(uint);need(POLICY.positionLengths.includes(xs.length)&&new Set(xs).size===xs.length&&xs.every(x=>x<40),'JINSEDRAGON_ANYWAY_POSITIONS_NOT_REVIEWED');sum+=v;uint(sum);
   }
   need(sum===spinWin&&spinWin+orbWin===win,'JINSEDRAGON_REEL_WIN_MISMATCH');balance=start-100+win;uint(balance);next='EndGame';
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
