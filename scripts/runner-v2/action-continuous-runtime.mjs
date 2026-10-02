import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';

export const ACTION_CONTINUOUS_RUNTIME='count-runtime-pyramids-action-continuous-20261002.json';
export const ACTION_BUDGET_CONTINUOUS_RUNTIME='count-runtime-pyramids-action-budget-continuous-20261002.json';

// A healthy action-channel run can authorize a reviewed successor executable.
// Classification annotations are independent and never part of source quota.
export function checkActionContinuousRevision({plan,profile,revision}){
 const budget=profile?.schema==='sg-formal-action-budget-profile-v1';
 assert(profile?.schema===(budget?'sg-formal-action-budget-profile-v1':'sg-formal-action-profile-v1')
  &&hash(profile)===(budget?'d9ecf7db02603aab784d125c5a1721f5e9d62534f337f3846ad6d773e7281527':'c86e5cb9a5c68b9952497503accbdd107c3f89d86395063513c77914b377355b')
  &&plan?.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'
  &&plan.buy===0&&plan.phase===1&&plan.target===299850
  &&plan.countAllocation===profile.activation&&hash(plan)===profile.planHash,'ACTION_CONTINUOUS_PROFILE');
 assert(revision?.schema==='sg-count-runtime-refresh-profile-v1'
  &&revision.purpose===(budget?'continuous-action-budget-v1':'continuous-action-v1')&&revision.gameId===plan.gameId
  &&revision.activation===profile.activation&&revision.profileHash===hash(profile)
  &&revision.planHash===hash(plan)&&/^[0-9]+:1$/.test(revision.sourceRun??'')
  &&/^[a-f0-9]{40}$/.test(revision.fromCommit??'')
  &&Number.isSafeInteger(revision.completePreserved)
  &&revision.completePreserved>=profile.completePreserved&&revision.completePreserved<plan.target
  &&revision.remainingComplete===plan.target-revision.completePreserved
  &&revision.newBetAllowance===0&&revision.sourceRequests===0
  &&revision.captureMinutes===15&&revision.maxWorkers===20&&revision.lanesPerHost===1
  &&revision.requiresNewSession===true&&revision.automaticRelay===false
  &&revision.actionContractHash===profile.actionContractHash
  &&revision.controlReadMode===profile.controlReadMode&&revision.gatewayHash===profile.gatewayHash
  &&revision.stateWriteMode===profile.stateWriteMode,'ACTION_CONTINUOUS_REVISION');
 if(budget)assert(revision.sourceRun==='36979713737:1'
  &&revision.fromCommit==='e77f7ce345f40f063819dcbce3fc77e27f5ce3d0'
  &&revision.completePreserved===51593&&revision.remainingComplete===248257
  &&hash(revision.actionResourceBudget)===hash(profile.actionResourceBudget),
  'ACTION_BUDGET_CONTINUOUS_PARENT');
 return {captureMinutes:15,maxWorkers:20,lanesPerHost:1};
}

export function checkActionContinuousBinding({plan,profile,revision,receipt,spec,complete,commit}){
 const limits=checkActionContinuousRevision({plan,profile,revision});
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&commit!==revision.fromCommit
  &&spec?.schema==='sg-complete-count-v1'&&spec.profileHash===hash(profile)
  &&spec.activation===profile.activation&&spec.planHash===hash(plan)&&spec.trialId===plan.trialId
  &&spec.gameId===plan.gameId&&spec.target===plan.target&&spec.sourceRecordsHash===profile.recordsHash,
  'ACTION_CONTINUOUS_ORIGINAL_SPEC');
 assert(complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
  &&complete.commit===spec.commit&&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)
  &&complete.trialId===plan.trialId&&complete.completePreserved===profile.completePreserved
  &&complete.remainingComplete===profile.remainingComplete&&complete.sourceRequests===0,
  'ACTION_CONTINUOUS_ORIGINAL_COMPLETE');
 assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit&&receipt.fromCommit===spec.commit
  &&receipt.previousCommit===revision.fromCommit&&receipt.specHash===hash(spec)
  &&receipt.profileHash===hash(profile)&&receipt.planHash===hash(plan)&&receipt.activation===profile.activation
  &&receipt.revisionHash===hash(revision)&&receipt.sourceRun===revision.sourceRun
  &&receipt.completePreserved===revision.completePreserved&&receipt.remainingComplete===revision.remainingComplete
  &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'ACTION_CONTINUOUS_RECEIPT');
 return limits;
}

export function actionContinuousWindow({plan,profile,revision,receipt,spec,complete,commit,permit,run,now}){
 const limits=checkActionContinuousBinding({plan,profile,revision,receipt,spec,complete,commit});
 assert(/^[0-9]+:1$/.test(run??'')&&permit?.schema==='sg-count-run-v1'
  &&permit.run===run&&permit.commit===commit&&permit.activation===profile.activation
  &&permit.profileHash===hash(profile)&&permit.runtimeRevisionHash===hash(revision)
  &&permit.completeBefore===revision.completePreserved&&permit.remainingComplete===revision.remainingComplete
  &&Number.isSafeInteger(permit.createdAt)&&permit.createdAt<=now
  &&permit.expiresAt===permit.createdAt+limits.captureMinutes*60000,'ACTION_CONTINUOUS_PERMIT');
 return {capture:now<permit.expiresAt,endMs:permit.expiresAt,reason:'ACTION_CONTINUOUS_WINDOW_ENDED'};
}

export async function admitActionContinuous({store,plan,profile,revision,commit,run,boundary,now=Date.now}){
 checkActionContinuousRevision({plan,profile,revision});
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit});
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const complete=(await store.get('journal',key+':complete'))?.value;
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${profile.activation}:${commit}`))?.value;
 checkActionContinuousBinding({plan,profile,revision,receipt,spec,complete,commit});
 assert(/^[0-9]+:1$/.test(run??'')&&Number.isSafeInteger(revision.createdAt)
  &&Number.isSafeInteger(revision.expiresAt)&&revision.createdAt<=now()&&now()<revision.expiresAt
  &&revision.expiresAt-revision.createdAt>0&&revision.expiresAt-revision.createdAt<=7200000
  &&pool.enabled&&!pool.failure&&pool.confirmed===revision.completePreserved&&checkLedger(pool,plan,spec).reserved===0
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now())
  &&campaign.enabled&&campaign.activeGame===plan.gameId&&!campaign.audit
  &&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===profile.activation,'ACTION_CONTINUOUS_NOT_READY');
 const claimKey=`action-continuous-run:${plan.trialId}:${hash(revision)}`;
 const claim={schema:'sg-action-continuous-run-v1',run,commit,revisionHash:hash(revision),sourceRequests:0};
 await store.writable();
 assert((await store.transport.request('create',{collection:'journal',key:claimKey,value:claim})).created===true,
  'ACTION_CONTINUOUS_RUN_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',claimKey))?.value)===hash(claim),'ACTION_CONTINUOUS_CLAIM_READBACK');
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'ACTION_CONTINUOUS_SCENE_CHANGED');
 const createdAt=now(),permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),
  commit,run,poolHash:hash(pool),completeBefore:revision.completePreserved,remainingComplete:revision.remainingComplete,
  runtimeRevisionHash:hash(revision),createdAt,expiresAt:createdAt+revision.captureMinutes*60000};
 const permitKey=`count-run:${plan.trialId}:${run}`;
 assert(!(await store.get('journal',permitKey)),'ACTION_CONTINUOUS_RUN_ALREADY_ADMITTED');
 await store.create('journal',permitKey,permit,{immutable:true});
 assert(hash((await store.get('journal',permitKey))?.value)===hash(permit),'ACTION_CONTINUOUS_PERMIT_READBACK');
 return permit;
}
