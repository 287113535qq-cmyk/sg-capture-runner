// Own-client control review only. This module cannot settle or authorize capture.
import {parseXml, one, children, uint, need} from '../pearl-protocol.mjs';
const equal=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const check=(v,c)=>need(v,'CRYSTAL_ROUTE_'+c);
const exact=(n,keys)=>check(equal(Object.keys(n.a),keys.split(' '))&&!children(n).length,'CONTROL_SHAPE');
export function inspectControl({gameId,xml,previous=null}) {
 check(gameId===32759,'OWN_GAME');
 const root=parseXml(xml),h=one(root,'Header');
 check(root.tag==='GameResponse'&&root.a.type==='Logic'&&Object.keys(root.a).length===1,'MESSAGE');
 check(h.a.gameID==='20142'&&h.a.versionID==='1_0'&&h.a.isRecovering==='N','IDENTITY');
 const g=one(root,'GameResult'),bg=one(g,'BGInfo'),rs=one(g,'ReelResults'),spin=one(rs,'ReelSpin');
 check(g.a.stake==='25'&&g.a.stakePerLine==='1'&&g.a.paylineCount==='25','STAKE');
 check(rs.a.numSpins==='1'&&children(rs).length===1&&spin.a.spinIndex==='0','SPIN');
 check(['N','Y'].includes(spin.a.freeSpin)&&['N','Y'].includes(spin.a.bonusAwarded),'SPIN_FLAG');
 exact(bg,'totalWagerWin bgWinnings baseGameSpinsRemaining isBigBet isMaxWin');
 check(bg.a.baseGameSpinsRemaining==='0'&&bg.a.isBigBet==='0','UNREVIEWED_MODE');
 check(bg.a.isMaxWin==='0','MAXWIN_REQUIRES_OWN_TERMINAL');
 const fs=children(g).filter(n=>n.tag==='FSInfo');check(fs.length<=1,'AMBIGUOUS_FREE');
 const base={schema:'sg-crystal-own-control-review-v1',captureAuthorized:false,businessComplete:false,moneyValidated:false};
 if(!fs.length){
  check(previous===null&&spin.a.freeSpin==='N'&&spin.a.bonusAwarded==='N','MISSING_FREE_COUNTER');
  return {...base,feature:false,next:'EndGame',total:0,played:0,remaining:0,awarded:0};
 }
 exact(fs[0],'fsWinnings freeSpinsTotal freeSpinNumber isMaxWin freeSpinsAwarded');
 const f=fs[0].a;
 check(f.isMaxWin==='0','MAXWIN_REQUIRES_OWN_TERMINAL');
 const total=uint(f.freeSpinsTotal),played=uint(f.freeSpinNumber),awarded=uint(f.freeSpinsAwarded);
 // 100 is an explicit bounded-review budget, not a claimed game maximum.
 check(total>0&&total<=100&&played<=total&&awarded<=total,'COUNTER');uint(f.fsWinnings);
 if(previous===null){
  check(played===0&&spin.a.freeSpin==='N'&&f.fsWinnings==='0','FIRST_TRIGGER');
 }else{
  check(previous.schema===base.schema&&previous.feature===true&&previous.next==='Logic','AFTER_TERMINAL');
  check(Number.isSafeInteger(previous.total)&&Number.isSafeInteger(previous.played)&&previous.played<previous.total,'PRIOR_COUNTER');
  check(played===previous.played+1&&total===previous.total+awarded&&spin.a.freeSpin==='Y','COUNTER_TRANSITION');
 }
 return {...base,feature:true,next:played===total?'EndGame':'Logic',total,played,remaining:total-played,awarded};
}
