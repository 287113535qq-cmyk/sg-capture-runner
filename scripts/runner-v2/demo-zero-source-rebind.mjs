import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
export async function rebindZeroSource({store,transport,plan,profile,evidence,boundary,commit,run,now=Date.now}){
 const key=`demo-zero-source-rebind:${plan.trialId}:${plan.demoGeneration}`;
 assert(profile.schema==='sg-demo-zero-source-rebind-v1'&&profile.planHash===hash(plan)&&profile.evidenceHash===hash(evidence)
  &&/^[a-f0-9]{40}$/.test(commit)&&commit!==profile.originalCommit&&/^\d+:1$/.test(run)
  &&now()>=profile.createdAt&&now()<profile.expiresAt,'ZERO_SOURCE_SCOPE');
 assert(evidence.length===20&&new Set(evidence.map(e=>e.shardId)).size===20&&evidence.every(e=>Number.isInteger(e.shardId)&&e.shardId>=0&&e.shardId<20
  &&e.trialId===plan.trialId&&e.gameId===plan.gameId&&e.runtimeGameId===plan.runtimeGameId
  &&e.sourceRequests===0&&e.paidRoundRequests===0&&e.completedThisRun===0&&e.error==='ERR_ASSERTION'),'ZERO_SOURCE_EVIDENCE');
 await boundary();
 const read=async(c,k)=>(await store.get(c,k))?.value,c=await read('state','campaign'),pool=await read('state','pool:'+plan.trialId),p=c?.protocolValidation;
 const spec=await read('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`),done=await read('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`);
 assert(hash({campaign:c,pool})===profile.sceneHash&&c.activeGame===plan.gameId&&c.validationLimit===5&&p?.phase==='short'
  &&p.commit===profile.originalCommit&&p.runKey===profile.sourceRunKey&&!p.runtimeRebind
  &&p.generation===plan.demoGeneration&&p.demoFresh===hash(spec)&&pool.demoGeneration?.specHash===hash(spec)
  &&spec?.schema==='sg-demo-generation-v1'&&spec.commit===profile.originalCommit&&spec.planHash===hash(plan)
  &&spec.firstBatchId===1&&spec.newBetAllowance===100&&spec.perWorker===5&&spec.workers===20&&spec.completePreserved===0
  &&spec.expiresAt===profile.expiresAt&&done?.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run
  &&pool.planHash===hash(plan)&&pool.enabled&&!pool.failure&&pool.nextSequence===1&&pool.nextBatchId===1&&pool.confirmed===0&&Object.keys(pool.workers).length===0,'ZERO_SOURCE_SCENE');
 assert((await store.getMany('state',Array.from({length:100},(_,i)=>`batch:${plan.trialId}:${i+1}`))).every(r=>!r),'ZERO_SOURCE_BATCH_EXISTS');
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:0})).length===0,'ZERO_SOURCE_RECORDS_EXIST');
 for(const prefix of ['receipt:','abandoned-demo:'])assert((await transport.request('scan',{collection:'journal',key:prefix+plan.trialId+':'})).length===0,'ZERO_SOURCE_HISTORY_EXISTS');
 assert(!(await store.get('journal',key+':before')),'ZERO_SOURCE_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await read('journal',k))===hash(v),'ZERO_SOURCE_READBACK');};
 const before={schema:'sg-demo-zero-source-rebind-before-v1',campaign:c,pool,spec,evidence,profileHash:hash(profile),commit,run,at:now()};
 const result={schema:'sg-demo-zero-source-rebind-complete-v1',profileHash:hash(profile),specHash:hash(spec),planHash:hash(plan),generation:plan.demoGeneration,originalCommit:spec.commit,commit,run,beforeHash:hash(before),expiresAt:spec.expiresAt,sourceRequests:0,newBetAllowance:0,retainedBetAllowance:100};
 await save(key+':before',before);await boundary();assert(hash(await read('state','pool:'+plan.trialId))===hash(pool),'ZERO_SOURCE_POOL_CHANGED');
 await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'ZERO_SOURCE_CAMPAIGN_CHANGED');v.protocolValidation={...v.protocolValidation,commit,runKey:null,runtimeRebind:{key,profileHash:hash(profile),completeHash:hash(result)}};return v;});
 await save(key+':complete',result);return result;
}
