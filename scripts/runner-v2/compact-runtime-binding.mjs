import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkFourReadRecovery} from './four-read-recovery-runtime.mjs';
import {ACTION_CANARY_RUNTIME,checkActionCanaryBinding} from './action-canary-contract.mjs';
import {ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME,checkActionContinuousBinding} from './action-continuous-runtime.mjs';

// Immutable runtime receipt selects the optimization; environment flags cannot.
export function compactRuntimeBinding({plan,profile,revision,receipt,commit}) {
  if(revision?.controlReadMode===undefined)return false;
  assert(revision.controlReadMode==='compact-worker-v1'&&/^[a-f0-9]{64}$/.test(revision.gatewayHash??''),'COMPACT_RUNTIME_MODE');
  assert(plan?.gameId===32799&&plan.countAllocation===profile?.activation
    &&profile.schema==='sg-session-layout-rhino-v1'&&[2,4].includes(profile.sessionLayout?.lanesPerHost)
    &&revision.schema==='sg-count-runtime-refresh-profile-v1'
    &&['session-canary-v1','continuous-count-v1','continuous-four-count-v1','bounded-four-read-recovery-v1'].includes(revision.purpose)
    &&(revision.purpose!=='continuous-four-count-v1'||profile.sessionLayout.lanesPerHost===4)
    &&(revision.purpose!=='continuous-count-v1'||profile.sessionLayout.lanesPerHost===2)
    &&revision.activation===plan.countAllocation&&revision.profileHash===hash(profile)
    &&revision.newBetAllowance===0,'COMPACT_RUNTIME_SCOPE');
  assert(/^[a-f0-9]{40}$/.test(commit??'')&&receipt?.schema==='sg-count-runtime-v2'
    &&receipt.commit===commit&&receipt.activation===plan.countAllocation
    &&receipt.profileHash===hash(profile)&&receipt.revisionHash===hash(revision)
    &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'COMPACT_RUNTIME_RECEIPT');
  if(revision.purpose==='bounded-four-read-recovery-v1'){
    checkFourReadRecovery(profile,revision);
    assert(receipt.initialReadFailureHash===revision.initialReadFailureHash,'COMPACT_INITIAL_READ_FAILURE_BINDING');
  }
  return true;
}

export function compactLayoutBinding({plan,profile,spec,complete,commit}) {
  assert(profile?.controlReadMode==='compact-worker-v1'&&/^[a-f0-9]{64}$/.test(profile.gatewayHash??''),'COMPACT_LAYOUT_MODE');
  assert(plan?.gameId===32799&&plan.target===300000&&plan.buy===0&&plan.phase===1
    &&profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===4
    &&plan.countAllocation===profile.activation&&profile.newBetAllowance===0,'COMPACT_LAYOUT_SCOPE');
  assert(/^[a-f0-9]{40}$/.test(commit??'')&&spec?.schema==='sg-complete-count-v1'
    &&spec.activation===plan.countAllocation&&spec.commit===commit&&spec.profileHash===hash(profile)
    &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId&&spec.gameId===plan.gameId
    &&complete?.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
    &&complete.commit===commit&&complete.planHash===hash(plan)&&complete.trialId===plan.trialId
    &&complete.profileHash===hash(profile)&&complete.sourceRequests===0&&complete.newBetAllowance===0,'COMPACT_LAYOUT_RECEIPT');
  return true;
}

// A later repaired allocation can adopt the same fixed worker projection.
// Applied older repair profiles never acquire this mode implicitly.
export function compactRepairBinding({plan,profile,spec,complete,commit}) {
  assert(['sg-formal-repair-pyramids-v5','sg-formal-repair-pyramids-v6','sg-formal-repair-pyramids-v7','sg-formal-repair-pyramids-v8','sg-formal-repair-pyramids-v9','sg-formal-repair-pyramids-v10','sg-formal-action-profile-v1','sg-formal-action-budget-profile-v1'].includes(profile?.schema)
    &&profile.controlReadMode==='compact-worker-v1'
    &&/^[a-f0-9]{64}$/.test(profile.gatewayHash??''),'COMPACT_REPAIR_MODE');
  assert(plan?.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'
    &&plan.target===299850&&plan.buy===0&&plan.phase===1
    &&plan.countAllocation===profile.activation&&profile.group==='secondary'
    &&profile.completePreserved>0&&profile.remainingComplete>0
    &&Number.isSafeInteger(profile.completePreserved)&&Number.isSafeInteger(profile.remainingComplete)
    &&profile.completePreserved+profile.remainingComplete===plan.target
    &&profile.historicalBaseline===150&&profile.totalTarget===300000
    &&profile.stateWriteMode==='versioned-delta-v1','COMPACT_REPAIR_SCOPE');
  assert(/^[a-f0-9]{40}$/.test(commit??'')&&spec?.schema==='sg-complete-count-v1'
    &&spec.commit===commit&&spec.activation===plan.countAllocation
    &&spec.profileHash===hash(profile)&&spec.planHash===hash(plan)
    &&spec.trialId===plan.trialId&&spec.gameId===plan.gameId&&spec.target===plan.target
    &&spec.sourceRecordsHash===profile.recordsHash
    &&complete?.schema==='sg-complete-count-activation-v1'
    &&complete.specHash===hash(spec)&&complete.commit===commit
    &&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)
    &&complete.trialId===plan.trialId&&complete.sourceRequests===0
    &&complete.completePreserved===profile.completePreserved
    &&complete.remainingComplete===profile.remainingComplete,'COMPACT_REPAIR_RECEIPT');
  return true;
}

export function compactControlInitializer({plan,runtimeName,commit,resourceReady,readRevision,readProfile,readReceipt,control}) {
  let ready;
  return ()=>ready??=(async()=>{
    if(!plan.countAllocation)return;
    if(!runtimeName){
      const profile=readProfile();if(profile.controlReadMode===undefined)return;
      await resourceReady;
      const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
      const spec=await readReceipt(key),complete=await readReceipt(key+':complete');
      control.compact=(['sg-formal-repair-pyramids-v5','sg-formal-repair-pyramids-v6','sg-formal-repair-pyramids-v7','sg-formal-repair-pyramids-v8','sg-formal-repair-pyramids-v9','sg-formal-repair-pyramids-v10','sg-formal-action-profile-v1','sg-formal-action-budget-profile-v1'].includes(profile.schema)?compactRepairBinding:compactLayoutBinding)({plan,profile,spec,complete,commit});return;
    }
    const revision=readRevision(runtimeName);
    if(revision.controlReadMode===undefined)return;
    await resourceReady;
    const profile=readProfile();
    const receipt=await readReceipt(`count-runtime:${plan.trialId}:${plan.countAllocation}:${commit}`);
    if(runtimeName===ACTION_CANARY_RUNTIME||[ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME].includes(runtimeName)){
      assert(revision.controlReadMode===profile.controlReadMode&&revision.gatewayHash===profile.gatewayHash,'ACTION_CANARY_COMPACT_MODE');
      const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
      const spec=await readReceipt(key),complete=await readReceipt(key+':complete');
      (runtimeName===ACTION_CANARY_RUNTIME?checkActionCanaryBinding:checkActionContinuousBinding)({plan,profile,revision,receipt,spec,complete,commit});
      control.compact=compactRepairBinding({plan,profile,spec,complete,commit:spec.commit});return;
    }
    control.compact=compactRuntimeBinding({plan,profile,revision,receipt,commit});
  })();
}
