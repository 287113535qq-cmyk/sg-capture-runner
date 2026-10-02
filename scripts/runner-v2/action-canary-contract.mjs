import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
export const ACTION_CANARY_RUNTIME='count-runtime-pyramids-action-canary-20261002.json';
export function checkActionCanaryRevision({plan,profile,revision}){
 assert(profile?.schema==='sg-formal-action-profile-v1'
  &&hash(profile)==='c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b'
  &&plan?.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'&&plan.target===299850
  &&plan.buy===0&&plan.phase===1&&plan.countAllocation===profile.activation
  &&profile.activation==='c47170077c468925d1150c49d51033fe05b8365e5b5c49e2b85f7faea2e0868f'
  &&hash(plan)===profile.planHash,'ACTION_CANARY_PROFILE');
 assert(revision?.schema==='sg-action-canary-runtime-v1'&&revision.purpose==='action-canary-v1'
  &&revision.gameId===32721&&revision.activation===profile.activation&&revision.profileHash===hash(profile)
  &&revision.planHash===hash(plan)&&revision.sourceRun==='36969614155:1'
  &&revision.fromCommit==='1b831e373a3c861b8537b499d0c81e5bd5333d4a'
  &&revision.completePreserved===16913&&revision.remainingComplete===282937
  &&revision.newBetAllowance===0&&revision.sourceRequests===0&&revision.captureMinutes===5
  &&revision.maxWorkers===20&&revision.maxBatchesPerWorker===1&&revision.maxPaidPerWorker===100
  &&revision.maxPaidRequests===2000&&revision.automaticRelay===false
  &&revision.lanesPerHost===1&&revision.requiresNewSession===true
  &&revision.actionContractHash===profile.actionContractHash,'ACTION_CANARY_REVISION');
 return {captureMinutes:5,maxWorkers:20,maxBatchesPerWorker:1,maxPaidPerWorker:100,maxPaidRequests:2000};
}
export function checkActionCanaryInputs(inputs){
 assert(inputs?.role==='formal-count'&&inputs.allocation==='round-one'&&inputs.round_one_limit==='0'
  &&inputs.formal_profile==='formal-repair-pyramids-action-20261002.json'
  &&inputs.runtime_profile===ACTION_CANARY_RUNTIME&&inputs.formal_relay==='none'
  &&!inputs.relay_parent,'ACTION_CANARY_DISPATCH');
}

// A corrected executable may use the applied allocation only after a separate
// zero-source runtime receipt. Neither a changed file nor an environment flag
// replaces the original activation proof.
export function checkActionCanaryBinding({plan,profile,revision,receipt,spec,complete,commit}){
 const limits=checkActionCanaryRevision({plan,profile,revision});
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&commit!==revision.fromCommit
  &&spec?.schema==='sg-complete-count-v1'&&spec.commit===revision.fromCommit
  &&spec.activation===profile.activation&&spec.profileHash===hash(profile)
  &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId&&spec.gameId===plan.gameId
  &&spec.target===plan.target&&spec.sourceRecordsHash===profile.recordsHash,
  'ACTION_CANARY_ORIGINAL_SPEC');
 assert(complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
  &&complete.commit===spec.commit&&complete.profileHash===hash(profile)
  &&complete.planHash===hash(plan)&&complete.trialId===plan.trialId
  &&complete.completePreserved===16913&&complete.remainingComplete===282937
  &&complete.sourceRequests===0,'ACTION_CANARY_ORIGINAL_COMPLETE');
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit
  &&receipt.fromCommit===spec.commit&&receipt.specHash===hash(spec)
  &&receipt.profileHash===hash(profile)&&receipt.planHash===hash(plan)
  &&receipt.activation===profile.activation&&receipt.revisionHash===hash(revision)
  &&receipt.completePreserved===16913&&receipt.remainingComplete===282937
  &&receipt.sourceRun===revision.sourceRun&&receipt.sourceRequests===0
  &&receipt.newBetAllowance===0,'ACTION_CANARY_RUNTIME_RECEIPT');
 return limits;
}

export function actionCanaryWindow({plan,profile,revision,receipt,spec,complete,commit,permit,run,now}){
 checkActionCanaryBinding({plan,profile,revision,receipt,spec,complete,commit});
 assert(/^[0-9]+:1$/.test(run??'')&&permit?.schema==='sg-count-run-v1'
  &&permit.run===run&&permit.commit===commit&&permit.activation===profile.activation
  &&permit.profileHash===hash(profile)&&permit.runtimeRevisionHash===hash(revision)
  &&permit.completeBefore===16913&&permit.remainingComplete===282937
  &&Number.isSafeInteger(permit.createdAt)&&permit.createdAt<=now
  &&permit.expiresAt===permit.createdAt+5*60000,'ACTION_CANARY_RUN_PERMIT');
 return {capture:now<permit.expiresAt,endMs:permit.expiresAt,reason:'ACTION_CANARY_WINDOW_ENDED'};
}

// One atomic, non-recoverable claim per worker and run. A restarted process may
// not reuse the claim, even if its owner text is identical. Old interrupted
// sessions remain evidence rather than a retry path.
export async function claimActionCanaryWorker({store,proof,identity,now}){
 const window=actionCanaryWindow({...proof,now});
 assert(window.capture,'ACTION_CANARY_WINDOW_ENDED');
 assert(Number.isSafeInteger(identity.shardId)&&identity.shardId>=20&&identity.shardId<40
  &&identity.commitSha===proof.commit&&identity.planHash===hash(proof.plan)
  &&/^[a-f0-9]{64}$/.test(identity.sessionHash??''),'ACTION_CANARY_WORKER');
 const key=`action-canary-worker:${proof.plan.trialId}:${proof.run}:${identity.shardId}`;
 const value={schema:'sg-action-canary-worker-v1',run:proof.run,commit:proof.commit,
  activation:proof.profile.activation,revisionHash:hash(proof.revision),permitHash:hash(proof.permit),
  worker:identity.shardId,sessionHash:identity.sessionHash,maxBatches:1,createdAt:now};
 await store.writable();
 const result=await store.transport.request('create',{collection:'journal',key,value});
 assert(result.created===true,'ACTION_CANARY_WORKER_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',key))?.value)===hash(value),'ACTION_CANARY_CLAIM_READBACK');
 return value;
}
