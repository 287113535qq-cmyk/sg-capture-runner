import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Immutable runtime receipt selects the optimization; environment flags cannot.
export function compactRuntimeBinding({plan,profile,revision,receipt,commit}) {
  if(revision?.controlReadMode===undefined)return false;
  assert(revision.controlReadMode==='compact-worker-v1'&&/^[a-f0-9]{64}$/.test(revision.gatewayHash??''),'COMPACT_RUNTIME_MODE');
  assert(plan?.gameId===32799&&plan.countAllocation===profile?.activation
    &&profile.schema==='sg-session-layout-rhino-v1'&&[2,4].includes(profile.sessionLayout?.lanesPerHost)
    &&revision.schema==='sg-count-runtime-refresh-profile-v1'
    &&['session-canary-v1','continuous-count-v1'].includes(revision.purpose)
    &&revision.activation===plan.countAllocation&&revision.profileHash===hash(profile)
    &&revision.newBetAllowance===0,'COMPACT_RUNTIME_SCOPE');
  assert(/^[a-f0-9]{40}$/.test(commit??'')&&receipt?.schema==='sg-count-runtime-v2'
    &&receipt.commit===commit&&receipt.activation===plan.countAllocation
    &&receipt.profileHash===hash(profile)&&receipt.revisionHash===hash(revision)
    &&receipt.sourceRequests===0&&receipt.newBetAllowance===0,'COMPACT_RUNTIME_RECEIPT');
  return true;
}

export function compactControlInitializer({plan,runtimeName,commit,resourceReady,readRevision,readProfile,readReceipt,control}) {
  let ready;
  return ()=>ready??=(async()=>{
    if(!plan.countAllocation||!runtimeName)return;
    const revision=readRevision(runtimeName);
    if(revision.controlReadMode===undefined)return;
    await resourceReady;
    const profile=readProfile();
    const receipt=await readReceipt(`count-runtime:${plan.trialId}:${plan.countAllocation}:${commit}`);
    control.compact=compactRuntimeBinding({plan,profile,revision,receipt,commit});
  })();
}
