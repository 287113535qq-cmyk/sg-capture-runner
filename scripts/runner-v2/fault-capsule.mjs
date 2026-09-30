import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v??null)).digest('hex');
const messages=new Set(['BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END','Logic','EndGame','Init','INIT']);
const knownFields=new Set('MSGID FID NFG TFG CFGG IFG GSD GCT FRBAL B AB TW CFG JPV'.split(' '));
const knownGsd=new Set('BGCL CL BGRS VA IIFS FGRS CFGC FGVABN HNS HNSID HNSTW HRS HRSBT HVA HVABT HCL HCLBT HPCL STRS BRS BMS BSPOS BWC BWS WHSTOP WHEELSPIN WHSLICE WHJPM FEAT PCFID MMBG MMW FRAMEWINS'.split(' '));
function fields(text,separator,join){
 const out=Object.create(null);if(typeof text!=='string')return out;
 for(const part of text.split(separator)){const at=part.indexOf(join);if(at>0)out[part.slice(0,at)]=part.slice(at+1);}
 return out;
}
// Diagnostic projection only. This permissive key reader never validates a round.
export function faultCapsule({plan,raw,code}){
 const safeCode=/^[A-Z][A-Z0-9_]{0,99}$/.test(code??'')?code:'UNCLASSIFIED_FAILURE';
 const steps=Array.isArray(raw?.steps)?raw.steps:[];
 const trail=steps.slice(-8).map(step=>{
  const p=fields(step.responsePayload,'&','='),g=fields(p.GSD,'#','~');
  const unknown=Object.keys(p).filter(k=>!knownFields.has(k)),unknownGsd=Object.keys(g).filter(k=>!knownGsd.has(k));
  return {message:messages.has(step.msgId)?step.msgId:'other',
   responseFields:Object.keys(p).filter(k=>knownFields.has(k)).sort(),
   gsdFields:Object.keys(g).filter(k=>knownGsd.has(k)).sort(),
   unknownFieldCount:unknown.length,unknownFieldNamesHash:hash(unknown.sort()),
   unknownGsdCount:unknownGsd.length,unknownGsdNamesHash:hash(unknownGsd.sort()),
   ...(typeof p.FID==='string'&&/^\d{1,2}(?:\|\d{1,2})*\|?$/.test(p.FID)?{fid:p.FID}:{}),
   counters:Object.fromEntries(['NFG','TFG','CFGG','IFG'].filter(k=>/^\d{1,6}$/.test(p[k]??'')).map(k=>[k,Number(p[k])]))};
 });
 const last=trail.at(-1),fingerprint=hash({gameId:plan.gameId,sourceKey:plan.sourceKey,code:safeCode,
  protocol:raw?.protocol,last:last?{...last,counters:Object.keys(last.counters)}:null});
 return {schema:'sg-fault-capsule-v1',gameId:plan.gameId,code:safeCode,fingerprint,
  sourceDefinitionHash:hash(plan.sourceKey),rawHash:hash(raw),stepCount:steps.length,trail,
  captureAuthorization:false,sourceRequests:0};
}
