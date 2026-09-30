// Bounded standalone wheel cash exits; further feature outcomes remain unsupported.
// Official WheelOutro returns Idle for these cash stops, unless the independent
// combined-feature flag is set. Other stops enter a further feature spin.
import {hasMegaHat,inspectMegaHat} from './morepuff-megahat-review.mjs';
const CASH=new Set([0,2,7,8,11]);
const FURTHER=new Set([1,3,4,5,6,9,10]);
const KNOWN_GSD=new Set(['BWS','BRS','BMS','ABW','buyInPrice','FMS','WHSTOP','WHEELSPIN','WHJPM','FRAMES','PREVFRAMES','FRAMEWINS','HHSHIFTPOS','VA','BSSHIFTPOS','FEAT_WIN','HHPOS','BSPOS','FEAT','BWC']);
const check=(ok,code)=>{if(!ok)throw Error(code);};
function pairs(text,separator='&',delimiter='='){
  check(typeof text==='string','INVALID_PARAMETERS');const p=Object.create(null);
  for(const item of text.split(separator).filter(Boolean)){
    const at=item.indexOf(delimiter),key=item.slice(0,at);
    check(at>0&&!Object.hasOwn(p,key)&&(delimiter!=='~'||item.lastIndexOf(delimiter)===at),'AMBIGUOUS_PARAMETERS');
    p[key]=item.slice(at+1);
  }return p;
}
const number=v=>{check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'INVALID_COUNTER');return Number(v);};
function state(step,index){
  const p=pairs(step.responsePayload),q=pairs(step.requestPayload),msg=index?'FREE_GAME':'BET';
  check(step.msgId===msg&&p.MSGID===msg&&q.MSGID===msg,'MESSAGE_MISMATCH');
  check(q.GN==='huffnmorepuffhighlimit96'&&q.BPR==='100'&&q.RB==='5'&&Object.keys(q).length===5,'REQUEST_MISMATCH');
  check(/^gdmgcm.{1,505}$/.test(q.PID??''),'SESSION_INVALID');
  check(!['CFG','ABPM','SB','FRTR','FRTW','BUY_IN'].some(k=>Object.hasOwn(p,k))&&(p.FRBAL??'0')==='0'
    &&!Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_|FR_)/.test(k)),'UNKNOWN_TRIAL_FEATURE');
  check((p.GCT??'0')==='0','MOREPUFF_FEATURE_NOT_ADAPTED');
  check(['0','1'].includes(p.IFG),'INVALID_FREE_STATE');
  const g=pairs(p.GSD??'','#','~');
  check(Object.keys(g).every(k=>KNOWN_GSD.has(k)),'UNKNOWN_TRIAL_FEATURE');
  check(!['FEAT','FRAMES','PREVFRAMES','FRAMEWINS','HHSHIFTPOS','FEAT_WIN','HHPOS','buyInPrice','FMS'].some(k=>Object.hasOwn(g,k)),'MOREPUFF_FEATURE_NOT_ADAPTED');
  const symbols=(g.VA??'').split(',').filter(Boolean).map(number);
  check(symbols.length===15,'MISSING_WHEEL_SYMBOLS');
  check(!(symbols.filter(n=>n===13).length>=3&&symbols.filter(n=>n===14).length>=6),'MOREPUFF_FEATURE_NOT_ADAPTED');
  const n=number(p.NFG),t=number(p.TFG),c=number(p.CFGG);
  check(t===n+c&&t===1&&n<=1&&c<=1,'MOREPUFF_FEATURE_NOT_ADAPTED');
  for(const k of ['B','AB','TW'])number(p[k]);
  return {p,q,g,n,t,c};
}
export function morepuffSequence(raw){
  if(hasMegaHat(raw))return inspectMegaHat(raw);
  check(raw.sourceKey==='huffnmorepuffhighlimit96-round-one-base-v1'&&raw.protocol==='nextgen','MOREPUFF_PROFILE_REQUIRED');
  check(Array.isArray(raw.steps)&&raw.steps.length>=1&&raw.steps.length<=2,'MOREPUFF_FEATURE_NOT_ADAPTED');
  const first=state(raw.steps[0],0);
  check(['2','2|'].includes(first.p.FID)&&first.n===1&&first.c===0&&first.p.IFG==='0'
    &&first.p.RID==='0'&&first.g.WHSTOP===undefined,'MOREPUFF_FEATURE_NOT_ADAPTED');
  if(raw.steps.length===1)return {next:'FREE_GAME',complete:false,kind:'wheel'};
  const last=state(raw.steps[1],1);
  check(last.q.PID===first.q.PID,'SESSION_CHANGED');
  check(['0','0|','1','1|'].includes(last.p.FID),'MOREPUFF_FEATURE_NOT_ADAPTED');
  const stop=number(last.g.WHSTOP);
  check(CASH.has(stop)||FURTHER.has(stop),'MOREPUFF_FEATURE_NOT_ADAPTED');
  check(CASH.has(stop),'MOREPUFF_FEATURE_NOT_ADAPTED');
  check(last.n===0&&last.c===1,'INCOMPLETE_WHEEL');
  const start=raw.startBalanceRaw,end=number(last.p.B),win=number(last.p.TW);
  check(Number.isSafeInteger(start)&&start>=0&&start-end+win===2000,'STAKE_MISMATCH');
  check(end===number(last.p.AB)&&(raw.steps[1].responseBalance===undefined||Number(raw.steps[1].responseBalance)===end),'BALANCE_MISMATCH');
  return {next:null,complete:true,kind:'wheel',stop};
}

export const MOREPUFF_SOURCE='huffnmorepuffhighlimit96-round-one-base-v1';
export const MOREPUFF_EXTENSION=MOREPUFF_SOURCE+'-wheel-cash-v1';
export const hasMorepuffWheel=raw=>raw.sourceKey===MOREPUFF_SOURCE&&raw.steps.some(s=>(pairs(s.responsePayload).FID??'').split('|').includes('2'));
export function morepuffNext(raw){const {next}=morepuffSequence(raw);return next?{MSGID:next}:null;}
export function morepuffMapping(raw,extensionHash){
  check(raw.roundFieldsVersion==='sg-round-fields-v1'&&raw.fixtureOnly===false,'MOREPUFF_PROFILE_REQUIRED');
  check(morepuffSequence(raw).complete,'INCOMPLETE_ROUND');
  const selected=typeof extensionHash==='object'&&extensionHash!==null?extensionHash[hasMegaHat(raw)?'megahat':'cash']:hasMegaHat(raw)?null:extensionHash;
  check(/^[a-f0-9]{64}$/.test(selected??''),'MOREPUFF_MAPPING_REQUIRED');
  return {buy:0,bonus:hasMegaHat(raw)?3:2,typeMappingHash:selected};
}
