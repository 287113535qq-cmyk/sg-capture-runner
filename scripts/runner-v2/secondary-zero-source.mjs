import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const incaOriginalCommit='85444f5';
export function checkSecondaryFailedAdmission(ended,jobs,profile){
 assert(ended.id===36764738887&&ended.run_attempt===1&&ended.head_sha===profile.originalCommit
  &&ended.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'&&ended.event==='workflow_dispatch'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.status==='completed'&&ended.conclusion==='failure','SECONDARY_FAILED_RUN_CHANGED');
 assert(jobs.total_count===jobs.jobs?.length&&jobs.total_count>0&&jobs.total_count<100
  &&jobs.jobs.every(j=>j.status==='completed')&&hash(jobs.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion})).sort((a,b)=>a.id-b.id))===profile.jobsHash
  &&jobs.jobs.filter(j=>j.name==='secondary-admit').length===1
  &&jobs.jobs.find(j=>j.name==='secondary-admit').conclusion==='failure'
  &&jobs.jobs.some(j=>j.name.startsWith('fresh-capture-'))
  &&jobs.jobs.filter(j=>j.name.startsWith('fresh-capture-')).every(j=>j.conclusion==='skipped')
  &&jobs.jobs.filter(j=>j.name!=='secondary-admit').every(j=>['success','skipped'].includes(j.conclusion)),'SECONDARY_FAILED_JOBS_CHANGED');
}
export function checkSecondaryAmendment(profile,original){
 assert(profile?.schema==='sg-secondary-zero-source-runtime-v1'&&profile.gameId===32719&&profile.group==='secondary'
  &&profile.sourceRunKey==='capture-run:36764738887:1'&&profile.originalCommit?.startsWith(incaOriginalCommit)
  &&/^[a-f0-9]{40}$/.test(profile.originalCommit)&&profile.sourceProfileHash===hash(original)
  &&profile.sourceProfileHash==='b785d28c1ce4cf6bc855a202ee6f6fdd9a8e274ac7f33e1f7be068eaed148c82'
  &&profile.generation===original.generation&&profile.planHash===original.planHash
  &&profile.expiresAt===original.expiresAt&&profile.newBetAllowance===0&&profile.retainedBetAllowance===100
  &&profile.completePreserved===67&&profile.createdAt>=original.createdAt&&profile.createdAt<profile.expiresAt,'SECONDARY_AMENDMENT_SCOPE');
}
export async function secondaryUnstartedScene({store,transport,plan}){
 const get=async(c,k)=>(await store.get(c,k))?.value,campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId);
 assert(Number.isSafeInteger(pool?.nextBatchId)&&pool.nextBatchId>1&&pool.nextBatchId<=101,'SECONDARY_AMEND_BATCH_BOUND');
 const rows=await store.getMany('state',Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`));
 assert(rows.every(Boolean),'SECONDARY_AMEND_BATCH_MISSING');
 const records=await transport.request('rounds_scan',{trialId:plan.trialId,after:0});
 assert(records.length===67,'SECONDARY_AMEND_RECORDS');
 return {campaign,pool,batches:rows.map(r=>r.value),recordsHash:hash(records.map(hash).sort())};
}
export async function rebindSecondaryUnstarted({store,transport,parser,basePlan,plan,original,profile,boundary,commit,run,now=Date.now}){
 checkSecondaryAmendment(profile,original);
 assert(now()>=profile.createdAt&&now()<profile.expiresAt&&/^[a-f0-9]{40}$/.test(commit)&&commit!==profile.originalCommit&&/^\d+:1$/.test(run),'SECONDARY_AMEND_STALE');
 await boundary();const scene=await secondaryUnstartedScene({store,transport,plan}),{campaign:c,pool,batches}=scene;
 const get=async(c,k)=>(await store.get(c,k))?.value,spec=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`),done=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`),top=await get('journal',`next-demo-game:${plan.trialId}:${plan.demoGeneration}:complete`);
 assert(hash(scene)===profile.sceneHash&&c.group==='secondary'&&c.activeGame===32719&&c.enabled&&c.validationLimit===5
  &&c.protocolValidation?.phase==='short'&&c.protocolValidation.runKey===null&&!c.protocolValidation.runtimeRebind
  &&c.protocolValidation.commit===profile.originalCommit&&c.protocolValidation.generation===plan.demoGeneration
  &&c.protocolValidation.demoFresh===hash(spec)&&spec?.group==='secondary'&&spec.workerOffset===20&&spec.commit===profile.originalCommit
  &&spec.planHash===hash(plan)&&spec.newBetAllowance===100&&spec.expiresAt===profile.expiresAt&&spec.completePreserved===67
  &&done?.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run
  &&top?.profileHash===hash(original)&&top.commit===spec.commit&&top.run===spec.run&&top.completePreserved===67
  &&pool.enabled&&!pool.failure&&pool.confirmed===67&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
  &&pool.nextBatchId===spec.firstBatchId&&Object.keys(pool.workers).length===0
  &&batches.every(b=>!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now()),'SECONDARY_AMEND_SCENE_CHANGED');
 for(const record of await transport.request('rounds_scan',{trialId:plan.trialId,after:0}))assert((await parser.call({op:'verify',plan:basePlan,raw:record.raw,record})).verified,'SECONDARY_AMEND_PYTHON');
 const key=`demo-zero-source-rebind:${plan.trialId}:${plan.demoGeneration}`;
 assert(!await get('journal',key+':before'),'SECONDARY_AMEND_ALREADY_STARTED');
 const before={schema:'sg-demo-zero-source-rebind-before-v1',campaign:c,pool,spec,sceneHash:hash(scene),sourceRunKey:profile.sourceRunKey,group:'secondary',profileHash:hash(profile),commit,run,at:now()};
 const result={schema:'sg-demo-zero-source-rebind-complete-v1',profileHash:hash(profile),specHash:hash(spec),planHash:hash(plan),generation:plan.demoGeneration,originalCommit:spec.commit,commit,run,beforeHash:hash(before),expiresAt:spec.expiresAt,sourceRequests:0,newBetAllowance:0,retainedBetAllowance:100,group:'secondary',completePreserved:67};
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await get('journal',k))===hash(v),'SECONDARY_AMEND_READBACK');};
 await save(key+':before',before);await boundary();assert(hash(await secondaryUnstartedScene({store,transport,plan}))===profile.sceneHash,'SECONDARY_AMEND_SCENE_CHANGED');
 await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'SECONDARY_AMEND_CAMPAIGN_CHANGED');return {...v,protocolValidation:{...v.protocolValidation,commit,runtimeRebind:{key,profileHash:hash(profile),completeHash:hash(result)}}};});
 await save(key+':complete',result);return result;
}
