import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
export const SOURCE='blazingxasia-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'blazingxasia',gameID:'20363',
 glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake stakePerLine paylineCount totalWin betID','ReelResults XInfo BGInfo FSInfo BaseGameRecoveryInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['spinIndex reelsetIndex winCountPL winCountSC spinWins freeSpin bonusAwarded','ReelStops PaylineWin ScatterWin'],
 ReelStops:['',''],PaylineWin:['index winVal awardIndex awardTableIndex',''],ScatterWin:['awardIndex winVal',''],
 XInfo:['currentX previousX currSpinToReset prevSpinToReset',''],BGInfo:['totalWagerWin bgWinnings isMaxWin',''],
 FSInfo:['scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin currFSX prevFSX',''],BaseGameRecoveryInfo:['','ReelResults']};
function shape(n,schema=SCHEMA){const s=schema[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'BLAZING_FEATURE_NOT_ADAPTED');children(n).forEach(c=>shape(c,schema));}
function currency(q){const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&tags(a).length===1
 &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','BLAZING_REQUEST_MODE');}
export function request(text,msg,first=false){
 const q=parseXml(text);need(q.tag==='GameRequest'&&same(q.a,{type:msg}),'BLAZING_REQUEST_MISMATCH');
 const h=one(q,'Header');need(!children(h).length&&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'BLAZING_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','Stake','PaylineCount','AccountData']),'BLAZING_REQUEST_MISMATCH');
  const stake=one(q,'Stake');need(same(stake.a,{total:'240'})&&!children(stake).length&&same(one(q,'PaylineCount').a,{count:'40'})&&!children(one(q,'PaylineCount')).length,'BLAZING_REQUEST_MODE');currency(q);
 }else need(['Init','Logic','EndGame'].includes(msg)&&same(tags(q),['Header']),'BLAZING_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a;
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20363'&&h.versionID==='1_0'&&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 const b=one(root,'Balances');need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){
 need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session,'BLAZING_REQUEST_MISMATCH');
 need(same(parseXml(step.responsePayload),parseXml(step.responseXml))&&!step.sourceRejected&&uint(step.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init');
 const initSchema={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo Stakes PageInfo'],
  GameInfo:['RTP','Stakes PageInfo'],Stakes:['count defaultIndex type',''],PageInfo:['pageCount','']};
 shape(r.root,initSchema);
 const nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(240)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'BLAZING_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
const X_TRANSITIONS=[["1", "1", "0", "0"], ["1", "2", "0", "3"], ["2", "2", "3", "2"], ["2", "2", "2", "1"], ["2", "3", "1", "3"], ["3", "3", "3", "2"], ["3", "3", "2", "1"], ["3", "3", "1", "0"], ["2", "3", "3", "3"], ["2", "2", "1", "0"], ["2", "2", "1", "1"], ["2", "3", "2", "3"], ["3", "5", "2", "3"], ["5", "5", "3", "2"], ["5", "5", "2", "1"], ["5", "5", "1", "0"], ["5", "10", "3", "3"], ["10", "10", "3", "2"], ["10", "25", "2", "3"], ["25", "25", "3", "2"], ["25", "25", "2", "3"], ["25", "25", "2", "1"], ["25", "25", "1", "0"], ["10", "10", "2", "1"], ["10", "10", "1", "0"], ["3", "5", "3", "3"], ["10", "25", "1", "3"], ["3", "5", "1", "3"], ["5", "10", "2", "3"], ["5", "10", "1", "3"], ["25", "25", "1", "3"]];
const FS_TRANSITIONS=[["2", "3"], ["3", "3"], ["3", "5"], ["5", "5"], ["1", "1"], ["1", "2"], ["2", "2"], ["5", "10"], ["10", "10"]];
const xTuple=n=>['previousX','currentX','prevSpinToReset','currSpinToReset'].map(k=>n.a[k]);
function exact(n,attrs){need(same(Object.keys(n.a).sort(),attrs.split(' ').sort()),'BLAZING_FEATURE_NOT_ADAPTED');}
export function review(raw){
 need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false&&raw.roundFieldsVersion==='sg-round-fields-v1','BLAZING_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=12,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,baseWin=0,feature=false,scatter=0,freeX=null,paidReels=null,paidX=null,session=null,next='Logic';
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i];need(next!==null&&s.msgId===next,'BLAZING_SEQUENCE_MISMATCH');
  const prior=request(s.requestPayload,next,i===0);need(session===null||prior===session,'WMS_SESSION_CHAIN_MISMATCH');
  need(same(parseXml(s.responsePayload),parseXml(s.responseXml))&&!s.sourceRejected&&uint(s.elapsedMs)<=300000,'WMS_XML_EVIDENCE_MISMATCH');
  const r=response(s.responsePayload,next);shape(r.root);session=r.session;const ready=one(r.root,'Header').a.readyForEndGame;
  if(next==='EndGame'){
   need(i===(feature?11:1)&&ready==='N'&&!children(r.root).some(n=>n.tag==='GameResult'),'BLAZING_ENDGAME_MISMATCH');next=null;
  }else{
   need(i===0||feature&&i<=10,'BLAZING_SEQUENCE_MISMATCH');const g=one(r.root,'GameResult');
   exact(g,'stake stakePerLine paylineCount totalWin betID');
   need(g.a.stake==='240'&&g.a.stakePerLine==='20'&&g.a.paylineCount==='40'&&g.a.betID==='','BLAZING_WAGER_MISMATCH');
   const award=uint(g.a.totalWin),bg=one(g,'BGInfo'),reels=one(g,'ReelResults'),spin=one(reels,'ReelSpin'),x=one(g,'XInfo');
   exact(x,'currentX previousX currSpinToReset prevSpinToReset');exact(bg,'totalWagerWin bgWinnings isMaxWin');
   need(bg.a.isMaxWin==='0'&&reels.a.numSpins==='1'&&children(reels).length===1,'BLAZING_REEL_STATE_MISMATCH');
   const stops=one(spin,'ReelStops'),values=stops.children.map(n=>n.text??'').join('').split('|');need(values.length===5,'BLAZING_REEL_STATE_MISMATCH');values.forEach(uint);
   need(spin.a.spinIndex==='0'&&spin.a.reelsetIndex===(i===0?'0':'1')&&spin.a.freeSpin===(i===0?'N':'Y'),'BLAZING_REEL_STATE_MISMATCH');
   const pays=children(spin).filter(n=>n.tag==='PaylineWin'),sc=children(spin).filter(n=>n.tag==='ScatterWin'),indices=new Set();let sum=0;
   need(uint(spin.a.winCountPL)===pays.length&&pays.length<=40&&uint(spin.a.winCountSC)===sc.length,'BLAZING_REEL_WIN_MISMATCH');
   for(const p of pays){exact(p,'index winVal awardIndex awardTableIndex');const index=uint(p.a.index);
    need(index<40&&!indices.has(index)&&p.a.awardTableIndex==='0'&&uint(p.a.awardIndex)<=24,'BLAZING_PAYLINE_NOT_REVIEWED');indices.add(index);sum+=uint(p.a.winVal);uint(sum);}
   need(sum===uint(spin.a.spinWins),'BLAZING_REEL_WIN_MISMATCH');
   const fs=children(g).filter(n=>n.tag==='FSInfo'),recovery=children(g).filter(n=>n.tag==='BaseGameRecoveryInfo');
   if(i===0){
    need(X_TRANSITIONS.some(t=>same(t,xTuple(x)))&&recovery.length===0,'BLAZING_X_STATE_NOT_REVIEWED');baseWin=award;paidReels=reels;paidX=x;
    feature=fs.length===1;
    if(feature){const f=fs[0];exact(f,'scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin');scatter=uint(f.a.scatterPayout);
     need([480,960].includes(scatter)&&same(tags(g),['ReelResults','XInfo','BGInfo','FSInfo'])&&[ ['2','2','1','1'],['1','1','0','0'],['2','2','2','1'] ].some(t=>same(t,xTuple(x)))
      &&sc.length===1&&same(sc[0].a,{awardIndex:'0',winVal:'0'})&&pays.length===0&&sum===0&&award===scatter
      &&spin.a.bonusAwarded==='Y'&&f.a.freeSpinsTotal==='10'&&f.a.freeSpinNumber==='0'&&f.a.fsWinnings==='0'&&f.a.isMaxWin==='0'&&ready==='N','BLAZING_UNREVIEWED_FREE');
     freeX=x.a.currentX;next='Logic';
    }else{need(fs.length===0&&same(tags(g),['ReelResults','XInfo','BGInfo'])&&sc.length===0&&spin.a.bonusAwarded==='N'&&sum===award&&ready==='Y','BLAZING_FEATURE_NOT_ADAPTED');next='EndGame';}
   }else{
    need(fs.length===1&&recovery.length===1&&same(tags(g),['ReelResults','BaseGameRecoveryInfo','XInfo','BGInfo','FSInfo'])&&children(recovery[0]).length===1
     &&same(one(recovery[0],'ReelResults'),paidReels)&&spin.a.bonusAwarded==='N'&&sc.length===0&&sum===award,'BLAZING_FREE_REEL_MISMATCH');
    const f=fs[0];exact(f,'scatterPayout fsWinnings freeSpinsTotal freeSpinNumber isMaxWin currFSX prevFSX');
    need(f.a.freeSpinsTotal==='10'&&uint(f.a.freeSpinNumber)===i&&f.a.isMaxWin==='0'&&uint(f.a.scatterPayout)===scatter
     &&f.a.prevFSX===freeX&&FS_TRANSITIONS.some(t=>same(t,[f.a.prevFSX,f.a.currFSX]))&&uint(f.a.fsWinnings)===win+award-baseWin,'BLAZING_FREE_COUNTER_MISMATCH');
    need(same(x,paidX)||(i===10&&same(xTuple(paidX),['2','2','1','1'])&&same(xTuple(x),['2','1','1','0'])),'BLAZING_X_STATE_NOT_REVIEWED');
    need(ready===(i===10?'Y':'N'),'BLAZING_FREE_COUNTER_MISMATCH');freeX=f.a.currFSX;next=i===10?'EndGame':'Logic';
   }
   win+=award;uint(win);need(uint(bg.a.totalWagerWin)===win&&uint(bg.a.bgWinnings)===baseWin,'BLAZING_CUMULATIVE_WIN_MISMATCH');
   balance=start-240+win;uint(balance);
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,start,balance,win,feature};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===240,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');
 return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,bet:2.4,mul:s.win/240,buy:0,bonus:s.feature?1:0,
  primaryBonusKind:s.feature?'free':'none',typeMappingHash:mappingHash,money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:240}};
}
