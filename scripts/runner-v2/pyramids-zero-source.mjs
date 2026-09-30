import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export function checkPyramidsAmendment(p,original){
 assert(p?.schema==='sg-secondary-unstarted-runtime-v1'&&p.gameId===32721&&p.group==='secondary'
  &&p.sourceRunKey===null&&p.sourceActivationRun==='36772084996:1'
  &&p.originalCommit==='f0a531912a963acb6ad72cf695d4a60e605c73fa'
  &&p.sourceProfileHash===hash(original)&&p.sourceProfileHash==='93d4cf52cdec03b69e48f078f2ce0fd014165bd0791efa620ae46ec0a8cea339'
  &&p.generation===original.generation&&p.planHash===original.planHash&&p.expiresAt===original.expiresAt
  &&p.newBetAllowance===0&&p.retainedBetAllowance===100&&p.completePreserved===1262
  &&p.createdAt>=original.createdAt&&p.createdAt<p.expiresAt,'PYRAMIDS_AMENDMENT_SCOPE');
}
export async function pyramidsUnstartedRecords({transport,plan}){
 assert(plan.gameId===32721&&plan.trialId==='sg_r1_20260928_32721','PYRAMIDS_AMENDMENT_PLAN');
 const records=[];let after=0;
 for(;;){const page=await transport.request('rounds_scan',{trialId:plan.trialId,after});
  assert(Array.isArray(page)&&page.length<=100,'PYRAMIDS_AMENDMENT_PAGE');
  for(const r of page){assert(r.trialId===plan.trialId&&Number.isSafeInteger(r.sequence)&&r.sequence>after,'PYRAMIDS_AMENDMENT_CURSOR');after=r.sequence;records.push(r);}
  assert(records.length<=1262,'PYRAMIDS_AMENDMENT_COUNT');if(page.length<100)break;
 }
 assert(records.length===1262,'PYRAMIDS_AMENDMENT_COUNT');return records;
}
export async function pyramidsUnstartedScene({store,transport,plan}){
 const get=async(c,k)=>(await store.get(c,k))?.value,campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId);
 assert(Number.isSafeInteger(pool?.nextBatchId)&&pool.nextBatchId>1&&pool.nextBatchId<=101,'SECONDARY_AMEND_BATCH_BOUND');
 const rows=await store.getMany('state',Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`));
 assert(rows.every(Boolean),'SECONDARY_AMEND_BATCH_MISSING');
 const records=await pyramidsUnstartedRecords({transport,plan});
 assert(records.length===1262,'SECONDARY_AMEND_RECORDS');
 return {campaign,pool,batches:rows.map(r=>r.value),recordsHash:hash(records.map(hash).sort())};
}
export async function rebindPyramidsUnstarted({store,transport,parser,basePlan,plan,original,profile,boundary,commit,run,now=Date.now}){
 checkPyramidsAmendment(profile,original);
 assert(now()>=profile.createdAt&&now()<profile.expiresAt&&/^[a-f0-9]{40}$/.test(commit)&&commit!==profile.originalCommit&&/^\d+:1$/.test(run),'SECONDARY_AMEND_STALE');
 await boundary();const scene=await pyramidsUnstartedScene({store,transport,plan}),{campaign:c,pool,batches}=scene;
 const get=async(c,k)=>(await store.get(c,k))?.value,spec=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`),done=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`),top=await get('journal',`next-demo-game:${plan.trialId}:${plan.demoGeneration}:complete`);
 assert(hash(scene)===profile.sceneHash&&c.group==='secondary'&&c.activeGame===32721&&c.enabled&&c.validationLimit===5
  &&c.protocolValidation?.phase==='short'&&c.protocolValidation.runKey===null&&!c.protocolValidation.runtimeRebind
  &&c.protocolValidation.commit===profile.originalCommit&&c.protocolValidation.generation===plan.demoGeneration
  &&c.protocolValidation.demoFresh===hash(spec)&&spec?.group==='secondary'&&spec.workerOffset===20&&spec.commit===profile.originalCommit&&spec.run===profile.sourceActivationRun
  &&spec.planHash===hash(plan)&&spec.newBetAllowance===100&&spec.expiresAt===profile.expiresAt&&spec.completePreserved===1262
  &&done?.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run
  &&top?.profileHash===hash(original)&&top.commit===spec.commit&&top.run===spec.run&&top.completePreserved===1262
  &&pool.enabled&&!pool.failure&&pool.confirmed===1262&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
  &&pool.nextBatchId===spec.firstBatchId&&Object.keys(pool.workers).length===0
  &&batches.every(b=>!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now()),'SECONDARY_AMEND_SCENE_CHANGED');
 for(const record of await pyramidsUnstartedRecords({transport,plan}))assert((await parser.call({op:'verify',plan:basePlan,raw:record.raw,record})).verified,'SECONDARY_AMEND_PYTHON');
 const key=`demo-zero-source-rebind:${plan.trialId}:${plan.demoGeneration}`;
 assert(!await get('journal',key+':before'),'SECONDARY_AMEND_ALREADY_STARTED');
 const before={schema:'sg-demo-zero-source-rebind-before-v1',campaign:c,pool,spec,sceneHash:hash(scene),sourceRunKey:profile.sourceRunKey,sourceActivationRun:profile.sourceActivationRun,group:'secondary',profileHash:hash(profile),commit,run,at:now()};
 const result={schema:'sg-demo-zero-source-rebind-complete-v1',profileHash:hash(profile),specHash:hash(spec),planHash:hash(plan),generation:plan.demoGeneration,originalCommit:spec.commit,commit,run,beforeHash:hash(before),expiresAt:spec.expiresAt,sourceRequests:0,newBetAllowance:0,retainedBetAllowance:100,group:'secondary',completePreserved:1262};
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await get('journal',k))===hash(v),'SECONDARY_AMEND_READBACK');};
 await save(key+':before',before);await boundary();assert(hash(await pyramidsUnstartedScene({store,transport,plan}))===profile.sceneHash,'SECONDARY_AMEND_SCENE_CHANGED');
 await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'SECONDARY_AMEND_CAMPAIGN_CHANGED');return {...v,protocolValidation:{...v.protocolValidation,commit,runtimeRebind:{key,profileHash:hash(profile),completeHash:hash(result)}}};});
 await save(key+':complete',result);return result;
}
