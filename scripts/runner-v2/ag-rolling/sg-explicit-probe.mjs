import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params} from '../../trial/capture-batch.mjs';
import {reviewExplicitPrefix,reviewedPickRequest} from './sg-explicit-review.mjs';
export const EXPLICIT_PROBE='nextgen-explicit-request-evidence-v1';
let policy;
export function explicitProbeBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-explicit-request-reviews.json','utf8'));
 const {explicitProbeContract,explicitProbeContractHash,explicitContinuationContract,explicitContinuationContractHash,...base}=plan;
 assert(explicitProbeContract===EXPLICIT_PROBE&&explicitProbeContractHash===queueHash(policy)
  &&policy.sourceBindings?.[String(plan.gameId)]?.planHash===queueHash(base)
  &&base.adapter==='native-nextgen-v1'&&base.buy===0&&base.maxSteps===100,'EXPLICIT_PROBE_BINDING');
 assert(raw?.explicitProbeContract===EXPLICIT_PROBE&&raw.fixtureOnly===false&&raw.protocol==='nextgen'
  &&raw.sourceKey===plan.sourceKey&&raw.roundFieldsVersion==='sg-round-fields-v1'
  &&Array.isArray(raw.steps),'EXPLICIT_PROBE_PROFILE');
 return base;
}
export function isExplicitProbeFeature(raw){
 const p=raw.steps.length?params(raw.steps[0].responsePayload):{};
 return raw.steps.some(s=>s.msgId?.startsWith('FEATURE_'))||Object.keys(p).some(k=>k==='CFG'||k.startsWith('FS_')||k.startsWith('NFR_'));
}
// The original AG task collects new responses through its durable exchange.
// Only already reviewed outgoing requests are allowed. An unobserved response
// stops the session and stays evidence, never a normalized or credited round.
export function explicitProbeRoute(plan,raw){
 const base=explicitProbeBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length<=2&&(raw.steps.length!==2||plan.gameId===32474),'EXPLICIT_PROBE_RESPONSE_REVIEW_REQUIRED');
 const review=reviewExplicitPrefix(base,raw);
 return {request:review.candidateRequest,options:review.options,settlementApproved:false};
}
export function explicitProbePick(plan,raw,position){
 const base=explicitProbeBinding(plan,raw),route=explicitProbeRoute(plan,raw);
 assert(route?.request.MSGID==='FEATURE_PICK'&&route.options.some(o=>o.position===position),'EXPLICIT_PROBE_POSITION');
 return reviewedPickRequest(base,1,position);
}
export function explicitProbeIntent(plan,raw,payload){
 const route=explicitProbeRoute(plan,raw);assert(route,'EXPLICIT_PROBE_INTENT_SCOPE');
 const q=params(payload),pid=params(raw.steps[0].requestPayload).PID;
 let request=route.request;
 if(request.MSGID==='FEATURE_PICK'){
  const match=/^1\|1\|(\d+)$/.exec(q.FP??'');assert(match,'EXPLICIT_PROBE_POSITION');
  request=explicitProbePick(plan,raw,Number(match[1]));
 }
 assert(queueHash(q)===queueHash({GN:plan.runtimeSlug,PID:pid,...request}),'EXPLICIT_PROBE_INTENT_CHANGED');
 return {validated:true};
}
