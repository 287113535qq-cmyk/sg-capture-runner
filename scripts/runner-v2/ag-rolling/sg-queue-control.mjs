import assert from 'node:assert/strict';
import {prepareTasks,taskKey} from './sg-task-store.mjs';
import {queueHash} from './sg-queue-profile.mjs';
// Queue-wide writes happen once at admission/finalization, never per round.
export async function activateQueue({profile,store,transport,boundary,checkBaselines,readLinux,readEnded,prepareResume,commit,run,now=Date.now}){
 assert(/^\d+:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit),'SG_QUEUE_RUN');
 await boundary();
 const linux=await readLinux(profile.linuxRun);
 assert(linux?.status==='completed'&&linux.conclusion==='success'&&linux.head_sha===profile.codeCommit
  &&linux.path==='.github/workflows/preflight.yml','SG_QUEUE_LINUX_RECEIPT');
 const hello=await transport.request('hello');
 assert(hello?.database==='sg_capture_staging_v1'&&hello.rollingJournalBatchEnabled===true,'SG_QUEUE_NATIVE_CAPABILITY');
 assert(hello.group==='primary'&&hello.rollingCleanupEnabled===true&&hello.gatewaySha256===profile.nativeGatewayHash
  &&hello.accessManifestHash===profile.nativeManifestHash,'SG_QUEUE_NATIVE_INSTALLATION_CHANGED');
 let ended;
 if(profile.resume){
  const resume=profile.resume;
  assert(/^[a-f0-9]{64}$/.test(resume.previousActivation??'')&&/^[0-9]+:1$/.test(resume.previousRun??'')
   &&/^[a-f0-9]{64}$/.test(resume.endedProofHash??'')&&typeof readEnded==='function'
   &&typeof prepareResume==='function','SG_QUEUE_RESUME_BINDING');
  const prior=(await store.get('journal','rolling-activation:'+resume.previousActivation+':complete'))?.value;
  const receipt=(await store.get('journal',`rolling-ended:${profile.payload.queueId}:${resume.previousRun}`))?.value;
  const native=(await store.get('state','rolling-source'))?.value;
  assert(prior?.run===resume.previousRun&&prior.queueId===profile.payload.queueId
   &&receipt?.schema==='sg-ag-rolling-window-ended-v1'&&receipt.run===prior.run&&receipt.commit===prior.commit
   &&receipt.activation===resume.previousActivation&&queueHash(receipt)===resume.endedProofHash
   &&native?.status==='idle'&&native.owner===null&&native.lastRun===prior.run
   &&native.lastQueueId===prior.queueId&&native.endedProofHash===resume.endedProofHash,'SG_QUEUE_ENDED_RECEIPT');
  const workflow=await readEnded(resume.previousRun.split(':')[0]);
  assert(workflow?.status==='completed'&&workflow.head_sha===prior.commit,'SG_QUEUE_PREVIOUS_SOURCE_ACTIVE');
  ended={status:workflow.status,sourceJobsEnded:true,run:prior.run,queueId:prior.queueId,proofHash:resume.endedProofHash};
 }
 await checkBaselines(profile,ended);
 const queueId=profile.payload.queueId,activationKey='rolling-activation:'+profile.activation;
 assert(!await store.get('journal',activationKey+':complete'),'SG_QUEUE_ALREADY_ACTIVATED');
 const lease=await store.create('state','rolling-source',{owner:null,queueId:null,status:'idle'});
 assert(lease.value.owner===null&&lease.value.status==='idle','SG_ROLLING_SOURCE_BUSY');
 const state={owner:run,queueId,status:'preparing',activation:profile.activation,commit,
  expiresAt:now()+370*60000};
 // Unknown CAS is not retried. The next controller reads this exact receipt
 // and the ended workflow before recovering zero-source preparation.
 assert(await store.cas('state','rolling-source',lease,state),'SG_ROLLING_SOURCE_RACE');
 await store.create('journal',activationKey,{schema:'sg-ag-rolling-activation-v1',queueId,activation:profile.activation,
  profileHash:queueHash(profile),commit,run,sourceRequests:0},{immutable:true});
 let lastBoundary=now();
 const preparing=async()=>{
  await store.writable();if(now()-lastBoundary>=15000){await boundary();lastBoundary=now();}
  const current=(await store.get('state','rolling-source'))?.value;
  assert(current?.owner===run&&current.queueId===queueId&&current.status==='preparing','SG_QUEUE_OWNERSHIP');
 };
 for(const game of profile.payload.games){
  const first=await store.get('state',taskKey(queueId,game,'canary:1'));
  if(ended&&first)await prepareResume({game,queueId,ended,guard:preparing});
  else await prepareTasks({store,transport,game,queueId,guard:preparing});
 }
 await boundary();
 const before=await store.get('state','rolling-source');
 assert(before.value.owner===run&&before.value.status==='preparing'&&before.value.activation===profile.activation,'SG_QUEUE_OWNERSHIP');
 const permit={schema:'sg-ag-rolling-permit-v1',queueId,run,commit,activation:profile.activation,
  profileHash:queueHash(profile),startsAt:now(),expiresAt:now()+370*60000};
 await store.create('journal',activationKey+':complete',permit,{immutable:true});
 assert(queueHash((await store.get('journal',activationKey+':complete'))?.value)===queueHash(permit),'SG_QUEUE_PERMIT_READBACK');
 assert(await store.cas('state','rolling-source',before,{...state,status:'running',expiresAt:permit.expiresAt}),'SG_QUEUE_OWNERSHIP');
 return {queueId,games:profile.payload.games.length,lanes:20,sessionsPerLane:8,run,commit,sourceRequests:0};
}
export async function sourcePermit({profile,store,run,commit,sourceJobsEnded=false,now=Date.now}){
 const permit=(await store.get('journal','rolling-activation:'+profile.activation+':complete'))?.value;
 const source=(await store.get('state','rolling-source'))?.value;
 assert(permit?.schema==='sg-ag-rolling-permit-v1'&&permit.queueId===profile.payload.queueId&&permit.run===run
  &&permit.commit===commit&&permit.activation===profile.activation&&permit.profileHash===queueHash(profile)
  &&Number.isFinite(permit.startsAt)&&Number.isFinite(permit.expiresAt)&&permit.startsAt<=now()
  &&(now()<permit.expiresAt||sourceJobsEnded===true)
  &&source?.status==='running'&&source.owner===run&&source.queueId===permit.queueId
  &&source.commit===commit&&source.activation===profile.activation,'SG_AG_SOURCE_PERMISSION');
 return permit;
}
export async function readTasks({store,game,queueId}){
 const ids=[...['canary:1','canary:2'],...Array.from({length:20},(_,i)=>'worker:'+(i+1))];
 const rows=await store.getMany('state',ids.map(id=>taskKey(queueId,game,id)));
 assert(rows.length===22&&rows.every((r,i)=>r?.value._id===ids[i]&&r.value.queueId===queueId
  &&r.value.campaignId===game.campaignId),'SG_AG_TASK_INVENTORY');return rows.map(r=>r.value);
}
