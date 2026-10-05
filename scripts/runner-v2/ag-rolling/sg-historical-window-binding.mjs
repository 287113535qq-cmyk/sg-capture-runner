import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const repos={primary:'zyzuoyang/sg-capture-runner',secondary:'287113535qq-cmyk/sg-capture-runner'};
const lane=n=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(n);
export const closureKey=r=>`rolling-window-close:${r.targetActivation}:${r.targetRun}`;
export function assertWindowJobScope(env){
 assert(env.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Linux'&&env.RUNNER_ENVIRONMENT==='github-hosted'
  &&env.GITHUB_REPOSITORY===repos.primary&&env.GITHUB_JOB==='ag-rolling-window-close'
  &&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_RUN_ATTEMPT==='1'&&/^[0-9]+$/.test(env.GITHUB_RUN_ID??'')
  &&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')&&env.SG_TRIAL_DEMO_CONFIG===undefined
  &&env.SG_AG_LANE===undefined&&env.SG_AG_COORDINATOR_RUN===undefined,'SG_AG_WINDOW_GITHUB_SCOPE');
}
export function inspectWindowRecovery(profile,target){
 const r=profile.windowRecovery;
 assert(profile.operation==='close-ended-window'&&profile.sourceAllowance===0&&profile.federation
  &&!profile.resume&&!profile.append&&!profile.preparationRecovery&&r?.schema==='sg-ag-ended-window-recovery-v1'
  &&Object.keys(r).sort().join(',')==='completedProofs,finalizerJobId,nativeSourceHash,participantHash,permitHash,schema,targetActivation,targetCommit,targetProfileHash,targetRun'
  &&/^[0-9]+:1$/.test(r.targetRun??'')&&/^[a-f0-9]{40}$/.test(r.targetCommit??'')
  &&['targetActivation','targetProfileHash','nativeSourceHash','permitHash','participantHash'].every(k=>/^[a-f0-9]{64}$/.test(r[k]??''))
  &&Number.isSafeInteger(r.finalizerJobId)&&r.finalizerJobId>0
  &&Array.isArray(r.completedProofs)&&r.completedProofs.length>0
  &&new Set(r.completedProofs.map(p=>p.gameId)).size===r.completedProofs.length
  &&r.completedProofs.every(p=>Object.keys(p).sort().join(',')==='gameId,receiptHash,recordsHash'
   &&profile.payload.games.some(g=>g.gameId===p.gameId)&&/^[a-f0-9]{64}$/.test(p.receiptHash??'')&&/^[a-f0-9]{64}$/.test(p.recordsHash??'')),
  'SG_AG_WINDOW_RECOVERY_PROFILE');
 if(target)assert(!target.operation&&r.targetActivation===target.activation&&r.targetProfileHash===hash(target)
  &&r.targetActivation!==profile.activation&&hash(profile.payload)===hash(target.payload)
  &&hash(profile.manifest)===hash(target.manifest)&&hash(profile.federation)===hash(target.federation)
  &&profile.nativeGatewayHash===target.nativeGatewayHash&&profile.nativeManifestHash===target.nativeManifestHash,
  'SG_AG_WINDOW_RECOVERY_TARGET_CHANGED');
 return r;
}
export function inspectUnexecutedFinalizer(jobs,r){
 const rows=jobs.jobs.filter(j=>j.name==='ag-rolling-finalize');
 assert(rows.length===1&&rows[0].id===r.finalizerJobId&&rows[0].status==='completed'
  &&rows[0].conclusion==='cancelled'&&rows[0].runner_id===0&&Array.isArray(rows[0].steps)&&rows[0].steps.length===0,
  'SG_AG_WINDOW_FINALIZER_EXECUTED_OR_CHANGED');
 return rows[0];
}
export async function inspectEndedCaptureActors({target,r,participant,readEnded,readEndedJobs}){
 const out={};
 for(const [cohort,run] of [['primary',r.targetRun],['secondary',participant.run]]){
  const repo=repos[cohort],id=run.split(':')[0],workflow=await readEnded(id,repo),jobs=await readEndedJobs(id,repo);
  assert(workflow?.id===Number(id)&&workflow.run_attempt===1&&workflow.status==='completed'
   &&workflow.head_branch==='main'&&workflow.head_sha===r.targetCommit&&workflow.event==='workflow_dispatch'
   &&workflow.repository?.full_name===repo&&workflow.path==='.github/workflows/trial-300k.yml','SG_AG_WINDOW_TARGET_ACTOR_CHANGED');
  assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),
   'SG_AG_WINDOW_TARGET_JOBS_ACTIVE');
  const lanes=jobs.jobs.filter(j=>lane(j.name)),control=cohort==='primary'?'ag-rolling-admit':'ag-rolling-join';
  assert(lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20
   &&jobs.jobs.filter(j=>j.name===control&&j.conclusion==='success').length===1
   &&jobs.jobs.filter(j=>j.conclusion!=='skipped').every(j=>lane(j.name)||j.name===control||cohort==='primary'&&j.name==='ag-rolling-finalize'),
   'SG_AG_WINDOW_TARGET_CONTROL_CHANGED');
  if(cohort==='primary')inspectUnexecutedFinalizer(jobs,r);
  out[cohort]={workflow,jobs};
 }
 assert(hash(participant)===r.participantHash&&participant.coordinatorRun===r.targetRun
  &&participant.commit===r.targetCommit&&participant.activation===target.activation,'SG_AG_WINDOW_PARTICIPANT_CHANGED');
 return out;
}
// A separately successful source-free job can close only its registered target.
// The cancelled original finalizer is never represented as a successful job.
export async function verifyRecoveryEnding({previous,prior,receipt,participant,store,readEnded,readEndedJobs,readRecoveryProfile}){
 const c=receipt.closure;
 assert(c?.schema==='sg-ag-window-closure-actor-v1'&&c.operation==='close-ended-window'
  &&/^[0-9]+:1$/.test(c.run??'')&&c.run!==prior.run&&/^[a-f0-9]{40}$/.test(c.commit??'')
  &&typeof readRecoveryProfile==='function','SG_AG_WINDOW_CLOSURE_ACTOR_REQUIRED');
 const profile=await readRecoveryProfile(c.activation),r=inspectWindowRecovery(profile,previous);
 assert(hash(profile)===c.profileHash&&r.targetRun===prior.run&&r.targetCommit===prior.commit
  &&r.permitHash===hash(prior)&&c.codeCommit===profile.codeCommit&&c.linuxRun===profile.linuxRun,
  'SG_AG_WINDOW_CLOSURE_PROFILE_CHANGED');
 await inspectEndedCaptureActors({target:previous,r,participant,readEnded,readEndedJobs});
 const intent=(await store.get('journal',closureKey(r)))?.value,complete=(await store.get('journal',closureKey(r)+':complete'))?.value;
 assert(intent?.schema==='sg-ag-window-close-intent-v1'&&intent.run===c.run&&intent.commit===c.commit
  &&intent.profileHash===c.profileHash&&intent.targetRun===prior.run&&intent.targetCommit===prior.commit
  &&intent.targetSourceHash===r.nativeSourceHash&&intent.permitHash===r.permitHash&&intent.participantHash===r.participantHash
  &&hash(intent)===c.intentHash&&complete?.schema==='sg-ag-window-close-complete-v1'
  &&complete.intentHash===c.intentHash&&complete.receiptHash===hash(receipt)&&complete.run===c.run&&complete.commit===c.commit,
  'SG_AG_WINDOW_CLOSURE_DURABLE_PROOF_CHANGED');
 const id=c.run.split(':')[0],workflow=await readEnded(id,repos.primary),jobs=await readEndedJobs(id,repos.primary);
 assert(workflow?.id===Number(id)&&workflow.run_attempt===1&&workflow.status==='completed'&&workflow.conclusion==='success'
  &&workflow.head_branch==='main'&&workflow.head_sha===c.commit&&workflow.event==='workflow_dispatch'
  &&workflow.repository?.full_name===repos.primary&&workflow.path==='.github/workflows/trial-300k.yml'
  &&jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed')
  &&jobs.jobs.filter(j=>j.conclusion!=='skipped').length===1
  &&jobs.jobs.filter(j=>j.name==='ag-rolling-window-close'&&j.conclusion==='success'&&j.runner_id>0).length===1,
  'SG_AG_WINDOW_CLOSURE_NOT_ACTUALLY_SUCCESSFUL');
 return {run:c.run,commit:c.commit,sourceRequests:0};
}
