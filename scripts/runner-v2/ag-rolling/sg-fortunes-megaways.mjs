import {parseXml,one,children,need,uint} from '../../trial/pearl-protocol.mjs';
import {stable} from '../mongo-writer.mjs';
export const SOURCE='eightyeightfortunesmegaways-ag-rolling-wms-v1';
export const HEADER={affiliate:'0',ccyCode:'',channel:'I',freePlay:'Y',gameCodeRGI:'eightyeightfortunesmegaways',
 gameID:'20371',glsID:'65535',lang:'en_US',promotions:'N',userID:'null',userType:'C',versionID:'1_0'};
const same=(a,b)=>stable(a)===stable(b),tags=n=>children(n).map(c=>c.tag);
const SCHEMA={GameResponse:['type','Header AccountData Balances GameResult'],
 Header:['sessionID ccyCode deciSep thousandSep lang gameID versionID fullVersionID isRecovering readyForEndGame',''],
 AccountData:['','AccountData CurrencyMultiplier'],CurrencyMultiplier:['',''],Balances:['','Balance'],Balance:['name value',''],
 GameResult:['stake totalWin betID','ReelResults BGInfo FSInfo BaseGameRecoveryInfo PickerInfo CascadeInfo TopReelInfo'],
 ReelResults:['numSpins','ReelSpin'],ReelSpin:['anywayWins bonusAwarded freeSpin reelsetIndex scatterWinCount spinIndex totalSpinWin','AnywayWin ReelStops ScatterWin'],
 AnywayWin:['awardIndex ways winIndex winVal',''],ReelStops:['',''],ScatterWin:['awardIndex winVal',''],
 BGInfo:['bgWinnings gameMode isMaxWin reelHeights totalWagerWin',''],
 FSInfo:['extraSpinsAwarded freeSpinNumber freeSpinsTotal fsWinnings isMaxWin reelHeights startCasMult',''],
 BaseGameRecoveryInfo:['','ReelResults TopReelInfo'],PickerInfo:['pickerIndex',''],
 CascadeInfo:['curCascadeMult prevCascadeMult',''],TopReelInfo:['positions reelSetIndex reelStop','']};
function shape(n){const s=SCHEMA[n.tag];need(s&&Object.keys(n.a).every(k=>s[0].split(' ').includes(k))
 &&tags(n).every(k=>s[1].split(' ').includes(k)),'WMS_FEATURE_NOT_ADAPTED');children(n).forEach(shape);}
function heights(value){const h=value?.split('|');need(h?.length===6&&h.every(v=>uint(v)>=2&&uint(v)<=7),'WMS_REEL_STATE_MISMATCH');}
export function request(text,msg,first=false){const q=parseXml(text),h=one(q,'Header');
 need(q.tag==='GameRequest'&&same(q.a,{type:msg})&&!children(h).length
  &&same(Object.fromEntries(Object.entries(h.a).filter(([k])=>k!=='sessionID')),HEADER),'WMS_REQUEST_MODE');
 need(typeof h.a.sessionID==='string'&&h.a.sessionID.length>0&&h.a.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 if(first){need(msg==='Logic'&&same(tags(q),['Header','Stake','PaylineCount','AccountData'])
   &&same(one(q,'Stake').a,{total:'16',gameMode:'0'})&&!children(one(q,'Stake')).length
   &&same(one(q,'PaylineCount').a,{count:'1'})&&!children(one(q,'PaylineCount')).length,'WMS_WAGER_MISMATCH');
  const a=one(q,'AccountData'),c=one(a,'CurrencyMultiplier');need(!Object.keys(a.a).length&&children(a).length===1
   &&!Object.keys(c.a).length&&!children(c).length&&c.children.map(n=>n.text??'').join('')==='1','WMS_REQUEST_MODE');
 }else need(['Init','Logic','EndGame'].includes(msg)&&same(tags(q),['Header']),'WMS_REQUEST_MISMATCH');
 return h.a.sessionID;
}
export function response(text,msg){const root=parseXml(text),h=one(root,'Header').a,b=one(root,'Balances');
 need(root.tag==='GameResponse'&&same(root.a,{type:msg})&&h.gameID==='20371'&&h.versionID==='1_0'
  &&h.isRecovering==='N','WMS_RESPONSE_IDENTITY_MISMATCH');
 need(typeof h.sessionID==='string'&&h.sessionID.length>0&&h.sessionID.length<=1024,'WMS_SESSION_REQUIRED');
 need(children(b).length===1&&one(b,'Balance').a.name==='CASH_BALANCE','WMS_BALANCE_MISMATCH');
 return {root,session:h.sessionID,balance:uint(one(b,'Balance').a.value)};
}
export function bootstrap(step,session){need(step.msgId==='Init'&&request(step.requestPayload,'Init')===session
 &&same(parseXml(step.responsePayload),parseXml(step.responseXml))&&uint(step.elapsedMs)<=300000&&!step.sourceRejected,'WMS_XML_EVIDENCE_MISMATCH');
 const r=response(step.responsePayload,'Init'),nodes=[];const walk=n=>{nodes.push(n);children(n).forEach(walk);};walk(r.root);
 const init={...SCHEMA,GameResponse:['type','Header AccountData Balances GameInfo'],GameInfo:['','Stakes PageInfo'],Stakes:['',''],PageInfo:['pageCount','']};
 need(nodes.every(n=>init[n.tag]&&Object.keys(n.a).every(k=>init[n.tag][0].split(' ').includes(k))
  &&tags(n).every(k=>init[n.tag][1].split(' ').includes(k))),'WMS_INIT_REQUIRES_REVIEW');
 const stakes=nodes.filter(n=>n.tag==='Stakes'),pages=nodes.filter(n=>n.tag==='PageInfo');
 need(one(r.root,'Header').a.readyForEndGame==='N'&&!nodes.some(n=>['GameResult','BaseGameRecoveryInfo','Feature'].includes(n.tag))
  &&stakes.length===1&&stakes[0].children.map(n=>n.text??'').join('').split('|').filter(Boolean).map(uint).includes(16)
  &&pages.length<=1&&(!pages.length||uint(pages[0].a.pageCount)<=1),'WMS_INIT_REQUIRES_REVIEW');
 need(uint(step.responseBalance)===r.balance,'WMS_BALANCE_MISMATCH');return {validated:true,session:r.session,balanceRaw:r.balance};
}
export function review(raw){need(raw?.sourceKey===SOURCE&&raw.protocol==='wms'&&raw.fixtureOnly===false
 &&raw.roundFieldsVersion==='sg-round-fields-v1','WMS_PROFILE_REQUIRED');
 need(Array.isArray(raw.steps)&&raw.steps.length<=14,'INVALID_ROUND_STEPS');
 const start=uint(raw.startBalanceRaw);let balance=start,win=0,base=0,session=null,next='Logic',feature=false,total=0,number=0,mult=0,recovery=null;
 for(let i=0;i<raw.steps.length;i++){const s=raw.steps[i];need(next!==null&&s.msgId===next,'WMS_SEQUENCE_MISMATCH');
  const qs=request(s.requestPayload,next,i===0);need(session===null||session===qs,'WMS_SESSION_CHAIN_MISMATCH');
  const r=response(s.responsePayload,next);need(same(r.root,parseXml(s.responseXml)),'WMS_XML_EVIDENCE_MISMATCH');shape(r.root);session=r.session;
  need(uint(s.elapsedMs)<=300000&&!s.sourceRejected,'INVALID_TRIAL_TIMING');const h=one(r.root,'Header').a;
  if(next==='EndGame'){need(i===raw.steps.length-1&&same(tags(r.root),['Header','AccountData','Balances'])
    &&h.readyForEndGame==='N','WMS_ENDGAME_MISMATCH');next=null;
  }else{const g=one(r.root,'GameResult'),bg=one(g,'BGInfo').a,award=uint(g.a.totalWin);
   need(g.a.stake==='16'&&bg.gameMode==='0'&&bg.isMaxWin==='0','WMS_WAGER_MISMATCH');heights(bg.reelHeights);
   if(i===0){balance-=16;base=award;feature=children(g).some(n=>n.tag==='FSInfo');}
   win+=award;balance+=award;uint(win);uint(balance);
   need(uint(bg.totalWagerWin)===win&&uint(bg.bgWinnings)===base,'WMS_CUMULATIVE_WIN_MISMATCH');
   const reels=one(g,'ReelResults'),spins=children(reels);need(spins.length>=1&&spins.length<=5
    &&uint(reels.a.numSpins)===spins.length&&spins.every((n,j)=>n.tag==='ReelSpin'&&uint(n.a.spinIndex)===j
     &&n.a.freeSpin===(i?'Y':'N')&&n.a.bonusAwarded===(feature&&i===0?'Y':'N')),'WMS_REEL_STATE_MISMATCH');
   need(spins.reduce((a,n)=>a+uint(n.a.totalSpinWin),0)===award,'WMS_REEL_WIN_MISMATCH');
   for(const n of spins){need(uint(n.a.anywayWins)===children(n).filter(c=>c.tag==='AnywayWin').length
     &&uint(n.a.scatterWinCount)===children(n).filter(c=>c.tag==='ScatterWin').length,'WMS_REEL_WIN_MISMATCH');
    need(children(n).filter(c=>['AnywayWin','ScatterWin'].includes(c.tag)).reduce((a,c)=>a+uint(c.a.winVal),0)===uint(n.a.totalSpinWin),'WMS_REEL_WIN_MISMATCH');}
   const top=one(g,'TopReelInfo');need(top.a.positions==='37|38|39|40'&&top.a.reelSetIndex===(i?'40':'35'),'WMS_REEL_STATE_MISMATCH');uint(top.a.reelStop);
   if(i===0){recovery=[reels,top];
    if(feature){const f=one(g,'FSInfo').a,p=one(g,'PickerInfo').a;
     need(same(Object.keys(f).sort(),['freeSpinNumber','freeSpinsTotal','fsWinnings','isMaxWin','startCasMult'])
      &&f.freeSpinNumber==='0'&&f.fsWinnings==='0'&&f.isMaxWin==='0'
      &&((p.pickerIndex==='0'&&f.freeSpinsTotal==='10'&&f.startCasMult==='6')
       ||(p.pickerIndex==='1'&&f.freeSpinsTotal==='12'&&f.startCasMult==='4')),'WMS_FREE_COUNTER_MISMATCH');
     total=uint(f.freeSpinsTotal);mult=uint(f.startCasMult);
    }else need(!children(g).some(n=>['FSInfo','PickerInfo','CascadeInfo','BaseGameRecoveryInfo'].includes(n.tag)),'WMS_FEATURE_NOT_ADAPTED');
   }else{need(feature&&!children(g).some(n=>n.tag==='PickerInfo'),'WMS_SEQUENCE_MISMATCH');const f=one(g,'FSInfo').a,c=one(g,'CascadeInfo').a;
    number++;need(same(Object.keys(f).sort(),['extraSpinsAwarded','freeSpinNumber','freeSpinsTotal','fsWinnings','reelHeights'])
     &&uint(f.freeSpinsTotal)===total&&uint(f.freeSpinNumber)===number&&number<=total&&f.extraSpinsAwarded==='0','WMS_FREE_COUNTER_MISMATCH');
    heights(f.reelHeights);need(uint(f.fsWinnings)===win-base,'WMS_CUMULATIVE_WIN_MISMATCH');
    need(uint(c.prevCascadeMult)===mult&&uint(c.curCascadeMult)===mult+spins.length-1,'WMS_CASCADE_COUNTER_MISMATCH');mult=uint(c.curCascadeMult);
    need(same(children(one(g,'BaseGameRecoveryInfo')),recovery),'WMS_RECOVERY_EVIDENCE_MISMATCH');
   }
   const pending=feature&&number<total;need(h.readyForEndGame===(pending?'N':'Y'),'WMS_SETTLEMENT_FLAG_MISMATCH');next=pending?'Logic':'EndGame';
  }
  need(r.balance===balance&&uint(s.responseBalance)===balance,'WMS_BALANCE_MISMATCH');
 }
 return {next,session,feature,start,balance,win};
}
export function settled(raw,mappingHash){const s=review(raw);need(s.next===null&&s.start-s.balance+s.win===16,'INCOMPLETE_ROUND');
 need(/^[a-f0-9]{64}$/.test(mappingHash??''),'WMS_MAPPING_REQUIRED');return {roundFieldsVersion:'sg-round-fields-v1',protocol:'wms',sourceKey:SOURCE,
  bet:0.16,mul:s.win/16,buy:0,bonus:Number(s.feature),primaryBonusKind:s.feature?'freeGame':'none',typeMappingHash:mappingHash,
  money:{startBalanceRaw:s.start,endBalanceRaw:s.balance,totalWinRaw:s.win,betRaw:16}};
}
