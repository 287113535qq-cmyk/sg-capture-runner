import assert from 'node:assert/strict';
import {digest} from './sg-business-delivery.mjs';
export function verifyValidationEndedActor(run,jobs,spec){
 assert(run.id===spec.previousRun&&run.run_attempt===1&&run.head_sha===spec.previousCommit
  &&run.head_branch==='sg-business-delivery-20261005'&&run.repository?.full_name==='zyzuoyang/sg-capture-runner'
  &&run.path==='.github/workflows/trial-300k.yml'&&run.event==='workflow_dispatch'
  &&run.status==='completed'&&run.conclusion==='failure','SG_BUSINESS_RECOVERY_ENDED_ACTOR');
 assert(jobs.total_count===44&&jobs.jobs?.length===44&&new Set(jobs.jobs.map(j=>j.id)).size===44
  &&jobs.jobs.every(j=>j.run_id===run.id&&j.status==='completed'),'SG_BUSINESS_RECOVERY_ENDED_JOBS');
 const executed=jobs.jobs.filter(j=>j.conclusion!=='skipped');
 assert(executed.length===1&&executed[0].id===spec.previousJob&&executed[0].name==='ag-rolling-business-delivery'
  &&executed[0].conclusion==='failure','SG_BUSINESS_RECOVERY_BUSINESS_ACTOR');
 return {run:run.id,commit:run.head_sha,allJobsEnded:true,sourceAllowance:0};
}
export async function requireValidationEndedActor(spec,token,fetchImpl=fetch){
 assert(token,'SG_BUSINESS_RECOVERY_AUTH');
 const base=`https://api.github.com/repos/zyzuoyang/sg-capture-runner/actions/runs/${spec.previousRun}`;
 async function read(url){const r=await fetchImpl(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(45000)});assert(r.status===200,'SG_BUSINESS_RECOVERY_READ_STOP_NO_RETRY');return r.json();}
 return verifyValidationEndedActor(await read(base),await read(base+'/jobs?filter=all&per_page=100'),spec);
}
export function verifyValidationRecoveryReadback({spec,claim,backup,auditKeys,originals,campaignCount,proofHash}){
 assert(spec.schema==='sg-business-validation-recovery-v1'&&spec.gameId==='32442'&&spec.previousOwner===spec.previousRun+':1:business'
  &&proofHash===spec.proofHash&&claim?._id===spec.claimId&&claim.owner===spec.previousOwner&&claim.status==='validating'
  &&digest(claim)===spec.claimHash,'SG_BUSINESS_RECOVERY_CLAIM_CHANGED');
 assert(auditKeys.length===2&&new Set(auditKeys).size===2&&auditKeys.includes(spec.claimId)&&auditKeys.includes(spec.backupKey)
  &&backup?._id===spec.backupKey&&backup.owner===spec.previousOwner&&backup.immutable===true
  &&backup.documentsHash===spec.originalHash&&digest(backup.documents)===spec.originalHash
  &&originals.length===spec.originalCount&&digest(originals)===spec.originalHash&&campaignCount===0,'SG_BUSINESS_RECOVERY_WRITE_STATE_CHANGED');
 return {previousOwner:spec.previousOwner,claimHash:spec.claimHash,baselineHash:spec.originalHash,baselineCount:originals.length,
  previousCampaignWrites:0,previousWriteIntents:0,previousAcks:0,previousActorEnded:true};
}
