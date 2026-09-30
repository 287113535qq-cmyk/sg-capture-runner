import {PEARL_SOURCE,pearlReview,pearlRequest} from '../trial/pearl-protocol.mjs';

// WMS labels both paid and free exchanges Logic. Count the reviewed round
// boundary, never the number of Logic messages or repeated stake attributes.
export function onePaidRound(plan,raw,{abandoned=false}={}){
 const steps=raw?.steps;
 if(!Array.isArray(steps)||!steps.length)return false;
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
