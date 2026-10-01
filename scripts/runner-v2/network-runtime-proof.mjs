import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
// A source fault never becomes a healthy run. Bind its separate, completed
// no-source closure before accepting a new runtime on the existing allocation.
export async function readNetworkRuntimeProof({store,plan,profile,revision,ended,jobs,approved}){
 assert(approved?.schema==='sg-count-network-close-profile-v1'&&approved.trialId===plan.trialId&&plan.gameId===32799
  &&profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===2
  &&approved.sourceRun==='36886658723:1'&&approved.sourceCommit==='14c2d194c2ae48525bafdfebd4fd30cea036b948'
  &&approved.sourceProfileHash===hash(profile)&&approved.completePreserved===199775&&approved.abandonedAttempts===14
  &&approved.unknownAttempts===1&&approved.sourceAllowance===0&&revision.newBetAllowance===0,'COUNT_REFRESH_NETWORK_SCOPE');
 const key=`count-network-close:${plan.trialId}:${approved.sourceRun}`;
 assert(revision.networkClosureKey===key+':complete'&&revision.networkCloseProfileHash===hash(approved)
  &&revision.sourceRun===approved.sourceRun&&revision.fromCommit===approved.sourceCommit&&revision.completePreserved===approved.completePreserved
  &&ended.status==='completed'&&ended.conclusion==='failure'&&`${ended.id}:${ended.run_attempt}`===approved.sourceRun
  &&ended.head_sha===approved.sourceCommit&&hash(jobs)===approved.jobsHash,'COUNT_REFRESH_NETWORK_SOURCE');
 const close=(await store.get('journal',key+':complete'))?.value,settled=(await store.get('journal',key+':settled'))?.value,
  before=(await store.get('journal',key+':before'))?.value;
 assert(close?.schema==='sg-count-network-close-v1'&&hash(close)===revision.networkClosureHash&&hash(settled)===hash(close)
  &&close.profileHash===hash(approved)&&close.activation===profile.activation&&close.trialId===plan.trialId
  &&close.sourceRun===approved.sourceRun&&close.sourceCommit===approved.sourceCommit&&close.completePreserved===199775
  &&close.abandonedAttempts===14&&close.unknownAttempts===1&&close.sourceRequests===0&&close.newBetAllowance===0&&close.requiresNewSession===true
  &&before?.schema==='sg-count-network-before-v1'&&before.profileHash===hash(approved)&&hash(before.pool)===approved.poolHash
  &&hash(before.campaign)===approved.campaignHash&&hash(before.hold)===approved.holdHash,'COUNT_REFRESH_NETWORK_PROOF');
 const retired=(await store.get('journal',close.retirement+':complete'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value,
  hold=(await store.get('state','global-hold'))?.value;
 assert(retired?.schema==='sg-retired-count-result-v1'&&hash(retired)===close.retirementHash&&retired.completePreserved===199775
  &&retired.abandonedAttempts===14&&retired.sourceRequests===0&&retired.newBetAllowance===0
  &&pool?.countNetworkClosure===key&&pool.retiredCount===close.retirement&&pool.enabled&&!pool.failure&&pool.confirmed===199775
  &&hold?.active===false&&hold.countNetworkClosure===key,'COUNT_REFRESH_NETWORK_UNSETTLED');
 return close;
}
