import assert from 'node:assert/strict';
import path from 'node:path';
import {openWorkLineEvidence} from './work-line-sealed-evidence.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {validateLinuxPreparationTask,deliverLinuxPreparationTask} from './preparation-linux-evidence.mjs';
import {validateNativeRepairReplay} from './native-repair-replay.mjs';
import {preparationRevision} from './preparation-revision.mjs';
import fs from 'node:fs';
import {validatePreparedStockReview} from './prepared-stock-review.mjs';
import {validatePreparedCountReview} from './prepared-count-review.mjs';
import {validateCaptureFault} from './capture-fault-delivery.mjs';
import {validateConfirmedFlowEvidence} from './confirmed-flow-evidence.mjs';
import {bindNativeRepairAdvance} from './work-line-events.mjs';

export function evidenceOrigin(run,repository){
 assert(['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(repository)
  &&run.repository?.full_name===repository&&run.head_repository?.full_name===repository
  &&run.head_branch==='main'&&run.event==='workflow_dispatch'
  &&['.github/workflows/work-line-evidence.yml','.github/workflows/trial-300k.yml','.github/workflows/preflight.yml'].includes(run.path)
  &&(run.path!=='.github/workflows/preflight.yml'||run.status==='completed'&&run.conclusion==='success')
  &&Number.isSafeInteger(run.id)&&Number.isSafeInteger(run.run_attempt)&&run.run_attempt>=1
  &&/^[a-f0-9]{40}$/.test(run.head_sha),'EVIDENCE_RUN_SCOPE');
 return {repository,runId:String(run.id),attempt:String(run.run_attempt),commit:run.head_sha,workflow:run.path};
}

export function receiveSealedEvidence({root,sealed,privateKey,origin}){
 const value=openWorkLineEvidence(sealed,privateKey,origin);
 // Validate the entire delivery before creating any inbox item. Neither
 // encryption nor a trusted workflow grants a preparation proof or quota.
 for(const task of value.tasks){
  assert(task.sourceAllowance===0,'EVIDENCE_TASK_ALLOWANCE');
  if(task.schema==='sg-prepared-count-review-task-v1'){
   validatePreparedCountReview(task);
   const plans=JSON.parse(fs.readFileSync(path.join(root,'config/round-one-plans.json'),'utf8'));
   assert(origin.workflow==='.github/workflows/work-line-evidence.yml'
    &&origin.repository==='zyzuoyang/sg-capture-runner'&&task.gameId===32714&&task.group==='primary'
    &&task.trialId===plans[32714].trialId&&task.basePlanHash===hash(plans[32714])
    &&task.publicationHash===hash(JSON.parse(fs.readFileSync(path.join(root,'config/prepared-inventory.json'),'utf8'))),
    'PREPARED_COUNT_REVIEW_SCOPE');
  }else if(task.schema==='sg-prepared-stock-review-task-v1'){
   validatePreparedStockReview(task);
   assert(origin.workflow==='.github/workflows/work-line-evidence.yml','PREPARED_STOCK_ORIGIN');
   assert(task.report.publicationHash===hash(JSON.parse(fs.readFileSync(path.join(root,'config/prepared-inventory.json'),'utf8'))),
    'PREPARED_STOCK_PUBLICATION_CHANGED');
  }else if(task.schema==='sg-native-repair-replay-task-v1'){
   validateNativeRepairReplay(task);
   assert(origin.workflow==='.github/workflows/work-line-evidence.yml','NATIVE_REPAIR_DELIVERY_ORIGIN');
   const index=JSON.parse(fs.readFileSync(path.join(root,'.local/preparation-worker/repair/feature-index.json'),'utf8'));
   assert(preparationRevision(root,task.gameId,index.games.find(g=>g.gameId===task.gameId)).revisionHash===task.revisionHash,
    'NATIVE_REPAIR_DELIVERY_REVISION_CHANGED');
  }else if(task.schema==='sg-preparation-linux-task-v1'){
   validateLinuxPreparationTask(root,task,origin);
  }else if(task.schema==='sg-confirmed-flow-evidence-v1'){
   validateConfirmedFlowEvidence(task);
  }else if(task.schema==='sg-confirmed-round-analysis-task-v1'){
   assert(task.gameId===task.plan?.gameId&&task.planHash===hash(task.plan)
    &&task.recordHash===hash(task.record)&&hash(task.readback)===hash(task.record),'EVIDENCE_TASK_SCOPE');
  }else {
   assert(task.schema==='sg-capture-fault-export-v1'&&task.plan&&task.receipt&&task.archive&&task.publication,'EVIDENCE_TASK_SCOPE');
   validateCaptureFault(root,task);
  }
 }
 const mailboxes=value.tasks.map(task=>{
  if(task.schema==='sg-prepared-count-review-task-v1')return publishImmutableInbox(
   path.join(root,'.local/preparation-worker/admission/count-reviews'),{...task,origin});
  if(task.schema==='sg-prepared-stock-review-task-v1')return publishImmutableInbox(
   path.join(root,'.local/capture-handoff-worker/online-reviews'),{...task,origin});
  if(task.schema==='sg-preparation-linux-task-v1')return deliverLinuxPreparationTask(root,task,origin).mailbox;
  if(task.schema==='sg-native-repair-replay-task-v1'){
   const transition=task.repairTransition;
   const event={schema:'sg-work-line-event-v1',kind:transition?'native-repair-advanced':task.captureLink?'native-repair-settled':'native-repair-observed',gameId:task.gameId,
    ...(transition?{previousRepairKey:transition.previousRepairKey,previousFailureEvidenceHash:transition.previousFailureEvidenceHash,
      rejectedProofHash:transition.rejectedProofHash}:{}),
    ...(task.captureLink?{captureFailureEvidenceHash:task.captureLink.failureEvidenceHash,rejectedProofHash:task.captureLink.rejectedProofHash}:{}),
    evidenceHash:task.failureEvidenceHash,repairKey:task.manifest.repairKey,sourceAllowance:0};
   for(const lane of ['admission','repair']){
    let laneEvent=event;
    if(transition){
     const file=path.join(root,'.local/preparation-worker',lane,'inventory.json');
     const current=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).tasks.find(t=>t.gameId===task.gameId):null;
     laneEvent=bindNativeRepairAdvance(event,current);
    }
    publishImmutableInbox(path.join(root,'.local/preparation-worker',lane,'inbox'),laneEvent);
   }
   return publishImmutableInbox(path.join(root,'.local/preparation-worker/repair/evidence-inbox'),validateNativeRepairReplay(task));
  }
  return publishImmutableInbox(path.join(root,'.local','capture-handoff-worker','inbox'),task);
 });
 return {status:'sealed-evidence-delivered',origin,mailboxes,tasks:mailboxes.length,sourceRequests:0,mongoWrites:0};
}
