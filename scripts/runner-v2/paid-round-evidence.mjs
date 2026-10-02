import {PEARL_SOURCE,pearlReview,pearlRequest} from '../trial/pearl-protocol.mjs';
import {RHINO_SOURCE,rhinoReview,rhinoRequest} from '../trial/rhino-protocol.mjs';
import {VERYFRUITY_SOURCE,veryFruityActionNext,veryFruityActionMapping,veryFruityActionIntent} from '../trial/veryfruity-action-protocol.mjs';

// WMS labels both paid and free exchanges Logic. Count the reviewed round
// boundary, never the number of Logic messages or repeated stake attributes.
export function onePaidRound(plan,raw,{abandoned=false}={}){
 const steps=raw?.steps;
 if(!Array.isArray(steps)||!steps.length)return false;
 if(plan.gameId===32812&&plan.adapter===VERYFRUITY_SOURCE){
  try{
   if(steps.length>1026||steps[0].msgId!=='Logic')return false;
   if(!abandoned){veryFruityActionMapping(plan,raw);return veryFruityActionNext(plan,raw)===null;}
   const prior={...raw,steps:steps.slice(0,-1)},last=steps.at(-1),next=veryFruityActionNext(plan,prior);
   if(!next||last.msgId!==next.MSGID)return false;
   veryFruityActionIntent(plan,prior,last.requestPayload);return true;
  }catch{return false;}
 }
 if(plan.gameId===32799&&plan.adapter==='rhino-wms-v1'){
  try{
   if(raw.sourceKey!==RHINO_SOURCE||raw.protocol!=='wms'||steps.length>1026)return false;
   if(!abandoned)return rhinoReview(raw).next===null;
   const prior=rhinoReview({...raw,steps:steps.slice(0,-1)}),last=steps.at(-1);
   if(prior.next===null||last.msgId!==prior.next)return false;
   const header=rhinoRequest(last.requestPayload,prior.next),initial=rhinoRequest(steps[0].requestPayload,'Logic');
   return (prior.session===undefined||prior.session===header.sessionID)
    &&Object.keys(initial).every(k=>k==='sessionID'||initial[k]===header[k]);
  }catch{return false;}
 }
 if(plan.gameId!==32795||plan.adapter!=='pearl-wms-v1')return steps[0].msgId==='BET'&&steps.filter(s=>s.msgId==='BET').length===1;
 try{
  if(raw.sourceKey!==PEARL_SOURCE||raw.protocol!=='wms'||steps.length>10)return false;
  if(!abandoned)return pearlReview(raw).next===null;
  const prior=pearlReview({...raw,steps:steps.slice(0,-1)}),last=steps.at(-1);
  if(prior.next===null||last.msgId!==prior.next)return false;
  const header=pearlRequest(last.requestPayload,prior.next);
  const initial=pearlRequest(steps[0].requestPayload,'Logic');
  return (prior.session===undefined||prior.session===header.sessionID)
   &&Object.keys(initial).every(k=>k==='sessionID'||initial[k]===header[k]);
 }catch{return false;}
}
