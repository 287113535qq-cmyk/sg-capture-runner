import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// An ended shared stop is eligible only after its exact immutable close.
export async function readSharedRuntimeProof({store,plan,profile,revision,ended,jobs,approved}){
 assert(approved?.schema==='sg-count-shared-close-profile-v1'&&approved.group==='primary'
  &&approved.gameId===32799&&approved.trialId===plan.trialId&&profile.schema==='sg-session-layout-rhino-v1'
  &&profile.sessionLayout?.lanesPerHost===2&&approved.completePreserved===52897&&approved.abandonedAttempts===28
  &&approved.sourceRun==='36844672513:1'&&approved.sourceCommit==='586d34262675ea5b09fc7bbe6475ec696e706885'
  &&approved.sourceAllowance===0&&revision.newBetAllowance===0,'COUNT_REFRESH_SHARED_SCOPE');
 const key=`count-shared-close:${plan.trialId}:${approved.sourceRun}`;
 assert(revision.sharedClosureKey===key+':complete'&&revision.sharedCloseProfileHash===hash(approved)
  &&revision.sourceRun===approved.sourceRun&&revision.fromCommit===approved.sourceCommit
  &&ended.status==='completed'&&ended.conclusion==='failure'&&`${ended.id}:${ended.run_attempt}`===approved.sourceRun
  &&ended.head_sha===approved.sourceCommit&&hash(jobs)===approved.jobsHash,'COUNT_REFRESH_SHARED_SOURCE');
 const close=(await store.get('journal',key+':complete'))?.value,
  settled=(await store.get('journal',key+':settled'))?.value,
  before=(await store.get('journal',key+':before'))?.value;
 assert(close?.schema==='sg-count-shared-close-v1'&&hash(close)===revision.sharedClosureHash&&hash(settled)===hash(close)
  &&close.profileHash===hash(approved)&&close.activation===profile.activation&&close.trialId===plan.trialId
  &&close.sourceRun===approved.sourceRun&&close.sourceCommit===approved.sourceCommit&&close.group==='primary'
  &&close.completePreserved===52897&&close.abandonedAttempts===28&&close.unknownAttempts===0
  &&close.sourceRequests===0&&close.newBetAllowance===0&&close.requiresNewSession===true&&close.repairKey===null
  &&before?.schema==='sg-count-shared-before-v1'&&before.profileHash===hash(approved)
  &&hash(before.pool)===approved.poolHash&&hash(before.campaign)===approved.campaignHash
  &&hash(before.hold)===approved.holdHash&&before.hold.details?.code==='GLOBAL_SOURCE_STOPPED','COUNT_REFRESH_SHARED_PROOF');
 const retired=(await store.get('journal',close.retirement+':complete'))?.value,
  pool=(await store.get('state','pool:'+plan.trialId))?.value,
  hold=(await store.get('state','global-hold'))?.value;
 assert(retired?.schema==='sg-retired-count-result-v1'&&hash(retired)===close.retirementHash
  &&retired.recordsHash===close.recordsHash&&retired.completePreserved===52897&&retired.abandonedAttempts===28
  &&retired.sourceRequests===0&&retired.newBetAllowance===0
  &&pool?.countSharedClosure===key&&pool.retiredCount===close.retirement&&pool.enabled&&!pool.failure
  &&hold?.active===false&&hold.countSharedClosure===key&&revision.completePreserved===52897,'COUNT_REFRESH_SHARED_UNSETTLED');
 return close;
}
