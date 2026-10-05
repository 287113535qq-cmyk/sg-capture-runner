import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
import {DRAGON_END,dragonEndBinding,dragonEndRoute,dragonEndProof} from './sg-dragon-end.mjs';
import {isExplicitProbeFeature} from './sg-explicit-probe.mjs';
export const DRAGON_FREE='nextgen-dragon-first-free-evidence-v4';
let policy;
const same=(a,b)=>queueHash(a)===queueHash(b);
const amount=v=>{const n=integer(v);assert(n>=0,'DRAGON_FREE_MONEY');return n;};
export function dragonFreePrevious(plan){const {dragonFreeContract,dragonFreeContractHash,...previous}=plan;return previous;}
export function dragonFreeBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-dragon-first-free-contracts.json','utf8'));
 const previous=dragonFreePrevious(plan),b=policy.sourceBinding;
 assert(plan.dragonFreeContract===DRAGON_FREE&&plan.dragonFreeContractHash===queueHash(policy)
  &&queueHash(policy)==='a8c33978ab0705b12de455035b285b008dd285de3b860755b29cdb71078a7775'&&policy.contract===DRAGON_FREE&&policy.schema==='sg-ag-dragon-first-free-evidence-v4'
  &&queueHash(previous)===b.previousPlanHash&&b.previousPlanHash==='a9fa454bb02814a861eeebd64d7a74b128ce811c0e4924e0e4b8b5924229eb39'
  &&b.previousProofHash==='31030705b04a69842b361122d441fcdb2b1ab5141acdea39e1a54d4ef1d8a112'
  &&['gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'].every(k=>same(plan[k],b[k]))
  &&policy.ownClosedPrefixes===70&&policy.durableFrameCount===280&&policy.exactNativeIndexedRows===1670
  &&policy.frontendEvidence.originalFrontendExecutions===70&&policy.frontendEvidence.originalObjectConstructorChainExecuted===true
  &&same(policy.frontendEvidence.ownDragonConstructorRequest,{MSGID:'FREE_GAME',BPL:'5',LB:'50'})
  &&policy.maximumReviewedResponses===4&&policy.maximumSourceRequests===5&&same(policy.candidateFirstFree,{MSGID:'FREE_GAME'})
  &&policy.freeResponsesObserved===0&&policy.fullSpecialTerminalsObserved===0&&policy.settlementApproved===false
  &&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,'DRAGON_FREE_BINDING');
 assert(raw?.dragonFreeContract===DRAGON_FREE&&raw.dragonEndContract===DRAGON_END,'DRAGON_FREE_PROFILE');
 dragonEndBinding(previous,raw);return {previous,policy};
}
export function dragonFreeRoute(plan,raw){
 const {previous,policy:p}=dragonFreeBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length>=1&&raw.steps.length<=4,'DRAGON_FREE_RESPONSE_REVIEW_REQUIRED');
 const parent=dragonEndRoute(previous,{...raw,steps:raw.steps.slice(0,3)});
 if(raw.steps.length<=3)return parent;
 const first=params(raw.steps[0].responsePayload),s=raw.steps[3],a=params(s.responsePayload),pid=params(raw.steps[0].requestPayload).PID,held=amount(raw.startBalanceRaw)-100;
 assert(s.methodName==='processGameMessage'&&s.msgId==='FEATURE_END'&&!s.sourceRejected
  &&same(params(s.requestPayload),{GN:plan.runtimeSlug,PID:pid,...parent.request}),'DRAGON_FREE_REQUEST');
 assert(a.MSGID==='FEATURE_END'&&a.SID===first.SID&&a.IFG==='0','DRAGON_FREE_SESSION');
 assert(amount(a.TW)===amount(first.TW)&&amount(a.B)===held+amount(a.TW)&&amount(a.AB)===held
  &&amount(s.responseBalance)===held,'DRAGON_FREE_MONEY');
 assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
 const xml=parseXml(s.responseXml);
 assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&same(xml.children.filter(n=>n.tag).map(n=>n.tag),['OGS_RC','SUCCESS','PAYLOAD'])
  &&one(xml,'OGS_RC').children.map(n=>n.text??'').join('')==='0'
  &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
  &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
 assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
 assert(same(Object.keys(a).sort(),p.endKeys)&&Object.entries({FID:'1|',CW:'0',CFGG:'0',FGTW:'0',BPL:'5',LB:'25',MUL:'1',GA:'0',FRBAL:'0'}).every(([k,v])=>a[k]===v)
  &&p.allowedInitialFreeCounts.includes(amount(a.NFG))&&a.NFG===a.TFG&&a.NFG===a.FGT,'DRAGON_FREE_END_SHAPE');
 const shape=Object.fromEntries(Object.entries(a).filter(([k])=>!['B','AB','TW','SID'].includes(k)));
 assert(p.endShapeHashes.includes(queueHash(shape)),'DRAGON_FREE_END_SHAPE');
 const pick=Object.fromEntries(Object.entries(params(raw.steps[2].responsePayload)).filter(([k])=>!['B','AB','TW','SID'].includes(k)));
 assert(p.endTransitionHashes.includes(queueHash({pick,end:shape})),'DRAGON_FREE_END_TRANSITION');
 // Own frontend: NFG -> Qe, missing GCT -> wm=false, FID=1 -> jq=false.
 // Dragon's request subclass overrides the response's LB=25 with LB=50.
 return {request:{MSGID:'FREE_GAME'},options:[],settlementApproved:false};
}
export function dragonFreeIntent(plan,raw,payload){
 const r=dragonFreeRoute(plan,raw);assert(r,'DRAGON_FREE_INTENT_SCOPE');
 const base=r.request.MSGID.startsWith('FEATURE_')?{GN:plan.runtimeSlug}:plan.requestParams;
 assert(same(params(payload),{...base,PID:params(raw.steps[0].requestPayload).PID,...r.request}),'DRAGON_FREE_INTENT_CHANGED');return {validated:true};
}
export function dragonFreeProof(plan,proof){
 const raw={fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:plan.explicitProbeContract,explicitDragonContract:plan.explicitDragonContract,dragonEndContract:DRAGON_END,dragonFreeContract:DRAGON_FREE,steps:[]};
 const {previous,policy:p}=dragonFreeBinding(plan,raw),{planHash,dragonFreeEvidence:e,...old}=proof,prior={...old,planHash:queueHash(previous)},wire=e?.wiringEvidence;
 assert(planHash===queueHash(plan)&&queueHash(prior)===p.sourceBinding.previousProofHash&&e?.schema==='sg-ag-dragon-first-free-repair-evidence-v4'
  &&e.previousPlanHash===p.sourceBinding.previousPlanHash&&e.previousProofHash===p.sourceBinding.previousProofHash&&e.contractHash===plan.dragonFreeContractHash
  &&wire?.schema==='sg-ag-dragon-first-free-codec-replay-v4'&&queueHash(wire)===p.actualWiringEvidenceHash
  &&wire.ownClosedPrefixes===70&&wire.actualOwnCodecPythonRequests===280&&wire.originalFrontendCandidateRequests===70
  &&wire.oldV3BoundaryParity===70&&wire.oldV2FailureParity===88&&wire.oldAcceptedRecordParity===99&&wire.actualCodecPythonRecordAndVerify===true
  &&wire.nativeEvidenceHash===p.nativeEvidenceHash&&wire.freeResponsesObserved===0&&wire.fullSpecialTerminalsObserved===0
  &&wire.sourceRequests===0&&wire.mongoWrites===0&&wire.failedRoundsCredited===0,'DRAGON_FREE_PROOF');
 dragonEndProof(previous,prior);return true;
}
