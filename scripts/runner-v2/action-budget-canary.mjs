import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_BUDGET_PROFILE,ACTION_BUDGET_CANARY,pyramidsActionBudgetPlan} from './pyramids-action-budget-profile.mjs';
import {DIRECT_ACTION_PROFILE,pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';
import {checkLedger,loadCountPermission} from './complete-count.mjs';

export function checkBudgetCanaryInputs(inputs){
 assert(inputs?.role==='formal-count'&&inputs.allocation==='round-one'&&inputs.round_one_limit==='0'
  &&[ACTION_BUDGET_PROFILE,DIRECT_ACTION_PROFILE].includes(inputs.formal_profile)&&inputs.runtime_profile==='none'
  &&inputs.formal_relay==='none'&&!inputs.relay_parent,'ACTION_BUDGET_DISPATCH');
}
export function budgetCanaryBinding({plan,profile,spec,complete,commit}){
 assert(['sg-formal-action-budget-profile-v1','sg-formal-direct-action-profile-v1'].includes(profile?.schema)&&hash(profile.canary)===hash(ACTION_BUDGET_CANARY)
  &&plan?.countAllocation===profile.activation&&hash(plan)===profile.planHash,'ACTION_BUDGET_CANARY_PROFILE');
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&spec?.schema==='sg-complete-count-v1'&&spec.commit===commit
  &&spec.activation===profile.activation&&spec.profileHash===hash(profile)&&spec.planHash===hash(plan)
  &&spec.trialId===plan.trialId&&spec.sourceRecordsHash===profile.recordsHash
  &&spec.historyReuse?.closureHash===profile.retirementHash&&spec.historyReuse.complete===profile.completePreserved
  &&spec.historyReuse.rawRecordsRead===0&&spec.historyReuse.historicalReadbackFresh===false,'ACTION_BUDGET_CANARY_SPEC');
 assert(complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)&&complete.commit===commit
  &&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)&&complete.trialId===plan.trialId
  &&complete.completePreserved===profile.completePreserved&&complete.remainingComplete===profile.remainingComplete
  &&complete.sourceRequests===0,'ACTION_BUDGET_CANARY_ACTIVATION');
 return profile.canary;
}
export function budgetCanaryWindow(proof){
 const {profile,plan,permit,run,commit,now}=proof;budgetCanaryBinding(proof);
 assert(/^\d+:1$/.test(run??'')&&permit?.schema==='sg-count-run-v1'&&permit.run===run&&permit.commit===commit
  &&permit.activation===profile.activation&&permit.profileHash===hash(profile)
  &&permit.canaryContractHash===hash(profile.canary)&&permit.completeBefore===profile.completePreserved
  &&permit.remainingComplete===profile.remainingComplete&&Number.isSafeInteger(permit.createdAt)
  &&permit.createdAt<=now&&permit.expiresAt===permit.createdAt+profile.canary.captureMinutes*60000
  &&permit.maxPaidRequests===2000&&plan.target===299850,'ACTION_BUDGET_CANARY_PERMIT');
 return {capture:now<permit.expiresAt,endMs:permit.expiresAt,reason:'ACTION_BUDGET_CANARY_WINDOW_ENDED'};
}
export async function admitBudgetCanary({store,base,plan,profile,commit,run,boundary,now=Date.now}){
 assert(hash((profile?.schema==='sg-formal-direct-action-profile-v1'?pyramidsDirectActionPlan:pyramidsActionBudgetPlan)(base,profile))===hash(plan),'ACTION_BUDGET_CANARY_PLAN');
 await boundary();const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit}),key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const complete=(await store.get('journal',key+':complete'))?.value;budgetCanaryBinding({plan,profile,spec,complete,commit});
 assert(/^\d+:1$/.test(run??'')&&now()<profile.expiresAt&&pool.enabled&&!pool.failure
  &&pool.confirmed===profile.completePreserved&&checkLedger(pool,plan,spec).reserved===0
  &&Object.keys(pool.workers).length===0&&c.enabled&&c.group==='secondary'&&c.activeGame===32721
  &&c.formalCount?.activation===profile.activation&&c.formalCount.profileHash===hash(profile)
  &&!c.audit&&!c.protocolValidation&&!c.validationLimit,'ACTION_BUDGET_CANARY_NOT_READY');
 const claimKey=`action-budget-canary-run:${plan.trialId}:${profile.activation}`;
 const claim={schema:'sg-action-budget-canary-run-v1',run,commit,profileHash:hash(profile),sourceRequests:0};
 await store.writable();assert((await store.transport.request('create',{collection:'journal',key:claimKey,value:claim})).created===true,'ACTION_BUDGET_RUN_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',claimKey))?.value)===hash(claim),'ACTION_BUDGET_RUN_READBACK');
 await boundary();assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(c),'ACTION_BUDGET_SCENE_CHANGED');
 const createdAt=now(),permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,
  poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,
  canaryContractHash:hash(profile.canary),maxPaidRequests:2000,createdAt,expiresAt:createdAt+300000};
 budgetCanaryWindow({plan,profile,spec,complete,commit,permit,run,now:createdAt});
 const permitKey=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',permitKey)),'ACTION_BUDGET_ALREADY_ADMITTED');
 await store.create('journal',permitKey,permit,{immutable:true});assert(hash((await store.get('journal',permitKey))?.value)===hash(permit),'ACTION_BUDGET_PERMIT_READBACK');return permit;
}
export async function claimBudgetCanaryWorker({store,proof,identity,now}){
 assert(budgetCanaryWindow({...proof,now}).capture,'ACTION_BUDGET_CANARY_WINDOW_ENDED');
 assert(Number.isSafeInteger(identity.shardId)&&identity.shardId>=20&&identity.shardId<40
  &&identity.commitSha===proof.commit&&identity.planHash===hash(proof.plan)
  &&/^[a-f0-9]{64}$/.test(identity.sessionHash??''),'ACTION_BUDGET_CANARY_WORKER');
 const key=`action-budget-canary-worker:${proof.plan.trialId}:${proof.run}:${identity.shardId}`;
 const value={schema:'sg-action-budget-canary-worker-v1',run:proof.run,commit:proof.commit,activation:proof.profile.activation,
  permitHash:hash(proof.permit),worker:identity.shardId,sessionHash:identity.sessionHash,maxBatches:1,createdAt:now};
 await store.writable();assert((await store.transport.request('create',{collection:'journal',key,value})).created===true,'ACTION_BUDGET_WORKER_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',key))?.value)===hash(value),'ACTION_BUDGET_WORKER_READBACK');return value;
}
