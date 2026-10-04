import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
import {dragonBinding,dragonRoute,EXPLICIT_DRAGON} from './sg-explicit-dragon.mjs';
import {isExplicitProbeFeature} from './sg-explicit-probe.mjs';
export const DRAGON_END='nextgen-dragon-end-evidence-v3';
let policy;
const same=(a,b)=>queueHash(a)===queueHash(b);
const amount=v=>{const n=integer(v);assert(n>=0,'DRAGON_END_MONEY');return n;};
export function dragonEndPrevious(plan){const {dragonEndContract,dragonEndContractHash,...previous}=plan;return previous;}
export function dragonEndBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-dragon-end-contracts.json','utf8'));
 const previous=dragonEndPrevious(plan),b=policy.sourceBinding;
 assert(plan.dragonEndContract===DRAGON_END&&plan.dragonEndContractHash===queueHash(policy)
  &&queueHash(policy)==='7131fe63ebc2d7600490c1942f04983bbdd1dc81763ba9a9547ee22a5fc7a6ea'&&policy.contract===DRAGON_END&&policy.schema==='sg-ag-dragon-end-evidence-v3'
  &&queueHash(previous)===b.previousPlanHash&&b.previousPlanHash==='38698c3720ae83510f1f840e4d461bed547dfef2ae5a123a54ed23907aae90b9'
  &&b.previousProofHash==='bb9bfc73f7644a39980dab1b34308f8515780dca460b94610a5ccbd8233a5c0c'
  &&['gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'].every(k=>same(plan[k],b[k]))
  &&plan.gameId===32497&&plan.runtimeGameId===33032&&plan.betRaw===100
  &&policy.ownClosedPrefixes===88&&policy.durableFrameCount===257&&policy.ownFirstPickResponses===81&&policy.parentStartRejectionsRetained===7
  &&policy.nativeEvidenceHash==='d8ec0615fba6c4e68647b74a5241273d36c854ede02b3e940443fe693b2a2871'
  &&same(policy.candidateEnd,{MSGID:'FEATURE_END',CFG:'0'})&&same(policy.frontendMappings,{FID:'xO',FS_0:'m8',CFP_0:'G7'})
  &&policy.maximumReviewedResponses===3&&policy.endResponsesObserved===0&&policy.fullSpecialTerminalsObserved===0
  &&policy.settlementApproved===false&&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,'DRAGON_END_BINDING');
 assert(raw?.dragonEndContract===DRAGON_END&&raw.explicitDragonContract===EXPLICIT_DRAGON,'DRAGON_END_PROFILE');
 dragonBinding(previous,raw);return {previous,policy};
}
function inspectPd(text,p){
 assert(typeof text==='string'&&text.length<=p.maximumPdLength&&text.endsWith('#'),'DRAGON_END_RESPONSE_REVIEW_REQUIRED');
 const pairs=text.slice(0,-1).split('#').map(v=>v.split('~'));
 assert(pairs.every(v=>v.length===2)&&new Set(pairs.map(v=>v[0])).size===pairs.length
  &&p.pdKeySets.some(keys=>same(keys,pairs.map(v=>v[0]).sort())),'DRAGON_END_RESPONSE_REVIEW_REQUIRED');
 for(const [key,value] of pairs){const limits=p.pdValueLengthBounds[key];
  assert(limits&&value.length>=limits[0]&&value.length<=limits[1]&&/^[0-9,;_-]+$/.test(value)
   &&(!p.pdScalarValues[key]||p.pdScalarValues[key].includes(value)),'DRAGON_END_RESPONSE_REVIEW_REQUIRED');
 }
}
export function dragonEndRoute(plan,raw){
 const {previous,policy:p}=dragonEndBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length>=1&&raw.steps.length<=3,'DRAGON_END_RESPONSE_REVIEW_REQUIRED');
 // The unchanged parent START gate must pass before any new PICK response.
 const start=dragonRoute(previous,{...raw,steps:raw.steps.slice(0,2)});
 if(raw.steps.length<=2)return start;
 const first=params(raw.steps[0].responsePayload),s=raw.steps[2],q=params(s.requestPayload),a=params(s.responsePayload);
 const pid=params(raw.steps[0].requestPayload).PID,held=amount(raw.startBalanceRaw)-100;
 assert(s.methodName==='processGameMessage'&&s.msgId==='FEATURE_PICK'&&!s.sourceRejected
  &&same(q,{GN:plan.runtimeSlug,PID:pid,...start.request}),'DRAGON_END_REQUEST');
 assert(a.MSGID==='FEATURE_PICK'&&a.SID===first.SID&&a.IFG==='0','DRAGON_END_SESSION');
 assert(amount(a.TW)===amount(first.TW)&&amount(a.B)===held+amount(a.TW)
  &&[held,amount(a.B)].includes(amount(a.AB))&&amount(s.responseBalance)===amount(a.AB),'DRAGON_END_MONEY');
 assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
 const xml=parseXml(s.responseXml);
 assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&same(xml.children.filter(n=>n.tag).map(n=>n.tag),['OGS_RC','SUCCESS','PAYLOAD'])
  &&one(xml,'OGS_RC').children.map(n=>n.text??'').join('')==='0'
  &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
  &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
 assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
 assert(same(Object.keys(a).sort(),p.pickKeys)&&Object.entries({FID:'0|',CFG:'0',CFP_0:'1',CFR_0:'1',FPM_0:'1;|',FS_0:'1',NFR_0:'1',TFW_0:'0'}).every(([k,v])=>a[k]===v),'DRAGON_END_RESPONSE_REVIEW_REQUIRED');
 inspectPd(a.PD,p);
 // The source frontend maps CFP_0 to G7/Eu; NFR_0 is independently bounded.
 return {request:{MSGID:'FEATURE_END',CFG:'0'},options:[],settlementApproved:false};
}
export function dragonEndIntent(plan,raw,payload){
 const r=dragonEndRoute(plan,raw);assert(r,'DRAGON_END_INTENT_SCOPE');
 assert(same(params(payload),{GN:plan.runtimeSlug,PID:params(raw.steps[0].requestPayload).PID,...r.request}),'DRAGON_END_INTENT_CHANGED');return {validated:true};
}
export function dragonEndProof(plan,proof){
 const {policy:p}=dragonEndBinding(plan,{fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:plan.explicitProbeContract,explicitDragonContract:plan.explicitDragonContract,dragonEndContract:DRAGON_END,steps:[]});
 const {planHash,dragonEndEvidence:e,...old}=proof,wire=e?.wiringEvidence;
 assert(planHash===queueHash(plan)&&queueHash({...old,planHash:p.sourceBinding.previousPlanHash})===p.sourceBinding.previousProofHash
  &&e?.schema==='sg-ag-dragon-end-repair-evidence-v3'&&e.previousPlanHash===p.sourceBinding.previousPlanHash&&e.previousProofHash===p.sourceBinding.previousProofHash
  &&e.contractHash===plan.dragonEndContractHash&&wire?.schema==='sg-ag-dragon-end-codec-replay-v3'&&queueHash(wire)===p.actualWiringEvidenceHash
  &&wire.nativeEvidenceHash===p.nativeEvidenceHash&&wire.ownClosedPrefixes===88&&wire.actualOwnCodecPythonRequests===257
  &&wire.originalFrontendCandidateRequests===81&&wire.parentStartRejectionsRetained===7&&wire.oldV2FailureParity===88
  &&wire.actualCodecPythonRecordAndVerify===true&&wire.oldAcceptedRecordParity===99&&wire.ownSpecialSettlementRejected===88
  &&wire.endResponsesObserved===0&&wire.fullSpecialTerminalsObserved===0&&wire.sourceRequests===0&&wire.mongoWrites===0&&wire.failedRoundsCredited===0,'DRAGON_END_PROOF');
 return true;
}
