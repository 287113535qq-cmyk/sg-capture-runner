import {advanceFreeGameCounters} from './free-game-counters.mjs';
// Official Jinzita route also checks nested free counters and forced termination.
// Standalone FID1 is supported; switching feature at NFG0 is not an exit.
export const JINZITA_SOURCE='hyperchargedjinzita96-round-one-base-v1';
export const JINZITA_EXTENSION=JINZITA_SOURCE+'-jinzita-free-v1';
const expected={BPL:'1',GN:'hyperchargedjinzita96',LB:'40'};
const check=(v,e)=>{if(!v)throw Error(e);};
function pairs(text,sep='&',eq='='){
  check(typeof text==='string','INVALID_PARAMETERS');const p=Object.create(null);
  for(const item of text.split(sep).filter(Boolean)){
    const at=item.indexOf(eq),key=item.slice(0,at);
    check(at>0&&!Object.hasOwn(p,key)&&(eq!=='~'||item.lastIndexOf(eq)===at),'AMBIGUOUS_PARAMETERS');
    p[key]=item.slice(at+1);
  }return p;
}
function integer(v){check(typeof v==='string'&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v)),'INVALID_NUMBER');return Number(v);}
export function jinzitaSequence(raw){
  check(raw.sourceKey===JINZITA_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'JINZITA_PROFILE_REQUIRED');
  const special=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
  let previous,player,last;
  for(const [index,step] of raw.steps.entries()){
    const msg=index===0?'BET':'FREE_GAME',q=pairs(step.requestPayload),p=pairs(step.responsePayload);
    check(step.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&(index===0||previous.n>0),'JINZITA_SEQUENCE_MISMATCH');
    check(Object.keys(q).length===5&&Object.entries(expected).every(([k,v])=>q[k]===v),'REQUEST_MISMATCH');
    check(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(player===undefined||player===q.PID),'SESSION_CHANGED');player=q.PID;
    check((special?['1','1|']:['','0','0|']).includes(p.FID??'')
      && !Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      && !['CFG','ABPM','SB'].some(k=>Object.hasOwn(p,k)),'UNKNOWN_TRIAL_FEATURE');
    check(['0','1'].includes(p.IFG)&&(index===0||p.IFG==='1'),'INVALID_FREE_STATE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    const n=integer(p.NFG??(index===0&&!special?'0':undefined));check(n<=100,'FREE_LIMIT');
    let t,c;
    if(special){
      const gsd=pairs(p.GSD??'','#','~');
      check(!Object.hasOwn(gsd,'CFG')&&(gsd.FID??'[]')==='[]','UNKNOWN_TRIAL_FEATURE');
      t=integer(p.TFG);c=integer(p.CFGG);check(t<=100&&c<=100&&t===n+c,'JINZITA_COUNTERS');
      check((p.GCT??'0')==='0','UNSUPPORTED_JINZITA_TERMINATION');
      check((gsd.FGRS===undefined||integer(gsd.FGRS)===n)&&(gsd.CFGC===undefined||integer(gsd.CFGC)===c),'UNSUPPORTED_JINZITA_NESTED_COUNTER');
      if(index===0)check(n>0&&c===0&&p.IFG==='0','JINZITA_EMPTY_TRIGGER');
      else{
        advanceFreeGameCounters({total:previous.t,remaining:previous.n,played:previous.c},{total:t,remaining:n,played:c},{maximum:100});
      }
    }
    previous={n,t,c};last=p;
  }
  return {next:previous.n?'FREE_GAME':null,special,last};
}
export function jinzitaNextRequest(raw){
  if(!raw.steps.length)return {MSGID:'BET'};
  const {next}=jinzitaSequence(raw);return next?{MSGID:next}:null;
}
export function jinzitaMapping(raw,baseHash,extensionHash){
  const {next,special,last}=jinzitaSequence(raw);
  check(next===null&&(!special||raw.steps.length>1),'INCOMPLETE_ROUND');
  const end=integer(last.B),win=integer(last.TW);
  check(raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)
    &&raw.startBalanceRaw>=0&&raw.startBalanceRaw-end+win===20,'STAKE_MISMATCH');
  check(end===integer(last.AB)&&(raw.steps.at(-1).responseBalance===undefined
    ||Number(raw.steps.at(-1).responseBalance)===end),'BALANCE_MISMATCH');
  const typeMappingHash=special?extensionHash:baseHash;
  check(typeof typeMappingHash==='string'&&/^[a-f0-9]{64}$/.test(typeMappingHash),'JINZITA_MAPPING_REQUIRED');
  return {buy:0,bonus:special?2:raw.steps.length>1?1:0,typeMappingHash};
}
