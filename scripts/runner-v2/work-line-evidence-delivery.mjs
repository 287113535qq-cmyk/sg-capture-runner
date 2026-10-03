import assert from 'node:assert/strict';
import path from 'node:path';
import {openWorkLineEvidence} from './work-line-sealed-evidence.mjs';
import {publishImmutableInbox} from './work-line-mailbox.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

export function evidenceOrigin(run,repository){
 assert(['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(repository)
  &&run.repository?.full_name===repository&&run.head_repository?.full_name===repository
  &&run.head_branch==='main'&&run.event==='workflow_dispatch'
  &&['.github/workflows/work-line-evidence.yml','.github/workflows/trial-300k.yml'].includes(run.path)
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
  if(task.schema==='sg-confirmed-round-analysis-task-v1'){
   assert(task.gameId===task.plan?.gameId&&task.planHash===hash(task.plan)
    &&task.recordHash===hash(task.record)&&hash(task.readback)===hash(task.record),'EVIDENCE_TASK_SCOPE');
  }else assert(task.schema==='sg-capture-fault-export-v1'&&task.plan&&task.receipt&&task.archive&&task.publication,'EVIDENCE_TASK_SCOPE');
 }
 const mailboxes=value.tasks.map(task=>publishImmutableInbox(path.join(root,'.local','capture-handoff-worker','inbox'),task));
 return {status:'sealed-evidence-delivered',origin,mailboxes,tasks:mailboxes.length,sourceRequests:0,mongoWrites:0};
}
