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
  &&(campaign.group==='secondary'?
   (((plan.gameId===32719&&before.sourceRunKey==='capture-run:36764738887:1'&&spec.completePreserved===67&&done.completePreserved===67&&before.pool.confirmed===67)
    ||(plan.gameId===32721&&before.sourceRunKey===null&&before.sourceActivationRun==='36772084996:1'&&spec.run===before.sourceActivationRun&&spec.commit==='f0a531912a963acb6ad72cf695d4a60e605c73fa'&&spec.completePreserved===1262&&done.completePreserved===1262&&before.pool.confirmed===1262))&&spec.group==='secondary'&&spec.workerOffset===20&&before.group==='secondary'&&done.group==='secondary'
    &&before.campaign.protocolValidation.runKey===null
    &&before.pool.nextBatchId===spec.firstBatchId):
   (before.pool.nextBatchId===1&&before.pool.confirmed===0))&&Object.keys(before.pool.workers).length===0,'DEMO_RUNTIME_REBIND_INVALID');
 return done.commit;
}
