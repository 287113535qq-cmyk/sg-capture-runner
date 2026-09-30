import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
// A narrowly reviewed zero-source rebind changes code authority, never quota,
// generation, sessions, expiration or any immutable generation document.
export async function demoRuntimeCommit({store,plan,spec,campaign}){
 const p=campaign.protocolValidation;if(!p?.runtimeRebind)return spec.commit;
 const a=p.runtimeRebind,before=(await store.get('journal',a.key+':before'))?.value,done=(await store.get('journal',a.key+':complete'))?.value;
 assert(a.key===`demo-zero-source-rebind:${plan.trialId}:${plan.demoGeneration}`
  &&done?.schema==='sg-demo-zero-source-rebind-complete-v1'&&hash(done)===a.completeHash
  &&done.profileHash===a.profileHash&&done.specHash===hash(spec)&&done.planHash===hash(plan)
  &&done.originalCommit===spec.commit&&done.commit===p.commit&&done.generation===plan.demoGeneration
  &&done.newBetAllowance===0&&done.retainedBetAllowance===100&&done.sourceRequests===0&&done.expiresAt===spec.expiresAt
  &&before?.schema==='sg-demo-zero-source-rebind-before-v1'&&hash(before)===done.beforeHash
  &&before.profileHash===a.profileHash&&before.commit===done.commit&&before.run===done.run
  &&hash(before.spec)===hash(spec)&&before.campaign.protocolValidation.commit===spec.commit
  &&before.pool.nextBatchId===1&&before.pool.confirmed===0&&Object.keys(before.pool.workers).length===0,'DEMO_RUNTIME_REBIND_INVALID');
 return done.commit;
}
