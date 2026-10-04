import fs from 'node:fs';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {params,integer} from '../../trial/capture-batch.mjs';
import {parseXml,one} from '../../trial/pearl-protocol.mjs';
import {continuationBinding,continuationRoute,EXPLICIT_CONTINUATION} from './sg-explicit-continuation.mjs';
import {isExplicitProbeFeature} from './sg-explicit-probe.mjs';
import {reviewExplicitPrefix,reviewedPickRequest} from './sg-explicit-review.mjs';
export const CARNIVAL_PICK='nextgen-carnival-pick-evidence-v3';
let policy;
const same=(a,b)=>queueHash(a)===queueHash(b);
const amount=v=>{const n=integer(v);assert(n>=0,'CARNIVAL_PICK_MONEY');return n;};
export function carnivalPrevious(plan){const {carnivalPickContract,carnivalPickContractHash,...previous}=plan;return previous;}
export function carnivalBinding(plan,raw){
 policy??=JSON.parse(fs.readFileSync('config/ag-rolling-carnival-pick-contracts.json','utf8'));
 const previous=carnivalPrevious(plan),b=policy.sourceBinding;
 assert(plan.carnivalPickContract===CARNIVAL_PICK&&plan.carnivalPickContractHash===queueHash(policy)
  &&queueHash(policy)==='691e20e7c004f9eff2578dd25a9e4789b6cf8e55156e7bcd51c0e172017612fb'&&policy.contract===CARNIVAL_PICK&&policy.schema==='sg-ag-carnival-pick-evidence-v3'
  &&queueHash(previous)===b.previousPlanHash&&b.previousPlanHash==='f813a221270d78e3164696d24d48d5a465f9d22c014b50c4eb38280fafe7e0d3'
  &&b.previousProofHash==='844177861bfdb5ad5005f678d16680ec1440d78a75779e0988657ec110aa8a4d'
  &&['gameId','sourceKey','runtimeGameId','runtimeSlug','betRaw','requestParams'].every(k=>same(plan[k],b[k]))
  &&plan.gameId===32474&&plan.runtimeGameId===33027&&plan.betRaw===108
  &&policy.ownClosedPrefixes===77&&policy.durableFrameCount===244&&same(policy.firstPickPositionCounts,{'0':23,'1':54})
  &&policy.firstPickWithoutNfgCount===36&&policy.secondPickResponseCount===13&&same(policy.reviewedSecondPickPositions,[0,1])
  &&policy.nativeEvidenceHash==='8196376019fbae07fc13955dd958a4b6f28850d47c1676372c5252834f4e000c'
  &&policy.maximumReviewedOrdinal===3&&policy.maximumReviewedResponses===4&&policy.fullSpecialTerminalsObserved===0
  &&policy.settlementApproved===false&&policy.sourceRequests===0&&policy.mongoWrites===0&&policy.failedRoundsCredited===0,
  'CARNIVAL_PICK_BINDING');
 assert(raw?.carnivalPickContract===CARNIVAL_PICK&&raw.explicitContinuationContract===EXPLICIT_CONTINUATION,'CARNIVAL_PICK_PROFILE');
 const {base}=continuationBinding(previous,raw);return {previous,base,policy};
}
export function carnivalRoute(plan,raw){
 const {previous,base,policy}=carnivalBinding(plan,raw);
 if(!isExplicitProbeFeature(raw))return null;
 assert(raw.steps.length>=1&&raw.steps.length<=4,'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED');
 // Reuse the unchanged v2 BET/START evidence gate before reviewing any new PICK.
 const start=continuationRoute(previous,{...raw,steps:raw.steps.slice(0,2)});
 if(raw.steps.length<=2)return start;
 const trigger=reviewExplicitPrefix(base,{...raw,steps:raw.steps.slice(0,1)}),first=params(raw.steps[0].responsePayload);
 const pid=params(raw.steps[0].requestPayload).PID,sid=first.SID,held=amount(raw.startBalanceRaw)-108,selected=[];
 for(let i=2;i<raw.steps.length;i++){
  const s=raw.steps[i],q=params(s.requestPayload),p=params(s.responsePayload),ordinal=i-1,m=/^1\|(1|2)\|(\d+)$/.exec(q.FP??'');
  assert(m&&Number(m[1])===ordinal,'CARNIVAL_PICK_REQUEST');
  const position=Number(m[2]);
  assert(ordinal===1?[0,1].includes(position):same([...selected,position],policy.reviewedSecondPickPositions),'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED');
  assert(s.methodName==='processGameMessage'&&s.msgId==='FEATURE_PICK'&&!s.sourceRejected
   &&same(q,{GN:plan.runtimeSlug,PID:pid,...reviewedPickRequest(base,ordinal,position)}),'CARNIVAL_PICK_REQUEST');
  selected.push(position);
  assert(p.MSGID==='FEATURE_PICK'&&p.SID===sid&&p.IFG==='0','CARNIVAL_PICK_SESSION');
  assert(amount(p.TW)===amount(first.TW)&&amount(p.B)===held+amount(p.TW)
   &&[held,amount(p.B)].includes(amount(p.AB))&&amount(s.responseBalance)===amount(p.AB),'CARNIVAL_PICK_MONEY');
  assert(typeof s.responseXml==='string'&&s.responseXml.length<262144&&!/<!DOCTYPE|<!ENTITY/i.test(s.responseXml),'INVALID_TRIAL_XML');
  const xml=parseXml(s.responseXml);
  assert(xml.tag.toUpperCase()==='GDMRESPONSE'&&same(xml.children.filter(n=>n.tag).map(n=>n.tag),['OGS_RC','SUCCESS','PAYLOAD'])
   &&one(xml,'OGS_RC').children.map(n=>n.text??'').join('')==='0'
   &&one(xml,'SUCCESS').children.map(n=>n.text??'').join('').toLowerCase()==='true'
   &&one(xml,'PAYLOAD').children.map(n=>n.text??'').join('')===s.responsePayload,'TRIAL_XML_EVIDENCE_MISMATCH');
  assert(amount(s.elapsedMs)<=300000,'INVALID_TRIAL_TIMING');
  const keys=Object.keys(p).sort(),withNfg=same(keys,policy.pickKeys.withNfg),withoutNfg=same(keys,policy.pickKeys.withoutNfg);
  assert((withNfg||withoutNfg)&&(ordinal===1||withNfg)
   &&p.FID===(withNfg?'1|0|':'1|')&&p.CFG==='1'&&p.CFP_1===String(ordinal)&&p.CFR_1===String(ordinal)
   &&p.FS_1==='1'&&p.NFR_1==='1'&&p.FPM_1===selected.map(n=>`${n};`).join('')+'|'
   &&p.FTV_1===first.FTV_1&&trigger.maxPicks>ordinal,'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED');
  if(withNfg)assert(Object.entries({NFG:'3',TFG:'3',FGT:'3',CFGG:'0',CW:'0',FGTW:'0'}).every(([k,v])=>p[k]===v),'CARNIVAL_PICK_RESPONSE_REVIEW_REQUIRED');
 }
 const ordinal=selected.length+1,options=Array.from({length:15},(_,position)=>({pickIndex:position+1,position})).filter(o=>!selected.includes(o.position));
 return {request:reviewedPickRequest(base,ordinal,options[0].position),options,settlementApproved:false};
}
export function carnivalPick(plan,raw,position){
 const {base}=carnivalBinding(plan,raw),r=carnivalRoute(plan,raw);
 assert(r?.request.MSGID==='FEATURE_PICK'&&r.options.some(o=>o.position===position),'CARNIVAL_PICK_POSITION');
 return reviewedPickRequest(base,raw.steps.length-1,position);
}
export function carnivalIntent(plan,raw,payload){
 const r=carnivalRoute(plan,raw);assert(r,'CARNIVAL_PICK_INTENT_SCOPE');const q=params(payload);let request=r.request;
 if(request.MSGID==='FEATURE_PICK'){
  const m=/^1\|([1-3])\|(\d+)$/.exec(q.FP??'');assert(m&&Number(m[1])===raw.steps.length-1,'CARNIVAL_PICK_POSITION');
  request=carnivalPick(plan,raw,Number(m[2]));
 }
 assert(same(q,{GN:plan.runtimeSlug,PID:params(raw.steps[0].requestPayload).PID,...request}),'CARNIVAL_PICK_INTENT_CHANGED');
 return {validated:true};
}
export function carnivalProof(plan,proof){
 const {policy}=carnivalBinding(plan,{fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:plan.explicitProbeContract,explicitContinuationContract:plan.explicitContinuationContract,carnivalPickContract:CARNIVAL_PICK,steps:[]}),
  {planHash,carnivalPickEvidence:e,...old}=proof,wire=e?.wiringEvidence;
 assert(planHash===queueHash(plan)&&queueHash({...old,planHash:policy.sourceBinding.previousPlanHash})===policy.sourceBinding.previousProofHash
  &&e?.schema==='sg-ag-carnival-pick-repair-evidence-v3'&&e.previousPlanHash===policy.sourceBinding.previousPlanHash
  &&e.previousProofHash===policy.sourceBinding.previousProofHash&&e.contractHash===plan.carnivalPickContractHash
  &&wire?.schema==='sg-ag-carnival-pick-codec-replay-v3'&&queueHash(wire)===policy.actualWiringEvidenceHash
  &&wire.nativeEvidenceHash===policy.nativeEvidenceHash&&wire.ownClosedPrefixes===77&&wire.actualOwnCodecPythonRequests===244
  &&wire.actualCodecPythonRecordAndVerify===true&&wire.oldAcceptedRecordParity===100&&wire.oldV2FailureParity===77
  &&wire.ownSpecialSettlementRejected===77&&wire.fullSpecialTerminalsObserved===0
  &&wire.sourceRequests===0&&wire.mongoWrites===0&&wire.failedRoundsCredited===0,'CARNIVAL_PICK_PROOF');
 return true;
}
