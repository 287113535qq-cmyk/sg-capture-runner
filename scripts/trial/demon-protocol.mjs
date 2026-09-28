// 32739 only. Independent Runner mirror; Python also verifies XML and money.
export const DEMON_SOURCE='thedemoncodecap250c96-round-one-base-v1';
export const DEMON_EXTENSION=DEMON_SOURCE+'-demon-free-v1';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const integer=value=>{
  need(typeof value==='string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)),'INVALID_PROTOCOL_COUNTER');
  return Number(value);
};
function parts(text){
  need(typeof text==='string','INVALID_NEXTGEN_PAYLOAD');
  const out=Object.create(null);
  for(const part of text.split('&')){
    if(!part)continue;
    const at=part.indexOf('='),key=part.slice(0,at);
    need(at>=0 && !Object.hasOwn(out,key),'AMBIGUOUS_NEXTGEN_PARAMETER');
    out[key]=part.slice(at+1);
  }
  return out;
}
function sequence(raw){
  need(raw.sourceKey===DEMON_SOURCE && raw.protocol==='nextgen' && Array.isArray(raw.steps)
    && raw.steps.length<=100,'DEMON_PROFILE_REQUIRED');
  let next='BET',player,previous,special=false,replay=false;
  for(const step of raw.steps){
    need(next!==null && step.msgId===next,'DEMON_SEQUENCE_MISMATCH');
    const r=parts(step.requestPayload),p=parts(step.responsePayload),fid=p.FID??'';
    need(r.MSGID===step.msgId && p.MSGID===step.msgId,'MESSAGE_ID_MISMATCH');
    need(/^gdmgcm.{1,505}$/.test(r.PID??'') && (player===undefined || r.PID===player),'SESSION_CHANGED_MID_ROUND');
    player=r.PID;
    need(['','0','0|','1|0|'].includes(fid) && !Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k))
      && p.CFG===undefined && p.ABPM===undefined,'UNKNOWN_TRIAL_FEATURE');
    need(['0','1'].includes(p.IFG) && (step.msgId!=='FREE_GAME' || p.IFG==='1'),'INVALID_FREE_GAME_STATE');
    for(const k of ['B','AB','TW'])integer(p[k]);
    const counts=Object.fromEntries(['NFG','TFG','CFGG'].map(k=>[k,p[k]===undefined?null:integer(p[k])]));
    need(Object.values(counts).every(v=>v===null || v<=100),'TRIAL_FREE_LIMIT');
    if(step.msgId==='FREE_GAME' || fid==='1|0|' || counts.NFG)
      need(Object.values(counts).every(v=>v!==null),'DEMON_MISSING_FREE_COUNTER');
    if(fid==='1|0|' && previous!=='1|0|')need(counts.NFG>0,'DEMON_EMPTY_FREE_TRIGGER');
    replay ||= previous==='1|0|' && step.msgId==='FREE_GAME';
    special ||= fid==='1|0|';
    previous=fid;next=counts.NFG?'FREE_GAME':null;
  }
  return {next,special,replay};
}
export function demonNextRequest(raw){
  const {next}=sequence(raw);return next?{MSGID:next}:null;
}
export function demonMapping(raw,baseHash,extensionHash){
  const {next,special,replay}=sequence(raw);
  need(raw.steps.length>0 && next===null,'INCOMPLETE_ROUND');
  if(special)need(replay && extensionHash,'DEMON_FEATURE_MAPPING_REQUIRED');
  return {buy:0,bonus:special?2:raw.steps.some(s=>s.msgId==='FREE_GAME')?1:0,
    typeMappingHash:special?extensionHash:baseHash};
}
