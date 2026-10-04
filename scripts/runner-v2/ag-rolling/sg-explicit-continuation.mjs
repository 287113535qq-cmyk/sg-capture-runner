import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
import {EXPLICIT_PROBE,explicitProbeBinding,isExplicitProbeFeature} from './sg-explicit-probe.mjs';
import {reviewExplicitPrefix,reviewedPickRequest} from './sg-explicit-review.mjs';
export const EXPLICIT_CONTINUATION='nextgen-carnival-request-evidence-v2';
let policy;
const amount=value=>{const n=integer(value);assert(n>=0,'EXPLICIT_CONTINUATION_MONEY');return n;};
const same=(a,b)=>queueHash(a)===queueHash(b);
export function continuationBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-explicit-continuation-contracts.json','utf8'));
 const {explicitContinuationContract,explicitContinuationContractHash,...previous}=plan,b=policy.sourceBinding;
 assert(explicitContinuationContract===EXPLICIT_CONTINUATION&&explicitContinuationContractHash===queueHash(policy)
  &&policy.contract===EXPLICIT_CONTINUATION&&policy.schema==='sg-ag-carnival-continuation-evidence-v2'
  &&b.previousPlanHash===queueHash(previous)&&plan.gameId===32474&&b.gameId===32474
  &&plan.sourceKey===b.sourceKey&&plan.runtimeGameId===33027&&b.runtimeGameId===33027
  &&plan.runtimeSlug===b.runtimeSlug&&plan.betRaw===108&&b.betRaw===108
  &&same(plan.requestParams,b.requestParams)&&plan.explicitProbeContract===EXPLICIT_PROBE
  &&plan.explicitProbeContractHash===b.previousContractHash
  &&policy.maximumReviewedOrdinal===2&&policy.maximumReviewedResponses===3
  &&policy.firstPickObservedPosition===0&&policy.ownClosedPrefixes===48
  &&policy.fullSpecialTerminalsObserved===0&&policy.settlementApproved===false
  &&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,'EXPLICIT_CONTINUATION_BINDING');
 assert(raw?.explicitContinuationContract===EXPLICIT_CONTINUATION,'EXPLICIT_CONTINUATION_PROFILE');
 const base=explicitProbeBinding(previous,raw);return {previous,base,policy};
}
export function continuationRoute(plan,raw){
 const {base}=continuationBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length>=1&&raw.steps.length<=3,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED');
 const triggerReview=reviewExplicitPrefix(base,{...raw,steps:raw.steps.slice(0,1)});
 const held=amount(raw.startBalanceRaw)-amount(plan.betRaw),first=params(raw.steps[0].responsePayload);
 const pid=params(raw.steps[0].requestPayload).PID,sid=first.SID;let win=0;
 assert(typeof sid==='string'&&sid.length>0&&sid.length<512,'EXPLICIT_CONTINUATION_SESSION');
 for(let i=0;i<raw.steps.length;i++){
  const s=raw.steps[i],msg=i===0?'BET':i===1?'FEATURE_START':'FEATURE_PICK',q=params(s.requestPayload),p=params(s.responsePayload);
  const request=i===0?{...plan.requestParams,MSGID:msg}:i===1?{MSGID:msg,CFG:'1'}:reviewedPickRequest(base,1,0);
  assert(s.methodName==='processGameMessage'&&s.msgId===msg&&!s.sourceRejected
   &&same(q,{GN:plan.runtimeSlug,PID:pid,...request}),'EXPLICIT_CONTINUATION_REQUEST');
  assert(p.MSGID===msg&&p.IFG==='0'&&p.SID===sid,'EXPLICIT_CONTINUATION_SESSION');
  const b=amount(p.B),ab=amount(p.AB),tw=amount(p.TW);
  assert(b===held+tw&&(ab===held||ab===b)&&tw>=win&&amount(s.responseBalance)===ab,'EXPLICIT_CONTINUATION_MONEY');win=tw;
  assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
  const xml=parseXml(s.responseXml);
  assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&!xml.children.some(n=>n.tag?.toUpperCase()==='ERROR')
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
  const keys=Object.keys(p).sort();
  if(i===0)continue;
  if(i===1){
   const withNfg=same(keys,policy.startWithNfgKeys),withoutNfg=same(keys,policy.startWithoutNfgKeys);
   assert(withNfg||withoutNfg,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED');
   if(withNfg)assert(p.NFG==='3'&&p.TFG==='3'&&p.FGT==='3'&&p.CFGG==='0'&&p.CW==='0'&&p.FGTW==='0',
    'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED');
  }else{
   assert(same(keys,policy.firstPickKeys)&&Object.entries(policy.firstPickConstants).every(([k,v])=>p[k]===v)
    &&p.FTV_1===first.FTV_1&&triggerReview.maxPicks>1,'EXPLICIT_CONTINUATION_RESPONSE_REVIEW_REQUIRED');
  }
 }
 if(raw.steps.length===1)return {request:triggerReview.candidateRequest,options:[],settlementApproved:false};
 const ordinal=raw.steps.length===2?1:2,selected=ordinal===2?[0]:[];
 const options=Array.from({length:15},(_,position)=>({pickIndex:position+1,position})).filter(o=>!selected.includes(o.position));
 return {request:reviewedPickRequest(base,ordinal,options[0].position),options,settlementApproved:false};
}
export function continuationPick(plan,raw,position){
 const {base}=continuationBinding(plan,raw),r=continuationRoute(plan,raw);
 assert(r?.request.MSGID==='FEATURE_PICK'&&r.options.some(o=>o.position===position),'EXPLICIT_CONTINUATION_POSITION');
 return reviewedPickRequest(base,raw.steps.length===2?1:2,position);
}
export function continuationIntent(plan,raw,payload){
 const r=continuationRoute(plan,raw);assert(r,'EXPLICIT_CONTINUATION_INTENT_SCOPE');
 const q=params(payload),pid=params(raw.steps[0].requestPayload).PID;let request=r.request;
 if(request.MSGID==='FEATURE_PICK'){
  const m=/^1\|(1|2)\|(\d+)$/.exec(q.FP??'');
  assert(m&&Number(m[1])===(raw.steps.length===2?1:2),'EXPLICIT_CONTINUATION_POSITION');
  request=continuationPick(plan,raw,Number(m[2]));
 }
 assert(same(q,{GN:plan.runtimeSlug,PID:pid,...request}),'EXPLICIT_CONTINUATION_INTENT_CHANGED');
 return {validated:true};
}
