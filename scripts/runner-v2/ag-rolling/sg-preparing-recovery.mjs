import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
// An ended admission issued no game request and granted no source permit.
// Seal its exact native claim; preserve all task/prefix/unknown evidence.
export async function verifyPreparingRecovery({profile,target,store,readEnded,readEndedJobs,now=Date.now}){
 const r=profile.preparationRecovery;
 assert(r?.schema==='sg-ag-preparing-recovery-v1'&&/^[0-9]+:1$/.test(r.targetRun??'')&&/^[a-f0-9]{40}$/.test(r.targetCommit??'')
  &&/^[a-f0-9]{64}$/.test(r.nativeSourceHash??'')&&target?.activation===r.targetActivation&&queueHash(target)===r.targetProfileHash
  &&queueHash(profile.payload)===queueHash(target.payload)&&queueHash(profile.manifest)===queueHash(target.manifest)
  &&queueHash(profile.resume)===queueHash(target.resume)&&queueHash(profile.append??null)===queueHash(target.append??null),
  'SG_PREPARING_RECOVERY_BINDING');
 const run=await readEnded(r.targetRun.split(':')[0]),jobs=await readEndedJobs(r.targetRun.split(':')[0]);
 assert(run?.id===Number(r.targetRun.split(':')[0])&&run.run_attempt===1&&run.status==='completed'&&run.head_sha===r.targetCommit
  &&run.repository?.full_name==='zyzuoyang/sg-capture-runner'&&run.path==='.github/workflows/trial-300k.yml'
  &&run.event==='workflow_dispatch'&&run.conclusion!=='success','SG_PREPARING_ACTOR_NOT_ENDED');
 // GitHub materializes two unstarted dependants when cancelling admission.
 // A literal unexpanded matrix plus null runner identity and empty steps is
 // not a source lane. Never extend this exception to a numbered/started lane.
 const unstartedCancellation=j=>run.conclusion==='cancelled'&&j.conclusion==='cancelled'
  &&['AG rolling lane ${{ matrix.lane }}','ag-rolling-finalize'].includes(j.name)
  &&j.run_id===run.id&&j.head_sha===r.targetCommit&&j.runner_id===null&&j.runner_name===null
  &&j.runner_group_id===null&&Array.isArray(j.steps)&&j.steps.length===0;
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count>0&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed')
  &&jobs.jobs.filter(j=>j.conclusion!=='skipped'&&!unstartedCancellation(j)).length===1&&jobs.jobs.some(j=>j.name==='ag-rolling-admit'
   &&(j.conclusion==='failure'||j.conclusion==='cancelled'&&run.conclusion==='cancelled')),
  'SG_PREPARING_SOURCE_JOB_STARTED');
 const source=await store.get('state','rolling-source');
 assert(source?.value.status==='preparing'&&source.value.owner===r.targetRun&&source.value.commit===r.targetCommit
  &&source.value.activation===r.targetActivation&&source.value.queueId===target.payload.queueId
  &&queueHash(source.value)===r.nativeSourceHash,'SG_PREPARING_NATIVE_CHANGED');
 const started=(await store.get('journal','rolling-activation:'+r.targetActivation))?.value;
 assert(started?.schema==='sg-ag-rolling-activation-v1'&&started.run===r.targetRun&&started.commit===r.targetCommit
  &&started.activation===r.targetActivation&&started.queueId===target.payload.queueId&&started.profileHash===queueHash(target)
  &&started.sourceRequests===0&&!await store.get('journal','rolling-activation:'+r.targetActivation+':complete'),
  'SG_PREPARING_SOURCE_PERMIT_EXISTS');
 const keys=target.payload.games.flatMap(game=>[
  ...[1,2].map(index=>stagingLeaseKey(target.payload.queueId,game,'canary',index)),
  ...Array.from({length:20},(_,i)=>stagingLeaseKey(target.payload.queueId,game,'worker',i+1))]);
 for(let i=0;i<keys.length;i+=100){const page=keys.slice(i,i+100),rows=await store.getMany('state',page);
  assert(rows.length===page.length&&rows.every(d=>!d||d.value.expiresAt<=now()),'SG_PREPARING_LIVE_LEASE');
 }
 return {source,receipt:{schema:'sg-ag-zero-source-admission-ended-v1',queueId:target.payload.queueId,
  targetRun:r.targetRun,targetCommit:r.targetCommit,targetActivation:r.targetActivation,targetProfileHash:r.targetProfileHash,
  nativeSourceHash:r.nativeSourceHash,activationReceiptHash:queueHash(started),endedJobsHash:queueHash(jobs.jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion}))),
  previousWindow:profile.resume,sourceJobsStarted:0,sourceRequests:0,taskWrites:0,roundWrites:0,
  retainedTasksAndPrefixes:true,unknownOrUnfinishedSource:'retained-unreplayed-unaccounted'}};
}
