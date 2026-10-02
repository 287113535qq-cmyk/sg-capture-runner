import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewVeryFruityBootstrapFailure} from './bootstrap-failure-review.mjs';

// An Init is a real request, but not a paid round. Preserve its complete frame
// and fence its session before giving the existing generation a new runtime.
// This module has no source transport and never modifies the original spec.
export async function retireReviewedBootstrap({store,transport,input,profile,commit,run,boundary,now=Date.now}) {
  const get=async(c,k)=>(await store.get(c,k))?.value;
  const {plan}=input, key=`bootstrap-retirement:${plan.trialId}:${plan.demoGeneration}`;
  assert(/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'BOOTSTRAP_RETIRE_RUNTIME');
  const proof=reviewVeryFruityBootstrapFailure({...input,now:now()});
  const spec=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`);
  const specDone=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`);
  assert(profile.schema==='sg-bootstrap-retirement-profile-v1'&&profile.planHash===hash(plan)
    &&profile.sceneHash===proof.sceneHash&&profile.frameHash===proof.frameHash
    &&profile.originalCommit===input.ended.head_sha&&commit!==profile.originalCommit
    &&profile.generation===plan.demoGeneration&&profile.newBetAllowance===0
    &&profile.retainedBetAllowance===100&&profile.expiresAt===spec?.expiresAt
    &&now()>=profile.createdAt&&now()<profile.expiresAt,'BOOTSTRAP_RETIRE_PROFILE');
  assert(spec?.schema==='sg-demo-generation-v1'&&spec.planHash===hash(plan)
    &&spec.newBetAllowance===100&&spec.firstBatchId===1&&spec.group==='secondary'
    &&spec.workerOffset===20&&spec.perWorker===5&&spec.workers===20
    &&specDone?.specHash===hash(spec)&&specDone.commit===spec.commit&&specDone.run===spec.run
    &&Number.isSafeInteger(input.batches[0].epoch)&&input.campaign.protocolValidation.demoFresh===hash(spec)
    &&input.pool.demoGeneration?.specHash===hash(spec),'BOOTSTRAP_RETIRE_SPEC');
  const b=input.batches[0], batchKey=`batch:${plan.trialId}:${b.id}`, poolKey='pool:'+plan.trialId;
  async function unchanged() {
    assert(hash(await get('state','campaign'))===hash(input.campaign)
      &&hash(await get('state',poolKey))===hash(input.pool)
      &&hash(await get('state',batchKey))===hash(b)
      &&hash(await get('state','global-hold'))===hash(input.hold)
      &&hash(await get('journal',input.bootstrapKey))===hash(input.bootstrap),'BOOTSTRAP_RETIRE_SCENE_CHANGED');
  }
  await boundary();await unchanged();
  assert(!await get('journal',key+':before'),'BOOTSTRAP_RETIRE_ALREADY_STARTED');
  assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:0})).length===0,'BOOTSTRAP_RETIRE_PAID_RECORDS');
  for(const prefix of ['receipt:','abandoned-demo:'])
    assert((await transport.request('scan',{collection:'journal',key:prefix+plan.trialId+':'})).length===0,'BOOTSTRAP_RETIRE_HISTORY');
  const before={schema:'sg-bootstrap-retirement-before-v1',input,spec,profileHash:hash(profile),commit,run,at:now()};
  const result={schema:'sg-bootstrap-retirement-complete-v1',profileHash:hash(profile),planHash:hash(plan),specHash:hash(spec),
    generation:plan.demoGeneration,commit,run,beforeHash:hash(before),originalCommit:input.ended.head_sha,
    firstBatchId:input.pool.nextBatchId,oldSessionHash:b.sessionHash,retiredBatchId:b.id,
    frameHash:proof.frameHash,expiresAt:spec.expiresAt,sourceRequests:0,newBetAllowance:0,
    retainedBetAllowance:100,paidRequests:0,completePreserved:0,bootstrapAttempts:1};
  const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});
    assert(hash(await get('journal',k))===hash(v),'BOOTSTRAP_RETIRE_READBACK');};
  await save(key+':before',before);await boundary();await unchanged();
  // All partial stages remain held and disabled. Never hide a durable unknown
  // request by removing the batch or rewriting the immutable bootstrap frame.
  await store.update('state',poolKey,v=>{assert(hash(v)===hash(input.pool),'BOOTSTRAP_RETIRE_CAS');return {...v,enabled:false};});
  await store.update('state',batchKey,v=>{assert(hash(v)===hash(b),'BOOTSTRAP_RETIRE_CAS');
    return {...v,owner:null,leaseUntil:0,epoch:v.epoch+1,bootstrapAwaiting:null,
      bootstrapRetired:{key,beforeHash:hash(before),frameHash:proof.frameHash,disposition:'retained-without-replay'}};});
  await store.update('state','campaign',v=>{assert(hash(v)===hash(input.campaign),'BOOTSTRAP_RETIRE_CAS');
    return {...v,protocolValidation:{...v.protocolValidation,commit,runKey:null,
      bootstrapRebind:{key,profileHash:hash(profile),completeHash:hash(result)}}};});
  await save(key+':complete',result);
  const retired=await get('state',batchKey);
  assert(!retired.bootstrapAwaiting&&!retired.pending&&retired.bootstrapRetired?.beforeHash===hash(before),'BOOTSTRAP_RETIRE_READBACK');
  await boundary();
  await store.update('state',poolKey,v=>{assert(hash(v)===hash({...input.pool,enabled:false}),'BOOTSTRAP_RETIRE_CAS');
    return {...v,enabled:true,workers:{},bootstrapRetirement:{key,completeHash:hash(result)}};});
  await store.update('state','global-hold',v=>{assert(hash(v)===hash(input.hold),'BOOTSTRAP_RETIRE_HOLD_CHANGED');
    return {...v,active:false,bootstrapRetirement:{key,completeHash:hash(result)}};});
  assert((await get('state','global-hold'))?.active===false
    &&hash((await get('state','campaign'))?.protocolValidation.bootstrapRebind)===hash({key,profileHash:hash(profile),completeHash:hash(result)})
    &&(await get('state',poolKey))?.bootstrapRetirement?.completeHash===hash(result),'BOOTSTRAP_RETIRE_READBACK');
  return result;
}

export async function readBootstrapRetirement({store,plan,spec,campaign}) {
  const a=campaign.protocolValidation?.bootstrapRebind;
  if(!a)return null;
  const get=async(c,k)=>(await store.get(c,k))?.value;
  const done=await get('journal',a.key+':complete'),before=await get('journal',a.key+':before');
  assert(a.key===`bootstrap-retirement:${plan.trialId}:${plan.demoGeneration}`
    &&done?.schema==='sg-bootstrap-retirement-complete-v1'&&hash(done)===a.completeHash
    &&done.profileHash===a.profileHash&&before?.schema==='sg-bootstrap-retirement-before-v1'
    &&hash(before)===done.beforeHash&&before.profileHash===a.profileHash
    &&done.planHash===hash(plan)&&done.specHash===hash(spec)&&hash(before.spec)===hash(spec)
    &&done.generation===plan.demoGeneration&&done.commit===campaign.protocolValidation.commit
    &&done.expiresAt===spec.expiresAt&&done.sourceRequests===0&&done.newBetAllowance===0
    &&done.retainedBetAllowance===100&&done.paidRequests===0&&done.completePreserved===0
    &&done.firstBatchId===2&&done.retiredBatchId===1,'BOOTSTRAP_REBIND_INVALID');
  const proof=reviewVeryFruityBootstrapFailure({...before.input,now:before.at});
  assert(proof.frameHash===done.frameHash&&done.oldSessionHash===before.input.batches[0].sessionHash,'BOOTSTRAP_REBIND_INVALID');
  const batch=await get('state',`batch:${plan.trialId}:1`);
  assert(batch?.bootstrapRetired?.key===a.key&&batch.bootstrapRetired.beforeHash===done.beforeHash
    &&batch.bootstrapRetired.frameHash===done.frameHash&&!batch.bootstrapAwaiting&&!batch.pending
    &&batch.journaled===batch.start-1&&batch.checkpoint===batch.journaled
    &&batch.sessionHash===done.oldSessionHash&&batch.leaseUntil===0,'BOOTSTRAP_REBIND_BATCH');
  return {done,before};
}
