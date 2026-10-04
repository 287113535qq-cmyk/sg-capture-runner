import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
import {EXPLICIT_PROBE,explicitProbeBinding,isExplicitProbeFeature} from './sg-explicit-probe.mjs';
import {reviewExplicitPrefix,reviewedPickRequest} from './sg-explicit-review.mjs';
export const EXPLICIT_DRAGON='nextgen-dragon-start-evidence-v2';
let policy;
const same=(a,b)=>queueHash(a)===queueHash(b);
const money=v=>{const n=integer(v);assert(n>=0,'EXPLICIT_DRAGON_MONEY');return n;};
export function dragonBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-explicit-dragon-contracts.json','utf8'));
 const {explicitDragonContract,explicitDragonContractHash,...previous}=plan,b=policy.sourceBinding;
 assert(explicitDragonContract===EXPLICIT_DRAGON&&explicitDragonContractHash===queueHash(policy)
  &&policy.contract===EXPLICIT_DRAGON&&policy.schema==='sg-ag-dragon-start-evidence-v2'
  &&b.previousPlanHash===queueHash(previous)&&plan.gameId===32497&&b.gameId===32497
  &&plan.runtimeGameId===33032&&b.runtimeGameId===33032&&plan.sourceKey===b.sourceKey
  &&plan.runtimeSlug===b.runtimeSlug&&plan.betRaw===100&&b.betRaw===100&&same(plan.requestParams,b.requestParams)
  &&plan.explicitProbeContract===EXPLICIT_PROBE&&plan.explicitProbeContractHash===b.previousContractHash
  &&policy.ownClosedPrefixes===72&&policy.maximumReviewedResponses===2&&policy.maximumReviewedContinuations===2
  &&same(policy.candidatePick,{MSGID:'FEATURE_PICK',CFG:'0',FP:'0|1|1'})
  &&policy.fullSpecialTerminalsObserved===0&&policy.settlementApproved===false
  &&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,'EXPLICIT_DRAGON_BINDING');
 assert(raw?.explicitDragonContract===EXPLICIT_DRAGON,'EXPLICIT_DRAGON_PROFILE');
 return {previous,base:explicitProbeBinding(previous,raw),policy};
}
function inspectPd(text,p){
 assert(typeof text==='string'&&text.length<=215&&text.endsWith('#'),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 const entries=text.slice(0,-1).split('#').map(pair=>pair.split('~'));
 assert(entries.every(e=>e.length===2)&&new Set(entries.map(e=>e[0])).size===entries.length,
  'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 const keys=entries.map(e=>e[0]).sort();
 assert(p.pdKeySets.some(s=>same(s,keys)),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 for(const [key,value] of entries){
  const bounds=p.pdValueLengthBounds[key];
  assert(bounds&&value.length>=bounds[0]&&value.length<=bounds[1]&&/^[0-9,;_-]+$/.test(value)
   &&(!p.pdScalarValues[key]||p.pdScalarValues[key].includes(value)),'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 }
}
export function dragonRoute(plan,raw){
 const {base,policy:p}=dragonBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length>=1&&raw.steps.length<=2,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 const review=reviewExplicitPrefix(base,{...raw,steps:raw.steps.slice(0,1)});
 assert(review.maxPicks===1,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
 const first=params(raw.steps[0].responsePayload),pid=params(raw.steps[0].requestPayload).PID,sid=first.SID;
 assert(typeof sid==='string'&&sid.length>0&&sid.length<512,'EXPLICIT_DRAGON_SESSION');
 const held=money(raw.startBalanceRaw)-money(plan.betRaw);assert(held>=0,'EXPLICIT_DRAGON_MONEY');
 let win=0;
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i],msg=i===0?'BET':'FEATURE_START',q=params(s.requestPayload),reply=params(s.responsePayload);
  const request=i===0?{...plan.requestParams,MSGID:msg}:{MSGID:msg,CFG:'0'};
  assert(s.methodName==='processGameMessage'&&s.msgId===msg&&!s.sourceRejected
   &&same(q,{GN:plan.runtimeSlug,PID:pid,...request}),'EXPLICIT_DRAGON_REQUEST');
  assert(reply.MSGID===msg&&reply.IFG==='0'&&reply.SID===sid,'EXPLICIT_DRAGON_SESSION');
  const b=money(reply.B),ab=money(reply.AB),tw=money(reply.TW);
  assert(b===held+tw&&(ab===held||ab===b)&&tw>=win&&money(s.responseBalance)===ab,'EXPLICIT_DRAGON_MONEY');win=tw;
  assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
  const xml=parseXml(s.responseXml);
  assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&!xml.children.some(n=>n.tag?.toUpperCase()==='ERROR')
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(money(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
  if(i===1){
   assert(same(Object.keys(reply).sort(),p.startKeys)&&reply.TW===first.TW,'EXPLICIT_DRAGON_RESPONSE_REVIEW_REQUIRED');
   inspectPd(reply.PD,p);
  }
 }
 return {request:raw.steps.length===1?review.candidateRequest:reviewedPickRequest(base,1,0),options:[],settlementApproved:false};
}
export function dragonIntent(plan,raw,payload){
 const r=dragonRoute(plan,raw);assert(r,'EXPLICIT_DRAGON_INTENT_SCOPE');
 assert(same(params(payload),{GN:plan.runtimeSlug,PID:params(raw.steps[0].requestPayload).PID,...r.request}),
  'EXPLICIT_DRAGON_INTENT_CHANGED');return {validated:true};
}
