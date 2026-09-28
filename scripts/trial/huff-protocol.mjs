// 32714 only. Server independently verifies XML, exact request mode and money.
export const HUFF_SOURCE='huffnpuffmoneymansionhighlimit96-round-one-base-v1';
export const HUFF_EXTENSION=HUFF_SOURCE+'-hard-hat-v1';
const need=(condition,code)=>{if(!condition)throw new Error(code);};
function parts(text,separator,delimiter) {
  need(typeof text==='string','HUFF_INVALID_PAYLOAD');
  const out={};
  for(const part of text.split(separator)) {
    if(!part)continue;
    const at=part.indexOf(delimiter),key=part.slice(0,at);
    need(at>0 && !Object.hasOwn(out,key),'HUFF_AMBIGUOUS_PAYLOAD');
    out[key]=part.slice(at+1);
  }
  return out;
}
function integer(value) {
  need(/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)),'HUFF_INVALID_COUNTER');
  return Number(value);
}
function ids(value='') {
  if(!value)return [];
  need(/^\d+(?:\|\d+)*\|?$/.test(value),'HUFF_INVALID_FID');
  const values=value.replace(/\|$/,'').split('|').map(integer);
  need(values.length<=2 && new Set(values).size===values.length && values.every(i=>i===0 || i===1),'HUFF_FEATURE_NOT_ADAPTED');
  return values;
}
function state(step) {
  const p=parts(step.responsePayload,'&','='),g=parts(p.GSD ?? '','#','~'),featureIds=ids(p.FID),previous=ids(g.PCFID);
  need(['BET','FREE_GAME'].includes(step.msgId) && p.MSGID===step.msgId,'HUFF_MESSAGE_MISMATCH');
  need(!Object.keys(p).some(k=>/^(FS_|NFR_)/.test(k)) && p.CFG===undefined && p.ABPM===undefined,'HUFF_UNREVIEWED_FEATURE_PROTOCOL');
  need([undefined,'MMANSION','HARDHAT'].includes(g.FEAT),'HUFF_FEATURE_NOT_ADAPTED');
  need([undefined,'0','1'].includes(g.MMBG),'HUFF_INVALID_MANSION_FLAG');
  for(const k of ['B','AB','TW'])integer(p[k]);
  need(['0','1'].includes(p.IFG) && (step.msgId!=='FREE_GAME' || p.IFG==='1'),'HUFF_INVALID_FREE_STATE');
  const counters=Object.fromEntries(['NFG','TFG','CFGG'].map(k=>[k,p[k]===undefined?null:integer(p[k])]));
  need(Object.values(counters).every(v=>v===null || v<=100),'HUFF_FREE_LIMIT');
  if(step.msgId==='FREE_GAME' || featureIds.includes(1) || counters.NFG)
    need(Object.values(counters).every(v=>v!==null),'HUFF_MISSING_FEATURE_COUNTER');
  return {p,g,featureIds,previous,counters};
}
export function huffNextRequest(raw) {
  need(raw.sourceKey===HUFF_SOURCE && raw.protocol==='nextgen' && raw.steps.length<=100,'HUFF_PROFILE_REQUIRED');
  let next='BET',player;
  for(const step of raw.steps) {
    need(next!==null && step.msgId===next,'HUFF_SEQUENCE_MISMATCH');
    const {g,featureIds,counters}=state(step),request=parts(step.requestPayload,'&','=');
    need(request.MSGID===step.msgId && /^gdmgcm.{1,505}$/.test(request.PID ?? '')
      && (player===undefined || request.PID===player),'HUFF_SESSION_MISMATCH');
    player=request.PID;
    if(step.msgId==='BET' && featureIds.includes(1))need(counters.NFG>0,'HUFF_MISSING_HARD_HAT_CONTINUATION');
    next=counters.NFG || featureIds[0]===0 && g.MMBG==='1' && !g.MMW?'FREE_GAME':null;
  }
  return next?{MSGID:next}:null;
}
export function huffMapping(raw,baseHash,extensionHash) {
  need(raw.steps.length>0 && huffNextRequest(raw)===null,'HUFF_INCOMPLETE_ROUND');
  let hardHat=false,mansion=false,hardHatReplay=false,mansionReplay=false;
  for(const step of raw.steps) {
    const {g,featureIds,counters}=state(step);
    hardHat ||= featureIds.includes(1) || g.FEAT==='HARDHAT';
    hardHatReplay ||= step.msgId==='FREE_GAME' && g.FEAT==='HARDHAT';
    mansionReplay ||= step.msgId==='FREE_GAME' && g.FEAT==='MMANSION';
    mansion ||= featureIds.includes(0) && counters.NFG>0
      || g.FEAT==='MMANSION' || g.MMBG==='1';
  }
  if(hardHat)need(hardHatReplay && extensionHash,'HUFF_FEATURE_MAPPING_REQUIRED');
  if(hardHat && mansion)need(mansionReplay,'HUFF_MISSING_MANSION_REPLAY');
  return {buy:0,bonus:hardHat?(mansion?3:2):(raw.steps.some(s=>s.msgId==='FREE_GAME')?1:0),
    typeMappingHash:hardHat?extensionHash:baseHash};
}
