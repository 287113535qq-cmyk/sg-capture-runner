import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {verifyPreparingRecovery} from './sg-preparing-recovery.mjs';
// This GitHub operation closes only an ended, proven zero-source admission.
// It neither ends a capture window nor edits tasks, leases or saved rounds.
export async function closePreparation({profile,target,store,transport,boundary,readEnded,readEndedJobs,commit,run,now=Date.now}){
 assert(profile.operation==='close-ended-admission'&&profile.sourceAllowance===0&&!profile.federation,'SG_AG_CLOSE_PROFILE');
 await boundary();const hello=await transport.request('hello');
 assert(hello?.group==='primary'&&hello.gatewaySha256===profile.nativeGatewayHash&&hello.accessManifestHash===profile.nativeManifestHash,'SG_AG_CLOSE_NATIVE_CHANGED');
 const recovery=await verifyPreparingRecovery({profile,target,store,readEnded,readEndedJobs,now});
 const previous=profile.resume,permit=(await store.get('journal','rolling-activation:'+previous.previousActivation+':complete'))?.value;
 const ended=(await store.get('journal',`rolling-ended:${profile.payload.queueId}:${previous.previousRun}`))?.value;
 assert(permit?.run===previous.previousRun&&permit.queueId===profile.payload.queueId&&ended?.run===permit.run
  &&ended.activation===previous.previousActivation&&ended.commit===permit.commit&&queueHash(ended)===previous.endedProofHash,'SG_AG_CLOSE_PREVIOUS_WINDOW');
 const oldRun=await readEnded(previous.previousRun.split(':')[0]),oldJobs=await readEndedJobs(previous.previousRun.split(':')[0]);
 assert(oldRun?.status==='completed'&&oldRun.head_sha===permit.commit&&oldJobs.total_count===oldJobs.jobs.length
  &&oldJobs.total_count===22&&oldJobs.jobs.every(j=>j.status==='completed'),'SG_AG_CLOSE_OLD_ACTOR_ACTIVE');
 const receipt={...recovery.receipt,closureRun:run,closureCommit:commit,closureProfileHash:queueHash(profile),
  operation:'close-ended-admission',fullCaptureWindowEnded:false};
 const key='rolling-admission-ended:'+receipt.targetActivation+':'+receipt.targetRun;
 await store.create('journal',key,receipt,{immutable:true});
 assert(queueHash((await store.get('journal',key))?.value)===queueHash(receipt),'SG_AG_CLOSE_SEAL_CHANGED');
 await boundary();const before=await store.get('state','rolling-source');
 assert(queueHash(before?.value)===recovery.receipt.nativeSourceHash,'SG_AG_CLOSE_NATIVE_CHANGED');
 const value={owner:null,queueId:null,status:'idle',lastRun:previous.previousRun,lastQueueId:profile.payload.queueId,
  endedProofHash:previous.endedProofHash,lastAdmissionClosed:{run:receipt.targetRun,activation:receipt.targetActivation,
   receiptHash:queueHash(receipt),closureRun:run,closureCommit:commit}};
 assert(await store.cas('state','rolling-source',before,value),'SG_AG_CLOSE_CAS_CONFLICT');
 assert(queueHash((await store.get('state','rolling-source'))?.value)===queueHash(value),'SG_AG_CLOSE_READBACK_CHANGED');
 return {operation:profile.operation,run,commit,sourceRequests:0,taskWrites:0,roundWrites:0,receiptHash:queueHash(receipt)};
}
