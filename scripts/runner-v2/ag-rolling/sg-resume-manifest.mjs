import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
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
  const {balanceContract,balanceContractHash,...unchangedPlan}=plan;
  const {planHash:boundHash,previousPlanHash,balanceRepair,...unchangedProof}=proof;
  const {planHash:oldBoundHash,...previousProof}=oldProof;
  assert(queueHash(unchangedPlan)===queueHash(oldPlan)&&queueHash(unchangedProof)===queueHash(previousProof)
   &&previousPlanHash===entry.planHash&&oldBoundHash===entry.planHash&&boundHash===planHash
   &&balanceContract==='nextgen-held-award-balance-v1'&&/^[a-f0-9]{64}$/.test(balanceContractHash??'')
   &&balanceRepair?.schema==='sg-ag-balance-repair-evidence-v1'&&balanceRepair.contractHash===balanceContractHash
   &&Number.isSafeInteger(balanceRepair.nativeRounds)&&balanceRepair.nativeRounds>0
   &&/^[a-f0-9]{64}$/.test(balanceRepair.nativeEvidenceHash??'')&&balanceRepair.independentJsPython===true
   &&balanceRepair.sourceRequests===0&&balanceRepair.mongoWrites===0&&balanceRepair.failedRoundsCredited===0,
   'SG_RESUME_ADAPTER_REPAIR_UNREVIEWED');
  return {...entry,planHash,adapterProofHash:proofHash};
 });
}
