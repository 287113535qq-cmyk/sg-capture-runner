import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';
import {directCaptureJobs} from './action-direct-resource.mjs';
import {budgetCanaryWindow} from './action-budget-canary.mjs';
import {checkLedger,loadCountPermission,auditCountBatch} from './complete-count.mjs';
import {relayFormalRun} from './formal-relay.mjs';
import {countHistoryBoundary} from './count-window-history.mjs';

export const DIRECT_ACTION_RELAY_RUNTIME='count-runtime-pyramids-direct-action-relay-historyfix-20261002.json';
export const RESUME_ACTION_RELAY_RUNTIME='count-runtime-pyramids-resume-action-relay-20261002.json';
export const RESUME_ACTION_CONTINUOUS_RUNTIME='count-runtime-pyramids-resume-verified-continuation-20261002.json';
export const RESUME_ACTION_NETWORK_RUNTIME='count-runtime-pyramids-network-continuation-20261002.json';
export const DIRECT_ACTION_RELAY_RUNTIMES=[DIRECT_ACTION_RELAY_RUNTIME,RESUME_ACTION_RELAY_RUNTIME,RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME];
const recovery=revision=>revision?.purpose==='direct-action-log-recovery-v1';
const network=revision=>revision?.purpose==='direct-action-http-continuation-v1';
const continued=revision=>revision?.schema==='sg-count-runtime-refresh-profile-v2';
export async function directRelayCompleteDelta({store,trialId,permit}){
 const pool=(await store.get('state','pool:'+trialId))?.value;
 assert(Number.isSafeInteger(pool?.confirmed)&&Number.isSafeInteger(permit?.completeBefore)
  &&pool.confirmed>=permit.completeBefore,'DIRECT_RELAY_RESOURCE_COUNT');
 return pool.confirmed-permit.completeBefore;
}
const hex=n=>new RegExp(`^[a-f0-9]{${n}}$`);
const runId=/^\d+:1$/;

// The first window obtains the resource evidence. Only its healthy, settled
// completion can authorize one tail window, using the same allocation.
export function checkDirectRelayRevision({base,plan,profile,revision}){
 assert(hash(pyramidsDirectActionPlan(base,profile))===hash(plan),'DIRECT_RELAY_PLAN');
 const continuation=continued(revision);
 if(continuation)assert(profile.featureProfile==='pyramids-action-v3'
  &&['direct-action-verified-continuation-v1','direct-action-log-recovery-v1','direct-action-http-continuation-v1'].includes(revision.purpose)
  &&revision.previousRevisionName===(network(revision)?RESUME_ACTION_CONTINUOUS_RUNTIME:RESUME_ACTION_RELAY_RUNTIME)
  &&hex(64).test(revision.previousRevisionHash??'')&&hex(64).test(revision.previousReceiptHash??'')
  &&hex(64).test(revision.resourceReviewHash??'')&&runId.test(revision.resourceRootRun??'')
  &&hex(40).test(revision.activationCommit??'')&&revision.activationCommit!==revision.fromCommit
  &&revision.completePreserved>profile.completePreserved+2000
  &&revision.completePreserved<plan.target,'DIRECT_RELAY_CONTINUATION_SCOPE');
 if(network(revision))assert(revision.networkClosureKey===`count-network-close:${plan.trialId}:${revision.sourceRun}`
  &&hex(64).test(revision.networkClosureHash??'')&&hex(64).test(revision.networkProfileHash??''), 'DIRECT_RELAY_NETWORK_SCOPE');
 assert((continuation||revision?.schema==='sg-count-runtime-refresh-profile-v1')
  &&(continuation||revision.purpose==='direct-action-relay-v1')&&revision.gameId===32721
  &&revision.profileHash===hash(profile)&&revision.activation===profile.activation
  &&revision.planHash===hash(plan)&&runId.test(revision.sourceRun??'')
  &&hex(40).test(revision.fromCommit??'')&&hex(64).test(revision.sourcePermitHash??'')
  &&hex(64).test(revision.poolHash??'')&&hex(64).test(revision.campaignHash??'')
  &&(continuation||revision.completePreserved===profile.completePreserved+2000)
  &&revision.remainingComplete===plan.target-revision.completePreserved
  &&revision.captureMinutes===15&&revision.tailCaptureMinutes===5&&revision.maxRunWindows===2
  &&revision.maxWorkers===20&&revision.lanesPerHost===1&&revision.automaticRelay===true
  &&revision.requiresNewSession===true&&revision.sourceRequests===0&&revision.newBetAllowance===0
  &&revision.actionContractHash===profile.actionContractHash
  &&hash(revision.actionResourceBudget)===hash(profile.actionResourceBudget)
  &&revision.controlReadMode===profile.controlReadMode&&revision.stateWriteMode===profile.stateWriteMode
  &&revision.gatewayHash===profile.gatewayHash,'DIRECT_RELAY_REVISION');
 return {captureMinutes:15,tailCaptureMinutes:5,maxRunWindows:2};
}

export function checkDirectRelayBinding(proof){
 const {profile,plan,revision,spec,complete,receipt,commit}=proof;
 const limits=checkDirectRelayRevision(proof);
 assert(hex(40).test(commit??'')&&commit!==revision.fromCommit
  &&spec?.schema==='sg-complete-count-v1'&&spec.commit===(continued(revision)?revision.activationCommit:revision.fromCommit)
  &&spec.profileHash===hash(profile)&&spec.activation===profile.activation
  &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId&&spec.gameId===plan.gameId
  &&spec.target===plan.target&&spec.maxSequence===600000&&spec.sessionRotation==='closed-batches-v1'
  &&spec.sourceRecordsHash===profile.recordsHash,'DIRECT_RELAY_SPEC');
 assert(complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
  &&complete.commit===spec.commit&&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)
  &&complete.trialId===plan.trialId&&complete.completePreserved===profile.completePreserved
  &&complete.remainingComplete===profile.remainingComplete&&complete.sourceRequests===0,'DIRECT_RELAY_COMPLETE');
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.fromCommit===spec.commit
  &&receipt.previousCommit===revision.fromCommit&&receipt.specHash===hash(spec)
  &&receipt.profileHash===hash(profile)&&receipt.planHash===hash(plan)&&receipt.activation===profile.activation
  &&receipt.revisionHash===hash(revision)&&receipt.sourceRun===revision.sourceRun
  &&receipt.poolHash===revision.poolHash&&receipt.campaignHash===revision.campaignHash
  &&receipt.completePreserved===revision.completePreserved&&receipt.remainingComplete===revision.remainingComplete
  &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'DIRECT_RELAY_RECEIPT');
 if(continued(revision))assert(receipt.previousRevisionHash===revision.previousRevisionHash
  &&receipt.previousReceiptHash===revision.previousReceiptHash&&receipt.resourceReviewHash===revision.resourceReviewHash,
  'DIRECT_RELAY_CONTINUATION_RECEIPT');
 if(network(revision))assert(receipt.networkClosureHash===revision.networkClosureHash
  &&receipt.networkProfileHash===revision.networkProfileHash,'DIRECT_RELAY_NETWORK_RECEIPT');
 return limits;
}

export function directRelayWindow(proof){
 const {plan,profile,revision,commit,run,permit,now}=proof,limits=checkDirectRelayBinding(proof);
 assert(runId.test(run??'')&&permit?.schema==='sg-count-run-v1'&&permit.run===run&&permit.commit===commit
  &&permit.activation===profile.activation&&permit.profileHash===hash(profile)
  &&permit.runtimeRevisionHash===hash(revision)&&runId.test(permit.rootRun??'')
  &&[1,2].includes(permit.windowIndex)&&Number.isSafeInteger(permit.createdAt)&&permit.createdAt<=now
  &&Number.isSafeInteger(permit.completeBefore)&&permit.completeBefore>=revision.completePreserved
  &&permit.completeBefore<plan.target&&permit.remainingComplete===plan.target-permit.completeBefore,
  'DIRECT_RELAY_PERMIT');
 const minutes=permit.windowIndex===1?limits.captureMinutes:limits.tailCaptureMinutes;
 assert(permit.expiresAt===permit.createdAt+minutes*60000
  &&(permit.windowIndex!==1||(permit.rootRun===run&&permit.completeBefore===revision.completePreserved))
  &&(permit.windowIndex!==2||(permit.rootRun!==run&&hex(64).test(permit.resourceReviewHash??''))),
  'DIRECT_RELAY_WINDOW');
 return {capture:now<permit.expiresAt,endMs:permit.expiresAt,reason:'DIRECT_RELAY_WINDOW_ENDED'};
}

export function checkDirectRelayResource({resourceReview,parentRun,commit}){
 assert(resourceReview?.schema==='sg-resource-workers-review-v1'&&resourceReview.run===parentRun
  &&resourceReview.commit===commit&&resourceReview.workers===20&&resourceReview.verified===true
  &&resourceReview.resourceEvidenceComplete===true&&resourceReview.backendEvidenceComplete===true
  &&resourceReview.hostEvidenceComplete===true&&Number.isSafeInteger(resourceReview.startMs)
  &&Number.isSafeInteger(resourceReview.endMs)&&resourceReview.endMs-resourceReview.startMs===600000
  &&resourceReview.sourceErrors===0&&resourceReview.unknown===0&&resourceReview.resourceHolds===0
  &&hex(64).test(resourceReview.logSha256??''),'DIRECT_RELAY_RESOURCE');
 return hash(resourceReview);
}

// Bounded metadata/readback receipts reuse; no second full raw history scan.
async function settledCount({store,plan,pool,spec,now}){
 let count=0;
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'DIRECT_RELAY_BATCH_MISSING');
  const cache=new Map(),keys=ids.filter(id=>id>spec.baselineBatchCount)
   .map(id=>pool.countAllocation.batches[id].settlementKey);
  assert(keys.every(k=>typeof k==='string'),'DIRECT_RELAY_SETTLEMENT_KEY');
  if(keys.length){
   const proofs=await store.getMany('journal',keys);
   assert(proofs.length===keys.length&&proofs.every(Boolean),'DIRECT_RELAY_SETTLEMENT_MISSING');
   proofs.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));
  }
  for(const [i,row]of rows.entries()){
   const b=row.value,id=ids[i];
   assert(b.id===id&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
    &&(id<=spec.baselineBatchCount||!b.failure)
    &&b.leaseUntil<=now()&&b.checkpoint===b.journaled&&pool.countAllocation.batches[id].closed,
    'DIRECT_RELAY_BATCH_OPEN');
   cache.set(`batch:${plan.trialId}:${id}`,b);
   await auditCountBatch({store,plan,pool,spec,record:{batchId:id},cache});
   count+=b.journaled-b.start+1;
  }
 }
 assert(count===pool.confirmed,'DIRECT_RELAY_COUNT_CHANGED');return count;
}
export async function directRelayTargetReached({store,plan,spec,now=Date.now}){
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(Number.isSafeInteger(pool?.confirmed)&&pool.confirmed<=plan.target,'DIRECT_RELAY_TARGET_COUNT');
 if(pool.confirmed<plan.target)return false;
 assert(checkLedger(pool,plan,spec).reserved===0
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'DIRECT_RELAY_TARGET_NOT_SETTLED');
 await settledCount({store,plan,pool,spec,now});return true;
}
function idle(pool,campaign,plan,profile,spec,now){
 assert(pool?.enabled&&!pool.failure&&checkLedger(pool,plan,spec).reserved===0
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now())
  &&campaign?.enabled&&campaign.group==='secondary'&&campaign.activeGame===32721
  &&!campaign.audit&&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===profile.activation
  &&campaign.formalCount.profileHash===hash(profile),'DIRECT_RELAY_NOT_IDLE');
}
function time(revision,now){
 assert(Number.isSafeInteger(revision.createdAt)&&Number.isSafeInteger(revision.expiresAt)
  &&revision.createdAt<=now()&&now()<revision.expiresAt
  &&revision.expiresAt>revision.createdAt&&revision.expiresAt-revision.createdAt<=7200000,'DIRECT_RELAY_TIME');
}

export async function refreshDirectRelayRuntime(args){
 const {store,base,plan,profile,revision,ended,jobs,commit,run,boundary,now=Date.now}=args;
 checkDirectRelayRevision({base,plan,profile,revision});time(revision,now);
 assert(runId.test(run??'')&&hex(40).test(commit??'')&&commit!==revision.fromCommit
  &&`${ended?.id}:${ended?.run_attempt}`===revision.sourceRun&&ended.head_sha===revision.fromCommit
  &&ended.status==='completed'&&(ended.conclusion==='success'||(recovery(revision)||network(revision))&&ended.conclusion==='failure')&&ended.event==='workflow_dispatch'
  &&ended.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml'&&jobs?.total_count===jobs.jobs?.length
  &&jobs.jobs.length<100&&jobs.jobs.every(j=>j.status==='completed'&&(['success','skipped'].includes(j.conclusion)||(recovery(revision)||network(revision))&&j.name==='verify'&&j.conclusion==='failure'||network(revision)&&/^capture-\d+$/.test(j.name)&&j.conclusion==='failure'))
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(n=>jobs.jobs.filter(j=>j.name===n&&j.conclusion===(network(revision)?'failure':'success')).length===1),
  'DIRECT_RELAY_CANARY_SOURCE');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===revision.poolHash&&hash(campaign)===revision.campaignHash,'DIRECT_RELAY_SCENE_CHANGED');
 const spec=await loadCountPermission({store,plan,pool,commit:continued(revision)?revision.activationCommit:revision.fromCommit});
 const complete=(await store.get('journal',`complete-count:${plan.trialId}:${profile.activation}:complete`))?.value;
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`))?.value;
 if(continued(revision)){
  const previous=args.previousRevision;
  assert(previous?.schema===(network(revision)?'sg-count-runtime-refresh-profile-v2':'sg-count-runtime-refresh-profile-v1')&&hash(previous)===revision.previousRevisionHash,
   'DIRECT_RELAY_PREVIOUS_REVISION');
  const prior=(await store.get('journal',`count-runtime:${plan.trialId}:${profile.activation}:${revision.fromCommit}`))?.value;
  assert(hash(prior)===revision.previousReceiptHash,'DIRECT_RELAY_PREVIOUS_RECEIPT');
  const proof={base,plan,profile,revision:previous,spec,complete,receipt:prior,commit:revision.fromCommit};
  directRelayWindow({...proof,run:revision.sourceRun,permit,now:now()});
  assert(permit.windowIndex===(recovery(revision)||network(revision)?1:2)&&permit.rootRun===(network(revision)?revision.sourceRun:revision.resourceRootRun)
   &&permit.expiresAt<=now()&&hash(permit)===revision.sourcePermitHash,'DIRECT_RELAY_PREVIOUS_TAIL');
  const resourceRun=network(revision)?revision.resourceRootRun:permit.rootRun;
  const resource=recovery(revision)?args.recoveryResourceReview:(await store.get('journal',`direct-action-resource:${plan.trialId}:${resourceRun}`))?.value;
  assert(checkDirectRelayResource({resourceReview:resource,parentRun:resourceRun,commit:network(revision)?previous.fromCommit:revision.fromCommit})===revision.resourceReviewHash
   &&(recovery(revision)||network(revision)||permit.resourceReviewHash===revision.resourceReviewHash),'DIRECT_RELAY_PREVIOUS_RESOURCE');
  if(network(revision)){
   const closed=args.networkProfile,key=revision.networkClosureKey,closure=(await store.get('journal',key+':complete'))?.value,
    settled=(await store.get('journal',key+':settled'))?.value,before=(await store.get('journal',key+':before'))?.value,
    hold=(await store.get('state','global-hold'))?.value,retired=(await store.get('journal',pool.retiredCount+':complete'))?.value;
   assert(closed?.schema==='sg-count-network-http-close-profile-v1'&&hash(closed)===revision.networkProfileHash
    &&closed.sourceRun===revision.sourceRun&&closed.sourceCommit===revision.fromCommit&&closed.sourceProfileHash===hash(profile)
    &&closed.jobsHash===hash(jobs)&&closed.permitHash===hash(permit)&&closed.httpStatus===502&&closed.sourceAllowance===0,
    'DIRECT_RELAY_NETWORK_PROFILE');
   assert(closure?.schema==='sg-count-network-close-v1'&&hash(closure)===revision.networkClosureHash&&hash(settled)===hash(closure)
    &&closure.profileHash===hash(closed)&&closure.sourceRun===revision.sourceRun&&closure.sourceCommit===revision.fromCommit
    &&closure.activation===profile.activation&&closure.completePreserved===pool.confirmed&&closure.abandonedAttempts===2&&closure.unknownAttempts===1
    &&closure.sourceRequests===0&&closure.newBetAllowance===0&&closure.requiresNewSession===true
    &&closure.retirement===pool.retiredCount&&closure.retirementHash===hash(retired)
    &&before?.profileHash===hash(closed)&&hash(before.pool)===closed.poolHash&&hash(before.campaign)===closed.campaignHash
    &&hash(before.hold)===closed.holdHash&&pool.countNetworkClosure===key&&!hold.active&&hold.countNetworkClosure===key,
    'DIRECT_RELAY_NETWORK_CLOSURE');
   assert(previous.purpose==='direct-action-log-recovery-v1'&&previous.resourceRootRun===resourceRun
    &&previous.resourceReviewHash===revision.resourceReviewHash,'DIRECT_RELAY_NETWORK_RESOURCE');
   for(const k of [`count-relay:${plan.trialId}:${revision.sourceRun}:intent`,`direct-action-relay-child:${plan.trialId}:${revision.sourceRun}`])
    assert(!(await store.get('journal',k)),'DIRECT_RELAY_NETWORK_ALREADY_CONTINUED');
  }
  if(recovery(revision)){
   directCaptureJobs({source:ended,jobs,commit:revision.fromCommit,verifyOnlyFailure:true});
   assert(revision.sourceRun===revision.resourceRootRun&&resource.startMs>=permit.createdAt&&resource.endMs<=now(),
    'DIRECT_RELAY_RECOVERY_WINDOW');
   for(const key of [`count-relay:${plan.trialId}:${permit.rootRun}:intent`,`direct-action-relay-child:${plan.trialId}:${permit.rootRun}`])
    assert(!(await store.get('journal',key)),'DIRECT_RELAY_RECOVERY_ALREADY_CONTINUED');
  }
  const parent=args.parentEnded;
  assert(`${parent?.id}:${parent?.run_attempt}`===resourceRun&&parent.status==='completed'&&(parent.conclusion==='success'||(recovery(revision)||network(revision))&&parent.conclusion==='failure')
   &&parent.head_sha===(network(revision)?previous.fromCommit:revision.fromCommit)&&parent.event==='workflow_dispatch'
   &&parent.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
   &&parent.path==='.github/workflows/trial-300k.yml','DIRECT_RELAY_PREVIOUS_PARENT');
  assert(pool.confirmed>permit.completeBefore&&pool.confirmed===revision.completePreserved,'DIRECT_RELAY_PREVIOUS_PROGRESS');
 }else{
  budgetCanaryWindow({plan,profile,spec,complete,commit:revision.fromCommit,run:revision.sourceRun,permit,now:now()});
  const claim=(await store.get('journal',`action-budget-canary-run:${plan.trialId}:${profile.activation}`))?.value;
  assert(hash(permit)===revision.sourcePermitHash&&claim?.schema==='sg-action-budget-canary-run-v1'
   &&claim.run===revision.sourceRun&&claim.commit===revision.fromCommit&&claim.profileHash===hash(profile)
   &&claim.sourceRequests===0&&pool.confirmed===revision.completePreserved,'DIRECT_RELAY_CANARY_PROOF');
 }
 idle(pool,campaign,plan,profile,spec,now);await settledCount({store,plan,pool,spec,now});
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'DIRECT_RELAY_SCENE_CHANGED');
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,previousCommit:revision.fromCommit,
  specHash:hash(spec),profileHash:hash(profile),planHash:hash(plan),activation:profile.activation,
  revisionHash:hash(revision),sourceRun:revision.sourceRun,run,poolHash:hash(pool),campaignHash:hash(campaign),
  completePreserved:pool.confirmed,remainingComplete:plan.target-pool.confirmed,sourceRequests:0,newBetAllowance:0,
  ...(continued(revision)?{previousRevisionHash:revision.previousRevisionHash,previousReceiptHash:revision.previousReceiptHash,
   resourceReviewHash:revision.resourceReviewHash}:{}),...(network(revision)?{networkClosureHash:revision.networkClosureHash,networkProfileHash:revision.networkProfileHash}:{})};
 checkDirectRelayBinding({base,plan,profile,revision,spec,complete,receipt,commit});
 const key=`count-runtime:${plan.trialId}:${profile.activation}:${commit}`;
 assert(!(await store.get('journal',key)),'DIRECT_RELAY_ALREADY_REFRESHED');
 if(recovery(revision)){
  const resourceKey=`direct-action-resource:${plan.trialId}:${revision.resourceRootRun}`;
  const existing=(await store.get('journal',resourceKey))?.value;
  if(existing)assert(hash(existing)===revision.resourceReviewHash,'DIRECT_RELAY_RESOURCE_CHANGED');
  else await store.create('journal',resourceKey,args.recoveryResourceReview,{immutable:true});
  assert(hash((await store.get('journal',resourceKey))?.value)===revision.resourceReviewHash,'DIRECT_RELAY_RESOURCE_READBACK');
 }
 await store.create('journal',key,receipt,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(receipt),'DIRECT_RELAY_REFRESH_READBACK');return receipt;
}

export async function admitDirectRelay(args){
 const {store,plan,profile,revision,commit,run,parentRun,binding,boundary,now=Date.now}=args;
 const proof={...args,...binding},limits=checkDirectRelayBinding(proof);time(revision,now);
 assert(runId.test(run??''),'DIRECT_RELAY_RUN');await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 idle(pool,campaign,plan,profile,binding.spec,now);
 assert(pool.confirmed<plan.target,'DIRECT_RELAY_TARGET_REACHED');
 const rootKey=`direct-action-relay-root:${plan.trialId}:${hash(revision)}`;
 let rootRun=run,windowIndex=1,resourceReviewHash;
 if(parentRun){
  assert(runId.test(parentRun)&&parentRun!==run,'DIRECT_RELAY_PARENT');
  const parent=(await store.get('journal',`count-run:${plan.trialId}:${parentRun}`))?.value;
  directRelayWindow({...proof,run:parentRun,permit:parent,now:now()});
  assert(parent.windowIndex===1,'DIRECT_RELAY_WINDOW_LIMIT');
  const root=(await store.get('journal',rootKey))?.value;
  const intent=(await store.get('journal',`count-relay:${plan.trialId}:${parentRun}:intent`))?.value;
  const admitted=(await store.get('journal',`count-relay:${plan.trialId}:${parentRun}:admit`))?.value;
  const resource=(await store.get('journal',`direct-action-resource:${plan.trialId}:${parentRun}`))?.value;
  resourceReviewHash=checkDirectRelayResource({resourceReview:resource,parentRun,commit});
  assert(resource.startMs>=parent.createdAt&&resource.endMs<=now(),'DIRECT_RELAY_RESOURCE_WINDOW');
  assert(root?.schema==='sg-direct-action-relay-root-v1'&&root.run===parent.rootRun&&root.run===parentRun
   &&root.commit===commit&&root.revisionHash===hash(revision)&&root.sourceRequests===0
   &&intent?.schema==='sg-formal-relay-v1'&&intent.parentRun===parentRun&&intent.commit===commit
   &&intent.repository==='287113535qq-cmyk/sg-capture-runner'&&intent.trialId===plan.trialId
   &&intent.profileHash===hash(profile)&&intent.activation===profile.activation
   &&intent.sourceRequests===0&&intent.newBetAllowance===0&&pool.confirmed===intent.completeBefore
   &&pool.confirmed>parent.completeBefore&&intent.remainingComplete===plan.target-pool.confirmed
   &&admitted?.schema==='sg-formal-relay-admit-v1'&&admitted.parentRun===parentRun&&admitted.run===run
   &&admitted.commit===commit&&admitted.activation===profile.activation,'DIRECT_RELAY_PARENT_FINISHED');
  await settledCount({store,plan,pool,spec:binding.spec,now});rootRun=parent.rootRun;windowIndex=2;
 }else assert(pool.confirmed===revision.completePreserved&&hash(pool)===revision.poolHash
  &&hash(campaign)===revision.campaignHash,'DIRECT_RELAY_ROOT_SCENE');
 const key=parentRun?`direct-action-relay-child:${plan.trialId}:${parentRun}`:rootKey;
 const claim={schema:parentRun?'sg-direct-action-relay-child-v1':'sg-direct-action-relay-root-v1',run,commit,
  rootRun,windowIndex,revisionHash:hash(revision),sourceRequests:0};
 await store.writable();
 assert((await store.transport.request('create',{collection:'journal',key,value:claim})).created===true,'DIRECT_RELAY_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',key))?.value)===hash(claim),'DIRECT_RELAY_CLAIM_READBACK');
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'DIRECT_RELAY_SCENE_CHANGED');
 const createdAt=now(),permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,
  poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,
  historyBoundary:countHistoryBoundary({pool,plan,spec:binding.spec}),
  runtimeRevisionHash:hash(revision),rootRun,windowIndex,createdAt,
  expiresAt:createdAt+(windowIndex===1?limits.captureMinutes:limits.tailCaptureMinutes)*60000,
  ...(resourceReviewHash?{resourceReviewHash}:{})};
 directRelayWindow({...proof,permit,now:createdAt});
 const permitKey=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',permitKey)),'DIRECT_RELAY_ALREADY_ADMITTED');
 await store.create('journal',permitKey,permit,{immutable:true});
 assert(hash((await store.get('journal',permitKey))?.value)===hash(permit),'DIRECT_RELAY_PERMIT_READBACK');return permit;
}

export async function relayDirectActionRun(args){
 const {store,plan,profile,revision,source,commit,binding,resourceReview,now=Date.now}=args;
 const parentRun=`${source?.id}:1`,proof={...args,...binding};checkDirectRelayBinding(proof);
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${parentRun}`))?.value;
 directRelayWindow({...proof,permit,run:parentRun,now:now()});
 if(permit.windowIndex===2)return {continued:false,reason:'DIRECT_RELAY_WINDOW_LIMIT'};
 checkDirectRelayResource({resourceReview,parentRun,commit});
 assert(resourceReview.startMs>=permit.createdAt&&resourceReview.endMs<=now(),'DIRECT_RELAY_RESOURCE_WINDOW');
 const key=`direct-action-resource:${plan.trialId}:${parentRun}`;
 await store.writable();const existing=(await store.get('journal',key))?.value;
 if(existing)assert(hash(existing)===hash(resourceReview),'DIRECT_RELAY_RESOURCE_CHANGED');
 else await store.create('journal',key,resourceReview,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(resourceReview),'DIRECT_RELAY_RESOURCE_READBACK');
 return relayFormalRun(args);
}
