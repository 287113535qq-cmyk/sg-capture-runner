import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkSessionCanaryRevision} from './session-canary.mjs';

export function checkCanaryDispatchInputs(inputs){
 assert(inputs?.role==='formal-count'&&inputs.allocation==='round-one'&&inputs.round_one_limit==='0'
  &&inputs.runtime_profile==='count-runtime-rhino-canary-20261001.json'
  &&inputs.formal_relay==='none'&&!inputs.relay_parent,'CANARY_RELAY_REQUIRES_COMPARISON');
}

export function checkCanaryAdmission({plan,profile,revision,permit,admission}){
 checkSessionCanaryRevision(profile,revision);
 assert(plan.gameId===32799&&plan.trialId==='sg_r1_20261001_32799'
  &&admission?.schema==='sg-session-canary-admit-v1'&&admission.trialId===plan.trialId
  &&admission.run===permit.run&&admission.commit===permit.commit&&admission.activation===profile.activation
  &&admission.profileHash===hash(profile)&&admission.revisionHash===hash(revision)
  &&admission.sourcePermitHash===hash(permit)&&admission.createdAt===permit.createdAt
  &&admission.sourceRequests===0&&admission.newBetAllowance===0,'CANARY_ADMISSION_PROOF');
 return hash(admission);
}

// AG's immutable task claim precedes any source permission. A lost write
// acknowledgement leaves the attempt claimed; another run cannot repeat it.
export async function claimSessionCanary({store,plan,profile,revision,permit,inputs}){
 checkSessionCanaryRevision(profile,revision);checkCanaryDispatchInputs(inputs);
 assert(plan.gameId===32799&&plan.trialId==='sg_r1_20261001_32799'
  &&permit?.schema==='sg-count-run-v1'&&/^\d+:1$/.test(permit.run??'')&&/^[a-f0-9]{40}$/.test(permit.commit??'')
  &&permit.activation===profile.activation&&permit.profileHash===hash(profile)
  &&permit.completeBefore===revision.completePreserved&&permit.remainingComplete===revision.remainingComplete
  &&Number.isSafeInteger(permit.createdAt)&&permit.expiresAt>permit.createdAt,'CANARY_ADMISSION_BINDING');
 const key=`session-canary:${plan.trialId}:${hash(revision)}:admit`;
 assert(!(await store.get('journal',key)),'CANARY_ALREADY_CLAIMED');
 const value={schema:'sg-session-canary-admit-v1',trialId:plan.trialId,run:permit.run,commit:permit.commit,
  activation:profile.activation,profileHash:hash(profile),revisionHash:hash(revision),sourcePermitHash:hash(permit),
  createdAt:permit.createdAt,sourceRequests:0,newBetAllowance:0};
 await store.create('journal',key,value,{immutable:true});
 const admission=(await store.get('journal',key))?.value;
 assert(hash(admission)===hash(value),'CANARY_ADMISSION_READBACK');
 checkCanaryAdmission({plan,profile,revision,permit,admission});
 return {key,value};
}
