import {BEAVER_SOURCE,beaverNextRequest,beaverMapping} from './beaver-protocol.mjs';
import {hasNested,nestedNext,nestedMapping} from './demon-nested-protocol.mjs';
// Offline mirror of service/squid_fields.py, independently checked by storage.
import {HUFF_SOURCE,huffNextRequest,huffMapping} from './huff-protocol.mjs';
import {DEMON_SOURCE,demonNextRequest,demonMapping} from './demon-protocol.mjs';
import {QUARTERBACK_SOURCE,quarterbackNextRequest,quarterbackMapping} from './quarterback-protocol.mjs';
export const SQUID_SOURCE='squidgameonemoregame96-round-one-base-v1';
export const SQUID_EXTENSION=SQUID_SOURCE+'-jackpot-v1';
function parse(text) {
  const out={};
  for(const part of String(text).split('&')) {
    if(!part)continue;
    const at=part.indexOf('=');
    if(at<0 || Object.hasOwn(out,part.slice(0,at)))throw new Error('AMBIGUOUS_PROTOCOL');
    out[part.slice(0,at)]=part.slice(at+1);
  }
  return out;
}
function integer(v) {if(!/^\d+$/.test(String(v)) || !Number.isSafeInteger(Number(v)))throw new Error('INVALID_PROTOCOL_COUNTER');return Number(v);}
export function nextRequest(raw) {
  if(raw.sourceKey===BEAVER_SOURCE)return beaverNextRequest(raw);
  if(raw.sourceKey===QUARTERBACK_SOURCE)return quarterbackNextRequest(raw);
  if(raw.sourceKey===DEMON_SOURCE)return hasNested(raw)?nestedNext(raw):demonNextRequest(raw);
  if(raw.sourceKey===HUFF_SOURCE)return huffNextRequest(raw);
  if(!raw.steps.length)return {MSGID:'BET'};
  if(raw.sourceKey!==SQUID_SOURCE)return integer(parse(raw.steps.at(-1).responsePayload).NFG ?? '0')>0?{MSGID:'FREE_GAME'}:null;
  let next={MSGID:'BET'},picks=null,made=0,started=false,remaining=0,player;
  for(const step of raw.steps) {
    const request=parse(step.requestPayload), p=parse(step.responsePayload),msg=step.msgId;
    if(!next || Object.entries(next).some(([k,v])=>request[k]!==v) || p.MSGID!==msg || request.MSGID!==msg
        || player!==undefined && player!==request.PID)throw new Error('JACKPOT_SEQUENCE_MISMATCH');
    player=request.PID;
    if(!['','0','0|','1|','1|0|'].includes(p.FID ?? ''))throw new Error('UNKNOWN_JACKPOT_FEATURE');
    if(p.NFG!==undefined)remaining=integer(p.NFG);
    if(msg==='BET' && (p.FID ?? '').split('|').includes('1')) {
      if(p.CFG!=='1' || p.FS_1!=='0' || p.NFR_1!=='1' || p.FPM_1!=='|')throw new Error('UNKNOWN_JACKPOT_TRIGGER');
      const values=(p.FTV_1 ?? '').replace(/\|$/,'').replace(/;$/,'').split(';').map(integer);
      if(values.length<3 || values[1]<1 || values[1]>15 || values[2]!==values[1] || values.length!==3+values[2])throw new Error('INVALID_JACKPOT_PICK_COUNT');
      picks=values[1];
    } else if(msg==='FEATURE_START')started=true;
    else if(msg==='FEATURE_PICK')made++;
    else if(msg==='FEATURE_END')picks=null;
    else if(msg==='FREE_GAME' && (p.FID ?? '').split('|').includes('1'))throw new Error('UNEXPECTED_JACKPOT_RETRIGGER');
    next=picks!==null?(!started?{MSGID:'FEATURE_START',CFG:'1'}:made<picks?
      {MSGID:'FEATURE_PICK',CFG:'1',FP:`1|${made+1}|${made}`}:{MSGID:'FEATURE_END',CFG:'1'}):remaining?{MSGID:'FREE_GAME'}:null;
  }
  return next;
}
export function roundMapping(raw, baseHash, extensionHash) {
  if(raw.sourceKey===BEAVER_SOURCE)return beaverMapping(raw,baseHash,extensionHash);
  if(raw.sourceKey===QUARTERBACK_SOURCE)return quarterbackMapping(raw,baseHash,extensionHash);
  if(raw.sourceKey===DEMON_SOURCE)return hasNested(raw)?nestedMapping(raw,extensionHash.nested):demonMapping(raw,baseHash,typeof extensionHash==='object'?extensionHash.free:extensionHash);
  if(raw.sourceKey===HUFF_SOURCE)return huffMapping(raw,baseHash,extensionHash);
  const free=raw.steps.some(s=>s.msgId==='FREE_GAME');
  const special=raw.sourceKey===SQUID_SOURCE && raw.steps.some(s=>s.msgId.startsWith('FEATURE_'));
  if(special && !extensionHash)throw new Error('FEATURE_MAPPING_REQUIRED');
  return {buy:0,bonus:special?(free?3:2):(free?1:0),typeMappingHash:special?extensionHash:baseHash};
}
