import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DIRECT_ACTION_RELAY_RUNTIME,DIRECT_ACTION_RELAY_RUNTIMES,checkDirectRelayBinding} from './action-direct-relay-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_CANARY_RUNTIME,checkActionCanaryBinding} from './action-canary-contract.mjs';
import {ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME,checkActionContinuousBinding} from './action-continuous-runtime.mjs';

// A newly applied activation selects metadata I/O. Capability alone, old
// profiles, or environment booleans cannot enable a changed write path.
export function stateWriteInitializer({store,commit,group,resourceReady=Promise.resolve(),readProfile,runtimeName,readRevision}) {
  const ready=new Map();
  return plan=>{
    const key=plan.countAllocation;
    if(!key){store.deltaCas=false;return Promise.resolve(false);}
    if(!ready.has(key))ready.set(key,(async()=>{
      store.deltaCas=false;
      const profile=readProfile();
      if(profile.stateWriteMode===undefined)return false;
      assert(profile.stateWriteMode==='versioned-delta-v1','STATE_WRITE_MODE');
      assert(profile.activation===key&&profile.gameId===plan.gameId&&plan.buy===0
        &&plan.phase===1&&/^[a-f0-9]{40}$/.test(commit??''),'STATE_WRITE_SCOPE');
      await resourceReady;
      const journal=`complete-count:${plan.trialId}:${key}`;
      const spec=(await store.get('journal',journal))?.value;
      const complete=(await store.get('journal',journal+':complete'))?.value;
      let activationCommit=commit;
      if(DIRECT_ACTION_RELAY_RUNTIMES.includes(runtimeName)){
        const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[32721],revision=readRevision(runtimeName);
        const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${key}:${commit}`))?.value;
        checkDirectRelayBinding({base,plan,profile,revision,receipt,spec,complete,commit});
        assert(group==='secondary'&&revision.stateWriteMode===profile.stateWriteMode,'DIRECT_RELAY_STATE_MODE');
        activationCommit=spec.commit;
      }
      if(runtimeName===ACTION_CANARY_RUNTIME||[ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME].includes(runtimeName)){
        const revision=readRevision(runtimeName);
        const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${key}:${commit}`))?.value;
        (runtimeName===ACTION_CANARY_RUNTIME?checkActionCanaryBinding:checkActionContinuousBinding)({plan,profile,revision,receipt,spec,complete,commit});
        assert(group==='secondary'&&revision.stateWriteMode===profile.stateWriteMode,'ACTION_CANARY_STATE_MODE');
        activationCommit=spec.commit;
      }
      assert(spec?.schema==='sg-complete-count-v1'&&spec.activation===key
        &&spec.commit===activationCommit&&spec.profileHash===hash(profile)
        &&spec.planHash===hash(plan)&&spec.trialId===plan.trialId
        &&spec.gameId===plan.gameId,'STATE_WRITE_SPEC');
      assert(complete?.schema==='sg-complete-count-activation-v1'
        &&complete.specHash===hash(spec)&&complete.commit===activationCommit
        &&complete.profileHash===hash(profile)&&complete.planHash===hash(plan)
        &&complete.trialId===plan.trialId,'STATE_WRITE_COMPLETE');
      const hello=await store.transport.request('hello');
      assert(hello.group===group&&hello.captureLogicOnServer===false
        &&hello.stateDeltaEnabled===true,'STATE_WRITE_CAPABILITY');
      return true;
    })());
    return ready.get(key).then(enabled=>{store.deltaCas=enabled;return enabled;});
  };
}
