// Bounded MegaHat branch. Third-frame terminal is synthetic, not observed; separate admission is required.
const check=(ok,code)=>{if(!ok)throw Error(code);};
const uint=x=>{check((typeof x==='string'&&/^\d+$/.test(x))||Number.isSafeInteger(x),'MEGAHAT_NUMBER');const n=Number(x);check(Number.isSafeInteger(n)&&n>=0,'MEGAHAT_NUMBER');return n;};
function pairs(s,sep='&',del='='){check(typeof s==='string','MEGAHAT_PARAMETERS');const p=Object.create(null);for(const v of s.split(sep).filter(Boolean)){const i=v.indexOf(del),k=v.slice(0,i);check(i>0&&!Object.hasOwn(p,k)&&(del!=='~'||i===v.lastIndexOf(del)),'MEGAHAT_PARAMETERS');p[k]=v.slice(i+1);}return p;}
export const MOREPUFF_MEGAHAT_EXTENSION='huffnmorepuffhighlimit96-round-one-base-v1-wheel-megahat-single-v1';
export const hasMegaHat=raw=>raw.sourceKey==='huffnmorepuffhighlimit96-round-one-base-v1'&&raw.steps.some(s=>['1|2','1|2|'].includes(pairs(s.responsePayload).FID));
const BASE=new Set(['BRS','BMS','BSPOS','VA','BWC','BWS']);
export function inspectMegaHat(raw){
 check(raw.sourceKey==='huffnmorepuffhighlimit96-round-one-base-v1'&&raw.protocol==='nextgen'&&raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.fixtureOnly===false,'MEGAHAT_PROFILE');
 check(Array.isArray(raw.steps)&&raw.steps.length>0&&raw.steps.length<=3,'MEGAHAT_UNREVIEWED');
 const start=uint(raw.startBalanceRaw);let player,last;
 for(const [i,step] of raw.steps.entries()){
  const q=pairs(step.requestPayload),p=pairs(step.responsePayload),msg=i?'FREE_GAME':'BET';
  check(step.msgId===msg&&p.MSGID===msg&&q.MSGID===msg,'MEGAHAT_MESSAGE');
  check(Object.keys(q).length===5&&q.GN==='huffnmorepuffhighlimit96'&&q.BPR==='100'&&q.RB==='5','MEGAHAT_REQUEST');
  check(typeof q.PID==='string'&&q.PID.startsWith('gdmgcm')&&q.PID.length>6&&q.PID.length<512&&(!player||player===q.PID),'MEGAHAT_SESSION');player=q.PID;
  check(uint(step.elapsedMs)<=300000,'MEGAHAT_TIMING');
  check(!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>Object.hasOwn(p,k))&&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k))&&(p.FRBAL??'0')==='0'&&(p.GCT??'0')==='0','MEGAHAT_UNREVIEWED');
  check(p.IFG===(i?'1':'0')&&p.RID==='0','MEGAHAT_UNREVIEWED');
  const n=uint(p.NFG),t=uint(p.TFG),c=uint(p.CFGG);check(t===n+c,'MEGAHAT_COUNTER');
  check(t===1&&n===(i<2?1:0)&&c===(i<2?0:1),'MEGAHAT_UNREVIEWED');
  check((i===0?['2','2|']:i===1?['1|2','1|2|']:['0','0|','1','1|']).includes(p.FID),'MEGAHAT_UNREVIEWED');
  const g=pairs(p.GSD,'#','~'),symbols=(g.VA??'').split(',').map(uint);
  check(Object.keys(g).every(k=>BASE.has(k)||(i===1&&['WHSTOP','WHSLICE','WHEELSPIN'].includes(k))),'MEGAHAT_UNREVIEWED');
  check(symbols.length===15,'MEGAHAT_SYMBOLS');check(!(symbols.filter(v=>v===13).length>=3&&symbols.filter(v=>v===14).length>=6),'MEGAHAT_UNREVIEWED');
  if(i===1)check(g.WHSTOP==='3'&&g.WHSLICE==='MEGAHAT'&&g.WHEELSPIN==='1','MEGAHAT_UNREVIEWED');
  const balance=uint(p.B),available=uint(p.AB),win=uint(p.TW);
  check(balance===available&&start-balance+win===2000&&(!last||win>=last.win),'MEGAHAT_MONEY');
  if(step.responseBalance!==undefined&&step.responseBalance!==null)check(uint(step.responseBalance)===balance,'MEGAHAT_MONEY');
  last={balance,win};
 }
 return {next:raw.steps.length<3?'FREE_GAME':null,complete:raw.steps.length===3,kind:'wheel-megahat-single-free',endBalanceRaw:last.balance,totalWinRaw:last.win,betRaw:2000};
}
