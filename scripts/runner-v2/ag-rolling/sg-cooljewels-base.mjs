import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const POLICY=JSON.parse(readFileSync(new URL('../../../config/ag-rolling-cooljewels-base-contract.json',import.meta.url)));
need(createHash('sha256').update(stable(POLICY)).digest('hex')==='701a7cd045cce2959ce8ae748f056a97142b1eb673367e22b17f389f9254ad5a','COOLJEWELS_POLICY_REQUIRED');
const awards=new Set(POLICY.awardPatterns.map(stable)),positions=new Set(POLICY.positionPatterns),rootPositions=new Set(POLICY.rootPositionPatterns.map(stable));
export const SOURCE='cooljewels-base-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'cooljewels_prt',gameID:'20150',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults ReactorChain MaxWin_Info'],ReelResults:['numSpins','ReelSpin'],
 ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops'],ReelStops:['',''],
 ReactorChain:['num_drops','ReactorDrop'],ReactorDrop:['drop_order num_clusters','ReactorLayout ReactorCluster'],
 ReactorLayout:['symbols',''],ReactorCluster:['id cluster_positions cluster_awards rootSymbol rootSymbolPos watermark',''],MaxWin_Info:['maxWinValue maxWin cappedWins','']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'COOLJEWELS_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','COOLJEWELS_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'COOLJEWELS_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'COOLJEWELS_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','AccountData','Stake']),'COOLJEWELS_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{multiplier:'1',total:'50'})&&!children(stake).length,'COOLJEWELS_REQUEST_MODE');currency(q);
 }else need(['Init','EndGame'].includes(msg)&&same(tags(q),['Header']),'COOLJEWELS_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20150'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'COOLJEWELS_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(50)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'COOLJEWELS_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','COOLJEWELS_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=2,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'COOLJEWELS_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;
  if(next==='EndGame'){
   need(i===1&&same(tags(r.root),['Header','Balances'])&&!children(r.root).some(n=>n.tag==='GameResult'),'COOLJEWELS_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0&&same(tags(r.root),['Header','AccountData','Balances','GameResult']),'COOLJEWELS_SEQUENCE_MISMATCH');
   const account=one(r.root,'AccountData');need(same(tags(account),['AccountData']),'COOLJEWELS_RESPONSE_CURRENCY');currency(account);
   const g=one(r.root,'GameResult');need(same(tags(g),['ReelResults','ReactorChain','MaxWin_Info']),'COOLJEWELS_FEATURE_NOT_ADAPTED');
   need(g.a.stake==='50'&&g.a.stakePerLine==='0'&&g.a.paylineCount==='0'&&g.a.betID==='','COOLJEWELS_WAGER_MISMATCH');win=uint(g.a.totalWin);
   const cap=one(g,'MaxWin_Info');need(same(cap.a,{maxWinValue:'25000000',maxWin:'false',cappedWins:'0'})&&!children(cap).length,'COOLJEWELS_MAXWIN_NOT_ADAPTED');
   const reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin');need(same(reels.a,{numSpins:'1'})&&same(tags(reels),['ReelSpin']),'COOLJEWELS_REEL_STATE_MISMATCH');
   need(same(spin.a,{spinIndex:'0',reelsetIndex:'0',winCountPL:'0',winCountSC:'0',spinWins:'0',freeSpin:'N',bonusAwarded:'N'})&&same(tags(spin),['ReelStops']),'COOLJEWELS_FEATURE_NOT_ADAPTED');
   const stops=one(spin,'ReelStops');need(!children(stops).length&&stops.children.map(n=>n.text??'').join('').split('|').length===6,'COOLJEWELS_REEL_STATE_MISMATCH');stops.children.map(n=>n.text??'').join('').split('|').forEach(uint);
   const chain=one(g,'ReactorChain'),drops=children(chain);need(drops.length>=1&&drops.length<=6&&same(chain.a,{num_drops:String(drops.length)}),'COOLJEWELS_REACTOR_COUNTER');let sum=0;
   for(const [di,drop]of drops.entries()){
    const cs=children(drop).filter(n=>n.tag==='ReactorCluster');need(drop.tag==='ReactorDrop'&&same(drop.a,{drop_order:String(di),num_clusters:String(cs.length)})&&cs.length<=7
     &&same(tags(drop),['ReactorLayout',...cs.map(()=> 'ReactorCluster')])&&(di===drops.length-1?cs.length===0:cs.length>0),'COOLJEWELS_REACTOR_COUNTER');
    const layout=one(drop,'ReactorLayout'),sy=layout.a.symbols?.split('|');need(sy?.length===36&&!children(layout).length&&sy.every(x=>POLICY.layoutSymbols.includes(x)),'COOLJEWELS_LAYOUT_NOT_REVIEWED');
    for(const [ci,c]of cs.entries()){
     const ps=c.a.cluster_positions?.split('|'),av=c.a.cluster_awards?.split('|');need(c.a.id===String(ci)&&!children(c).length&&positions.has(c.a.cluster_positions)
      &&ps.length===new Set(ps).size&&av.length===ps.length&&POLICY.awardLengths.includes(ps.length)
      &&ps.every(x=>/^[0-5],[0-5]$/.test(x))&&rootPositions.has(stable([c.a.rootSymbol,c.a.rootSymbolPos]))
      &&awards.has(stable([di,c.a.rootSymbol,c.a.watermark,c.a.cluster_awards])),'COOLJEWELS_CLUSTER_NOT_REVIEWED');
     // Awards already contain the per-position contribution. Add each once;
     // root symbols and watermarks do not authorize a second multiplier.
     for(const v of av){sum+=uint(v);uint(sum);}
    }
   }
   need(sum===win,'COOLJEWELS_REACTOR_WIN_MISMATCH');balance=start-50+win;uint(balance);next='EndGame';
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
