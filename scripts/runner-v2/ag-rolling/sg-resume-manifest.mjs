import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {OWN_GEOMETRY,ownTerminalProof} from './sg-own-terminal.mjs';
import {AUTOMATIC_TERMINAL,terminalBinding} from './sg-automatic-terminal.mjs';
import {EXPLICIT_DRAGON,dragonBinding} from './sg-explicit-dragon.mjs';
import {EXPLICIT_CONTINUATION,continuationBinding} from './sg-explicit-continuation.mjs';
import {CARNIVAL_PICK,carnivalPrevious,carnivalProof} from './sg-carnival-pick.mjs';
import {DRAGON_END,dragonEndPrevious,dragonEndProof} from './sg-dragon-end.mjs';
import {DRAGON_FREE,dragonFreePrevious,dragonFreeProof} from './sg-dragon-first-free.mjs';
import {CONTRACT as ARTHUR_FEATURE,previous as arthurPrevious,validateProof as arthurFeatureProof} from './sg-arthur-feature.mjs';
// A new immutable window may bind a reviewed adapter repair while retaining
// every original campaign, quota and staging namespace. Admission replays
// successful prefixes under this binding before it grants source permission.
export function rebaseResumeManifest({previous,previousPlans,plans,completedGameIds=[]}){
 const completed=new Set(completedGameIds);
 return previous.manifest.map(entry=>{
  const id=entry.gameId,oldPlan=previousPlans.plans[id],oldProof=previousPlans.proofs[id];
  const plan=plans.plans[id],proof=plans.proofs[id];
  assert(oldPlan&&oldProof&&plan&&proof&&entry.planHash===queueHash(oldPlan)
   &&entry.adapterProofHash===queueHash(oldProof),'SG_RESUME_OLD_ADAPTER_BINDING');
  const planHash=queueHash(plan),proofHash=queueHash(proof);
  if(planHash===entry.planHash&&proofHash===entry.adapterProofHash)return structuredClone(entry);
  assert(!completed.has(id),'SG_RESUME_COMPLETED_ADAPTER_CHANGED');
  if(plan.ownTerminalContract===OWN_GEOMETRY){
   const {previousPlan,previousProof}=ownTerminalProof(plan,proof);
   if(queueHash(oldPlan)!==queueHash(previousPlan)){
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:previousProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   assert(queueHash(oldProof)===queueHash(previousProof),'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.ownTerminalContract!==undefined){
   const {previousPlan,previousProof}=ownTerminalProof(plan,proof);
   if(oldPlan.automaticFreeContract===undefined){
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:previousProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   assert(oldPlan.ownTerminalContract===undefined&&queueHash(oldPlan)===queueHash(previousPlan)
    &&queueHash(oldProof)===queueHash(previousProof),'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.arthurFeatureContract!==undefined){
   const e=proof.arthurFeatureEvidence;
   assert(id==='32754'&&oldPlan.arthurFeatureContract===undefined&&plan.arthurFeatureContract===ARTHUR_FEATURE
    &&queueHash(oldPlan)===queueHash(arthurPrevious(plan))&&queueHash(oldProof)===queueHash(e?.previousProof)
    &&e?.previousPlanHash===entry.planHash&&e?.previousProofHash===entry.adapterProofHash,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   arthurFeatureProof(plan,proof);return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.dragonFreeContract!==undefined){
   const previousPlan=dragonFreePrevious(plan),{planHash:bound,dragonFreeEvidence:e,...fields}=proof;
   const previousProof={...fields,planHash:queueHash(previousPlan)};
   if(oldPlan.dragonEndContract===undefined){
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:previousProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   assert(id==='32497'&&oldPlan.dragonFreeContract===undefined&&plan.dragonFreeContract===DRAGON_FREE
    &&queueHash(oldPlan)===queueHash(previousPlan)&&queueHash(oldProof)===queueHash(previousProof)
    &&e?.previousPlanHash===entry.planHash&&e?.previousProofHash===entry.adapterProofHash&&bound===planHash,
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   dragonFreeProof(plan,proof);return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.dragonEndContract!==undefined){
   const previousPlan=dragonEndPrevious(plan),{planHash:bound,dragonEndEvidence:e,...fields}=proof;
   const previousProof={...fields,planHash:queueHash(previousPlan)};
   // Unmarked and v1 history must pass the original -> v1 -> v2 gates first.
   if(oldPlan.explicitDragonContract===undefined){
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:previousProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   assert(id==='32497'&&oldPlan.dragonEndContract===undefined&&plan.dragonEndContract===DRAGON_END
    &&queueHash(oldPlan)===queueHash(previousPlan)&&queueHash(oldProof)===queueHash(previousProof)
    &&e?.previousPlanHash===entry.planHash&&e?.previousProofHash===entry.adapterProofHash&&bound===planHash,
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   dragonEndProof(plan,proof);
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.carnivalPickContract!==undefined){
   const previousPlan=carnivalPrevious(plan),{planHash:bound,carnivalPickEvidence:e,...fields}=proof;
   const previousProof={...fields,planHash:queueHash(previousPlan)};
   // Unmarked history must still pass each original -> v1 -> v2 evidence gate.
   if(oldPlan.explicitContinuationContract===undefined){
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:previousProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   assert(id==='32474'&&oldPlan.carnivalPickContract===undefined&&plan.carnivalPickContract===CARNIVAL_PICK
    &&queueHash(oldPlan)===queueHash(previousPlan)&&queueHash(oldProof)===queueHash(previousProof)
    &&e?.previousPlanHash===entry.planHash&&e?.previousProofHash===entry.adapterProofHash&&bound===planHash,
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   carnivalProof(plan,proof);
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.automaticTerminalContract!==undefined){
   const {automaticTerminalContract,automaticTerminalContractHash,...previousPlan}=plan;
   const {planHash:bound,automaticTerminalEvidence:evidence,...previousProof}=proof;
   if(oldPlan.automaticFreeContract===undefined){
    const intermediateProof={...previousProof,planHash:queueHash(previousPlan)};
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:intermediateProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   const {planHash:oldBound,...oldFields}=oldProof,wire=evidence?.wiringEvidence;
   assert(id==='32595'&&oldPlan.automaticFreeContract==='nextgen-automatic-nfg-free-v1'
    &&oldPlan.automaticTerminalContract===undefined&&automaticTerminalContract===AUTOMATIC_TERMINAL
    &&queueHash(previousPlan)===queueHash(oldPlan)&&queueHash(previousProof)===queueHash(oldFields)
    &&oldBound===entry.planHash&&bound===planHash
    &&evidence?.schema==='sg-ag-moneyraid-terminal-repair-evidence-v2'
    &&evidence.previousPlanHash===entry.planHash&&evidence.previousProofHash===entry.adapterProofHash
    &&evidence.contractHash===automaticTerminalContractHash&&evidence.ownClosedNaturalRounds===104&&evidence.durableFrameCount===872
    &&queueHash(evidence.terminalFidCounts)===queueHash({'2|':91,'3|':13})
    &&/^[a-f0-9]{64}$/.test(evidence.nativeEvidenceHash??'')&&evidence.independentJsPython===true
    &&evidence.sourceRequests===0&&evidence.mongoWrites===0&&evidence.failedRoundsCredited===0
    &&wire?.schema==='sg-ag-moneyraid-terminal-codec-replay-v2'
    &&wire.evidenceHash===queueHash(Object.fromEntries(Object.entries(wire).filter(([k])=>k!=='evidenceHash')))
    &&wire.previousPlanHash===entry.planHash&&wire.contractHash===automaticTerminalContractHash
    &&wire.ownClosedNaturalFullRounds===104&&wire.actualOwnCodecPythonRequests===872&&wire.oldMarkerUnreviewedTerminalRejected===104
    &&wire.oldAcceptedUnmarkedRecordParity===97&&wire.oldMarkedV1RecordParity===99&&wire.futureHistoricalFieldsParity===99
    &&wire.oldBetZeroRefreshStillRejected===1&&wire.actualCodecPythonRecordAndVerify===true
    &&wire.acceptedOldRawHashesUnchanged===true&&wire.sourceRequests===0&&wire.mongoWrites===0&&wire.failedRoundsCredited===0,
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   const {policy}=terminalBinding(plan,{fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,roundFieldsVersion:'sg-round-fields-v1',
    automaticFreeContract:oldPlan.automaticFreeContract,automaticTerminalContract,steps:[]});
   assert(evidence.nativeEvidenceHash===policy.nativeEvidenceHash
    &&queueHash(wire.terminalFidCounts)===queueHash(evidence.terminalFidCounts)
    &&wire.futureHistoricalRoutes===118&&wire.independentEveryFrameFinanceAndRequests===true
    &&/^[a-f0-9]{64}$/.test(wire.ownFullRecordsHash??'')
    &&policy.nativeRawHashes?.length===104&&new Set(policy.nativeRawHashes).size===104
    &&policy.nativeClosedHashes?.length===104
    &&[...policy.nativeRawHashes,...policy.nativeClosedHashes].every(h=>/^[a-f0-9]{64}$/.test(h)),
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.explicitDragonContract!==undefined){
   const {explicitDragonContract,explicitDragonContractHash,...previousPlan}=plan;
   const {planHash:bound,explicitDragonEvidence:evidence,...previousProof}=proof;
   if(oldPlan.explicitProbeContract===undefined){
    const intermediateProof={...previousProof,planHash:queueHash(previousPlan)};
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:intermediateProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   const {planHash:oldBound,...oldFields}=oldProof;
   assert(id==='32497'&&oldPlan.explicitProbeContract==='nextgen-explicit-request-evidence-v1'
    &&oldPlan.explicitDragonContract===undefined&&explicitDragonContract===EXPLICIT_DRAGON
    &&queueHash(previousPlan)===queueHash(oldPlan)&&queueHash(previousProof)===queueHash(oldFields)
    &&oldBound===entry.planHash&&bound===planHash
    &&evidence?.schema==='sg-ag-explicit-dragon-repair-evidence-v2'
    &&evidence.contractHash===explicitDragonContractHash&&evidence.previousPlanHash===entry.planHash
    &&evidence.previousProofHash===entry.adapterProofHash&&evidence.ownNativePrefixes===72
    &&/^[a-f0-9]{64}$/.test(evidence.nativeEvidenceHash??'')
    &&evidence.frontendEvidenceHash==='bd76291e2f96849387cf0dfe7edba277907947eca3b79b2a47f22126eae0fd3b'
    &&evidence.maximumReviewedResponses===2&&evidence.maximumReviewedContinuations===2
    &&evidence.independentJsPython===true&&evidence.fullSpecialTerminalsObserved===0
    &&evidence.settlementApproved===false&&evidence.sourceRequests===0&&evidence.mongoWrites===0
    &&evidence.failedRoundsCredited===0,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   dragonBinding(plan,{fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,
    roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:oldPlan.explicitProbeContract,
    explicitDragonContract,steps:[]});
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  if(plan.explicitContinuationContract!==undefined){
   const {explicitContinuationContract,explicitContinuationContractHash,...previousPlan}=plan;
   const {planHash:bound,explicitContinuationEvidence:evidence,...previousProof}=proof;
   if(oldPlan.explicitProbeContract===undefined){
    // Historical unmarked windows still traverse both immutable evidence
    // revisions. Neither request/history gate can be skipped by the v2 marker.
    const intermediateProof={...previousProof,planHash:queueHash(previousPlan)};
    const intermediate={plans:{[id]:previousPlan},proofs:{[id]:intermediateProof}};
    const first=rebaseResumeManifest({previous:{manifest:[entry]},previousPlans,plans:intermediate,completedGameIds})[0];
    return rebaseResumeManifest({previous:{manifest:[first]},previousPlans:intermediate,plans,completedGameIds})[0];
   }
   const {planHash:oldBound,...oldFields}=oldProof;
   assert(id==='32474'&&oldPlan.explicitProbeContract==='nextgen-explicit-request-evidence-v1'
    &&oldPlan.explicitContinuationContract===undefined&&explicitContinuationContract===EXPLICIT_CONTINUATION
    &&queueHash(previousPlan)===queueHash(oldPlan)&&queueHash(previousProof)===queueHash(oldFields)
    &&oldBound===entry.planHash&&bound===planHash
    &&evidence?.schema==='sg-ag-explicit-continuation-repair-evidence-v2'
    &&evidence.contractHash===explicitContinuationContractHash&&evidence.previousPlanHash===entry.planHash
    &&evidence.previousProofHash===entry.adapterProofHash&&evidence.ownNativePrefixes===48
    &&/^[a-f0-9]{64}$/.test(evidence.nativeEvidenceHash??'')
    &&evidence.frontendEvidenceHash==='519151bd5ea98058fa6d1f41a74c0fa235cb1bb959a74589a8926ce925073771'
    &&evidence.maximumReviewedOrdinal===2&&evidence.maximumReviewedResponses===3
    &&evidence.independentJsPython===true&&evidence.fullSpecialTerminalsObserved===0
    &&evidence.settlementApproved===false&&evidence.sourceRequests===0&&evidence.mongoWrites===0
    &&evidence.failedRoundsCredited===0,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   continuationBinding(plan,{fixtureOnly:false,protocol:'nextgen',sourceKey:plan.sourceKey,
    roundFieldsVersion:'sg-round-fields-v1',explicitProbeContract:oldPlan.explicitProbeContract,
    explicitContinuationContract,steps:[]});
   return {...entry,planHash,adapterProofHash:proofHash};
  }
  const {balanceContract,balanceContractHash,automaticFreeContract,automaticFreeContractHash,explicitProbeContract,explicitProbeContractHash,...unchangedPlan}=plan;
  const {planHash:boundHash,previousPlanHash,balanceRepair,automaticFreeRepair,explicitProbeEvidence,...unchangedProof}=proof;
  const {planHash:oldBoundHash,...previousProof}=oldProof;
  const limitRepair=automaticFreeRepair?.continuationLimitRepair;
  if(limitRepair!==undefined){
   assert(limitRepair.schema==='sg-ag-evidenced-continuation-limit-v1'
    &&oldPlan.maxSteps===100&&plan.maxSteps===1026&&limitRepair.previousMaxSteps===100&&limitRepair.maxSteps===1026
    &&limitRepair.oldLimitError==='SG_ROUND_STEP_LIMIT'
    &&Number.isSafeInteger(limitRepair.nativePrefixesAtOldLimit)&&limitRepair.nativePrefixesAtOldLimit>0
    &&limitRepair.nativePrefixesAtOldLimit===automaticFreeRepair.nativeFaultPrefixes
    &&Number.isSafeInteger(limitRepair.nativeRemainingMin)&&limitRepair.nativeRemainingMin>0&&limitRepair.nativeRemainingMin<=100,
    'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
   unchangedPlan.maxSteps=oldPlan.maxSteps;
  }
  assert(queueHash(unchangedPlan)===queueHash(oldPlan)&&queueHash(unchangedProof)===queueHash(previousProof)
   &&previousPlanHash===entry.planHash&&oldBoundHash===entry.planHash&&boundHash===planHash,
   'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  assert(balanceContract!==undefined||automaticFreeContract!==undefined||explicitProbeContract!==undefined,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  if(explicitProbeContract!==undefined)assert(['32474','32497'].includes(id)
   &&balanceContract===undefined&&automaticFreeContract===undefined
   &&explicitProbeContract==='nextgen-explicit-request-evidence-v1'&&/^[a-f0-9]{64}$/.test(explicitProbeContractHash??'')
   &&explicitProbeEvidence?.schema==='sg-ag-explicit-request-probe-evidence-v1'
   &&explicitProbeEvidence.contractHash===explicitProbeContractHash
   &&Number.isSafeInteger(explicitProbeEvidence.ownNativePrefixes)&&explicitProbeEvidence.ownNativePrefixes>0
   &&/^[a-f0-9]{64}$/.test(explicitProbeEvidence.nativeEvidenceHash??'')
   &&/^[a-f0-9]{64}$/.test(explicitProbeEvidence.historicalEvidenceHash??'')
   &&explicitProbeEvidence.independentJsPython===true&&explicitProbeEvidence.fullSpecialTerminalsObserved===0
   &&explicitProbeEvidence.settlementApproved===false
   &&explicitProbeEvidence.maxReviewedContinuations===(id==='32474'?2:1)
   &&explicitProbeEvidence.sourceRequests===0&&explicitProbeEvidence.mongoWrites===0&&explicitProbeEvidence.failedRoundsCredited===0,
   'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  else assert(explicitProbeContractHash===undefined&&explicitProbeEvidence===undefined,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  if(balanceContract!==undefined)assert(balanceContract==='nextgen-held-award-balance-v1'&&/^[a-f0-9]{64}$/.test(balanceContractHash??'')
   &&balanceRepair?.schema==='sg-ag-balance-repair-evidence-v1'&&balanceRepair.contractHash===balanceContractHash
   &&Number.isSafeInteger(balanceRepair.nativeRounds)&&balanceRepair.nativeRounds>0
   &&/^[a-f0-9]{64}$/.test(balanceRepair.nativeEvidenceHash??'')&&balanceRepair.independentJsPython===true
   &&balanceRepair.sourceRequests===0&&balanceRepair.mongoWrites===0&&balanceRepair.failedRoundsCredited===0,
   'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  else assert(balanceContractHash===undefined&&balanceRepair===undefined,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  if(automaticFreeContract!==undefined)assert(automaticFreeContract==='nextgen-automatic-nfg-free-v1'
   &&/^[a-f0-9]{64}$/.test(automaticFreeContractHash??'')
   &&automaticFreeRepair?.schema==='sg-ag-automatic-free-repair-evidence-v1'
   &&automaticFreeRepair.contractHash===automaticFreeContractHash
   &&Number.isSafeInteger(automaticFreeRepair.nativeFaultPrefixes)&&automaticFreeRepair.nativeFaultPrefixes>=0
   &&Number.isSafeInteger(automaticFreeRepair.historicalFullRounds)&&automaticFreeRepair.historicalFullRounds>0
   &&/^[a-f0-9]{64}$/.test(automaticFreeRepair.nativeEvidenceHash??'')
   &&/^[a-f0-9]{64}$/.test(automaticFreeRepair.historicalEvidenceHash??'')
   &&automaticFreeRepair.independentJsPython===true&&automaticFreeRepair.sourceRequests===0
   &&automaticFreeRepair.mongoWrites===0&&automaticFreeRepair.failedRoundsCredited===0,
   'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  else assert(automaticFreeContractHash===undefined&&automaticFreeRepair===undefined,'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  return {...entry,planHash,adapterProofHash:proofHash};
 });
}
