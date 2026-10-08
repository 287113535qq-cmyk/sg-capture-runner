import {ownWmsInit} from './sg-own-wms-init.mjs';
import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-giantsgold-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='af9c7a53979982876cdb28c145eaf178cb27e7ef796542520a5dede77ff6a62f','GIANTSGOLD_POLICY_REQUIRED');
const awards=POLICY.perSpinAwardPatterns.map(xs=>new Set(xs.map(stable))),positions=POLICY.perSpinPositionPatterns.map(xs=>new Set(xs)),jointPatterns=new Set(POLICY.clumpWildJointPatterns.map(stable));

export const SOURCE='giantsgold-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'giantsgold_prt',gameID:'20129',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults BGInfo'],ReelResults:['numSpins','ClumpPlaceholderInfo PsudoSuperWildStack ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],BGInfo:['totalWagerWin bgWinnings baseGameSpinsRemaining isMaxWin',''],ClumpPlaceholderInfo:['bigSymbolIdEven bigSymbolIdOdd smallSymbolIdEven smallSymbolIdOdd',''],PsudoSuperWildStack:['reelsToTurnWild','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'GIANTSGOLD_FEATURE_NOT_ADAPTED');
 need(!n.children.map(c=>c.text??'').join('').trim()||['CurrencyMultiplier','ReelStops','PaylineWin','Stakes'].includes(n.tag),'GIANTSGOLD_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1&&a.children.every(c=>!c.text?.trim())
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','GIANTSGOLD_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'GIANTSGOLD_REQUEST_MISMATCH');
 const requestText=n=>{need(!n.children.map(c=>c.text??'').join('').trim()||n.tag==='CurrencyMultiplier','GIANTSGOLD_REQUEST_MODE');children(n).forEach(requestText);};requestText(q);
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'GIANTSGOLD_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','Stake','AccountData']),'GIANTSGOLD_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'50',paylineCount:'20'})&&!children(stake).length,'GIANTSGOLD_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'GIANTSGOLD_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20129'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'GIANTSGOLD_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 if(ownWmsInit(r.root,32770,50)){need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};}
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(50)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'GIANTSGOLD_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','GIANTSGOLD_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'GIANTSGOLD_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','AccountData','Balances'])&&one(r.root,'AccountData').children.length===0&&!children(r.root).some(n=>n.tag==='GameResult'),'GIANTSGOLD_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'GIANTSGOLD_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'GIANTSGOLD_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['ReelResults','BGInfo']),'GIANTSGOLD_FEATURE_NOT_ADAPTED');win=uint(g.a.totalWin);
   need(same(g.a,{stake:'50',stakePerLine:'2',paylineCount:'20',totalWin:String(win),betID:''}),'GIANTSGOLD_WAGER_MISMATCH');
   const bg=one(g,'BGInfo');need(same(bg.a,{totalWagerWin:String(win),bgWinnings:String(win),baseGameSpinsRemaining:'0',isMaxWin:'0'}),'GIANTSGOLD_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults');need(same(reels.a,{numSpins:'2'})&&same(tags(reels),['ClumpPlaceholderInfo','PsudoSuperWildStack','ReelSpin','ReelSpin']),'GIANTSGOLD_REEL_STATE_MISMATCH');
   const clump=one(reels,'ClumpPlaceholderInfo'),wild=one(reels,'PsudoSuperWildStack');
   need(!children(clump).length&&!children(wild).length&&jointPatterns.has(stable({clump:clump.a,wild:wild.a})),'GIANTSGOLD_CLUMP_WILD_NOT_REVIEWED');
   const spins=children(reels).filter(n=>n.tag==='ReelSpin');let total=0,count=0;
   for(const [si,spin]of spins.entries()){
    const ps=children(spin).filter(n=>n.tag==='PaylineWin'),spinWin=uint(spin.a.spinWins);count+=ps.length;
    need(ps.length<=POLICY.maxPaylinesPerSpin[si]&&same(spin.a,{spinIndex:String(si),reelsetIndex:String(si),winCountPL:String(ps.length),winCountSC:'0',spinWins:String(spinWin),freeSpin:'N',bonusAwarded:'N'})
     &&same(tags(spin),['ReelStops',...ps.map(()=> 'PaylineWin')]),'GIANTSGOLD_FEATURE_NOT_ADAPTED');
    const stops=one(spin,'ReelStops'),stopText=stops.children.map(n=>n.text??'').join('');need(!children(stops).length&&stopText.split('|').length===5,'GIANTSGOLD_REEL_STATE_MISMATCH');stopText.split('|').forEach(uint);
    let sum=0;const lines=new Set();
    for(const p of ps){
     const line=uint(p.a.index),award=uint(p.a.awardIndex),table=uint(p.a.awardTableIndex),v=uint(p.a.winVal),text=p.children.map(n=>n.text??'').join('');
     need(line<20&&!lines.has(line)&&same(p.a,{index:String(line),winVal:String(v),awardIndex:String(award),awardTableIndex:String(table)})
      &&awards[si].has(stable([award,table,v]))&&!children(p).length&&positions[si].has(text),'GIANTSGOLD_PAYLINE_NOT_REVIEWED');
     const xs=text.split('|').map(uint);need(xs.length===5&&new Set(xs).size===5&&xs.every(x=>x<60),'GIANTSGOLD_PAYLINE_POSITIONS_NOT_REVIEWED');lines.add(line);sum+=v;uint(sum);
    }
    need(sum===spinWin,'GIANTSGOLD_REEL_WIN_MISMATCH');total+=sum;uint(total);
   }
   // Both own ordinary spins contribute once. Clump/wild metadata adds no award.
   need(count<=POLICY.maxPaylinesPerLogic&&total===win,'GIANTSGOLD_REEL_WIN_MISMATCH');balance=start-50+win;uint(balance);next='EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature:false};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===50,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:0.5,mul:s.win/50,buy:0,bonus:0,
  primaryBonusKind:'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:50}};
}
