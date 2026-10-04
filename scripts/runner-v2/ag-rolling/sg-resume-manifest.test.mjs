import test from 'node:test';
import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {rebaseResumeManifest} from './sg-resume-manifest.mjs';
import fs from 'node:fs';
function fixture(){
 const plan={gameId:32500,trialId:'fixed-trial',sourceKey:'fixed-source',buy:0,betRaw:100,requestParams:{GN:'fixed',BPL:'5',LB:'40'}};
 const proof={planHash:queueHash(plan),acceptedBaseRounds:93,historyFileSha256:'a'.repeat(64),acceptedRawHashes:['b'.repeat(64)]};
 const previousPlans={plans:{32500:plan},proofs:{32500:proof}};
 const previous={payload:{queueId:'queue',games:[{gameId:'32500',campaignId:'retained-campaign',baseline:0}]},
  manifest:[{gameId:'32500',phase:'ready',planHash:queueHash(plan),adapterProofHash:queueHash(proof),campaignId:'retained-campaign'}]};
 const repaired={...structuredClone(plan),balanceContract:'nextgen-held-award-balance-v1',balanceContractHash:'c'.repeat(64)};
 const repairProof={...proof,previousPlanHash:queueHash(plan),planHash:queueHash(repaired),balanceRepair:{
  schema:'sg-ag-balance-repair-evidence-v1',contractHash:'c'.repeat(64),nativeRounds:17,nativeEvidenceHash:'d'.repeat(64),
  independentJsPython:true,sourceRequests:0,mongoWrites:0,failedRoundsCredited:0}};
 return {previous,previousPlans,plans:{plans:{32500:repaired},proofs:{32500:repairProof}}};
}
test('resume forwards only the reviewed repair hashes and leaves the original queue and manifest immutable',()=>{
 const f=fixture(),before=queueHash(f.previous),manifest=rebaseResumeManifest(f);
 assert.equal(queueHash(f.previous),before);assert.equal(manifest[0].campaignId,'retained-campaign');
 assert.equal(manifest[0].planHash,queueHash(f.plans.plans[32500]));assert.equal(manifest[0].adapterProofHash,queueHash(f.plans.proofs[32500]));
});
test('unchanged adapters and completed games keep the exact original manifest',()=>{
 const f=fixture();f.plans=structuredClone(f.previousPlans);f.completedGameIds=['32500'];
 assert.deepEqual(rebaseResumeManifest(f),f.previous.manifest);
});
test('adapter forwarding rejects changed history, source request, quota, evidence, financial identity or credited failed rounds',()=>{
 for(const damage of [f=>f.plans.plans[32500].betRaw++,f=>f.plans.plans[32500].requestParams.BPL='6',
  f=>f.plans.proofs[32500].acceptedRawHashes=[],f=>f.plans.proofs[32500].balanceRepair.failedRoundsCredited=1,
  f=>f.plans.proofs[32500].balanceRepair.independentJsPython=false,
  f=>f.plans.proofs[32500].balanceRepair.sourceRequests=1,f=>f.plans.proofs[32500].balanceRepair.nativeEvidenceHash='missing',
  f=>f.plans.proofs[32500].previousPlanHash='e'.repeat(64)]){
  const f=fixture();damage(f);assert.throws(()=>rebaseResumeManifest(f),/REPAIR_UNREVIEWED/);
 }
});
test('completed adapter changes and any mismatched old immutable binding are refused',()=>{
 const f=fixture();f.completedGameIds=['32500'];assert.throws(()=>rebaseResumeManifest(f),/COMPLETED_ADAPTER_CHANGED/);
 delete f.completedGameIds;f.previousPlans.proofs[32500].acceptedBaseRounds=0;
 assert.throws(()=>rebaseResumeManifest(f),/OLD_ADAPTER_BINDING/);
});
test('a reviewed automatic-free repair needs its own complete historical settlement and preserves previous financial identity',()=>{
 const f=fixture(),p=f.plans.plans[32500],proof=f.plans.proofs[32500];
 p.automaticFreeContract='nextgen-automatic-nfg-free-v1';p.automaticFreeContractHash='f'.repeat(64);proof.planHash=queueHash(p);
 proof.automaticFreeRepair={schema:'sg-ag-automatic-free-repair-evidence-v1',contractHash:'f'.repeat(64),
  nativeFaultPrefixes:51,nativeEvidenceHash:'d'.repeat(64),historicalFullRounds:4,historicalEvidenceHash:'e'.repeat(64),
  independentJsPython:true,sourceRequests:0,mongoWrites:0,failedRoundsCredited:0};
 assert.equal(rebaseResumeManifest(f)[0].planHash,proof.planHash);
 proof.automaticFreeRepair.historicalFullRounds=0;assert.throws(()=>rebaseResumeManifest(f),/REPAIR_UNREVIEWED/);
 proof.automaticFreeRepair.historicalFullRounds=4;proof.automaticFreeRepair.failedRoundsCredited=1;
 assert.throws(()=>rebaseResumeManifest(f),/REPAIR_UNREVIEWED/);
});

test('only an independently reviewed 100-frame truncation can raise the bounded limit without changing its existing namespace',()=>{
 const f=fixture();f.previousPlans.plans[32500].maxSteps=100;
 const old=f.previousPlans.plans[32500],oldProof=f.previousPlans.proofs[32500];oldProof.planHash=queueHash(old);
 f.previous.manifest[0].planHash=queueHash(old);f.previous.manifest[0].adapterProofHash=queueHash(oldProof);
 const p=f.plans.plans[32500],proof=f.plans.proofs[32500];p.maxSteps=1026;
 p.automaticFreeContract='nextgen-automatic-nfg-free-v1';p.automaticFreeContractHash='f'.repeat(64);
 proof.previousPlanHash=queueHash(old);proof.planHash=queueHash(p);
 proof.automaticFreeRepair={schema:'sg-ag-automatic-free-repair-evidence-v1',contractHash:'f'.repeat(64),
  nativeFaultPrefixes:6,nativeEvidenceHash:'d'.repeat(64),historicalFullRounds:99,historicalEvidenceHash:'e'.repeat(64),
  independentJsPython:true,sourceRequests:0,mongoWrites:0,failedRoundsCredited:0,
  continuationLimitRepair:{schema:'sg-ag-evidenced-continuation-limit-v1',previousMaxSteps:100,maxSteps:1026,
   oldLimitError:'SG_ROUND_STEP_LIMIT',nativePrefixesAtOldLimit:6,nativeRemainingMin:4}};
 const before=queueHash(f);assert.equal(rebaseResumeManifest(f)[0].planHash,proof.planHash);assert.equal(queueHash(f),before);
 for(const damage of [x=>delete x.plans.proofs[32500].automaticFreeRepair.continuationLimitRepair,
  x=>x.plans.plans[32500].maxSteps=1027,x=>x.plans.proofs[32500].automaticFreeRepair.continuationLimitRepair.nativeRemainingMin=0,
  x=>x.plans.proofs[32500].automaticFreeRepair.continuationLimitRepair.nativePrefixesAtOldLimit=5]){
  const altered=structuredClone(f);damage(altered);assert.throws(()=>rebaseResumeManifest(altered),/REPAIR_UNREVIEWED/);
 }
});
test('an explicit probe preserves its old ordinary proof and permits only the reviewed request boundary, never special settlement',()=>{
 const r=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json','utf8'));
 for(const id of ['32474','32497']){
  const plan=r.plans[id],proof=r.proofs[id],{explicitProbeContract,explicitProbeContractHash,explicitContinuationContract,explicitContinuationContractHash,explicitDragonContract,explicitDragonContractHash,carnivalPickContract,carnivalPickContractHash,dragonEndContract,dragonEndContractHash,...oldPlan}=plan;
  const {previousPlanHash,explicitProbeEvidence,explicitContinuationEvidence,explicitDragonEvidence,carnivalPickEvidence,dragonEndEvidence,...oldProof}=proof;oldProof.planHash=previousPlanHash;
  const previous={manifest:[{gameId:id,planHash:queueHash(oldPlan),adapterProofHash:queueHash(oldProof),campaignId:'same-namespace'}]};
  const f={previous,previousPlans:{plans:{[id]:structuredClone(oldPlan)},proofs:{[id]:structuredClone(oldProof)}},plans:{plans:{[id]:plan},proofs:{[id]:proof}}};
  const before=queueHash(f);assert.equal(rebaseResumeManifest(f)[0].planHash,queueHash(plan));assert.equal(queueHash(f),before);
  for(const damage of [v=>v.plans.proofs[id].explicitProbeEvidence.settlementApproved=true,
   v=>v.plans.proofs[id].explicitProbeEvidence.maxReviewedContinuations++,
   v=>v.plans.proofs[id].explicitProbeEvidence.failedRoundsCredited=1,
   v=>v.plans.proofs[id].acceptedRawHashes=[],v=>v.plans.plans[id].requestParams.GN='foreign']){
   const bad=structuredClone(f);damage(bad);assert.throws(()=>rebaseResumeManifest(bad),/REPAIR_UNREVIEWED/);
  }
  assert.throws(()=>rebaseResumeManifest({...f,completedGameIds:[id]}),/COMPLETED_ADAPTER_CHANGED/);
 }
});
