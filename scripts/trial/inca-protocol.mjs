import{incaCoinSequence,hasIncaCoins,INCA_EXTENSION as INCA_COIN_EXTENSION}from'./inca-coin-review.mjs';
export{INCA_COIN_EXTENSION};
import{incajungleSequence}from'./inca-free-review.mjs';
// Inca has an independently reviewed ten-free route and a separate mapping.
// Standalone FID1 is supported; switching feature at NFG0 is not an exit.
export const INCA_SOURCE='hyperchargedincajungle96-round-one-base-v1';
export const INCA_EXTENSION=INCA_SOURCE+'-inca-ten-free-v1';
const expected={BPL:'1',GN:'hyperchargedincajungle96',LB:'40'};
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
export function incaSequence(raw){
 check(raw?.steps?.length>0,'INVALID_ROUND_STEPS');
 const special=raw.steps.some(s=>['1','1|'].includes(pairs(s.responsePayload).FID));
 if(special)return {...(hasIncaCoins(raw)?incaCoinSequence(raw):incajungleSequence(raw)),coins:hasIncaCoins(raw)};

  check(raw.sourceKey===INCA_SOURCE&&raw.protocol==='nextgen'&&raw.steps?.length>0&&raw.steps.length<=100,'INCA_PROFILE_REQUIRED');
  let previous,player,last;
  for(const [index,step] of raw.steps.entries()){
    const msg=index===0?'BET':'FREE_GAME',q=pairs(step.requestPayload),p=pairs(step.responsePayload);
    check(step.msgId===msg&&q.MSGID===msg&&p.MSGID===msg&&(index===0||previous.n>0),'INCA_SEQUENCE_MISMATCH');
    check(Object.keys(q).length===5&&Object.entries(expected).every(([k,v])=>q[k]===v),'REQUEST_MISMATCH');
    check(/^gdmgcm.{1,505}$/.test(q.PID??'')&&(player===undefined||player===q.PID),'SESSION_CHANGED');player=q.PID;
    check((special?['1','1|']:['','0','0|']).includes(p.FID??'')
      && !Object.keys(p).some(k=>/^(FS_|NFR_|CFR_|CFP_)/.test(k))
      && !['CFG','ABPM','SB'].some(k=>Object.hasOwn(p,k)),'UNKNOWN_TRIAL_FEATURE');
    check(['0','1'].includes(p.IFG)&&(index===0||p.IFG==='1'),'INVALID_FREE_STATE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    const n=integer(p.NFG??(index===0&&!special?'0':undefined));check(n<=100,'FREE_LIMIT');
    let t,c;
    check(raw.steps.length===1&&n===0,'UNKNOWN_TRIAL_FEATURE');
    previous={n,t,c};last=p;
  }
  return {next:previous.n?'FREE_GAME':null,special,last};
}
export function incaNextRequest(raw){
  if(!raw.steps.length)return {MSGID:'BET'};
  const {next}=incaSequence(raw);return next?{MSGID:next}:null;
}
export function incaMapping(raw,baseHash,extensionHash){
  const {next,special,last,coins}=incaSequence(raw);
  check(next===null&&(!special||raw.steps.length>1),'INCOMPLETE_ROUND');
  const end=integer(last.B),win=integer(last.TW);
  check(raw.roundFieldsVersion==='sg-round-fields-v1'&&Number.isSafeInteger(raw.startBalanceRaw)
    &&raw.startBalanceRaw>=0&&raw.startBalanceRaw-end+win===20,'STAKE_MISMATCH');
  check(end===integer(last.AB)&&(raw.steps.at(-1).responseBalance===undefined
    ||Number(raw.steps.at(-1).responseBalance)===end),'BALANCE_MISMATCH');
  const typeMappingHash=special?(coins?extensionHash?.coins:typeof extensionHash==='object'?extensionHash.free:extensionHash):baseHash;
  check(typeof typeMappingHash==='string'&&/^[a-f0-9]{64}$/.test(typeMappingHash),'INCA_MAPPING_REQUIRED');
  return {buy:0,bonus:special?(coins?3:2):raw.steps.length>1?1:0,typeMappingHash};
}
