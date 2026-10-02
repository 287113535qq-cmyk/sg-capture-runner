import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const VERYFRUITY_RUNTIME_FILE='demo-runtime-veryfruity-entryfix-20261003.json';
export function checkVeryFruityZeroProfile(p,original,evidence){
 assert(p?.schema==='sg-veryfruity-zero-source-runtime-v1'&&p.gameId===32812&&p.group==='secondary'
  &&p.sourceRunKey==='capture-run:37043477601:1'&&p.originalCommit==='1ce222b8b42ac0da116f599e0ea931b9fa8ec309'
  &&p.sourceProfileHash===hash(original)&&p.sourceProfileHash==='a661966a0f4853b7668c9a1f3753db4e95d0a9b7f4d3753e112f4060f35344a0'
  &&p.generation===original.generation&&p.planHash===original.planHash&&p.expiresAt===original.expiresAt
  &&p.newBetAllowance===0&&p.retainedBetAllowance===100&&p.evidenceHash===hash(evidence),'VERYFRUITY_ZERO_SCOPE');
 assert(evidence.length===20&&new Set(evidence.map(e=>e.shardId)).size===20&&evidence.every(e=>
  Number.isInteger(e.shardId)&&e.shardId>=20&&e.shardId<40&&e.gameId===32812&&e.runtimeGameId===33172
  &&e.trialId==='sg_r1_20261003_32812'&&e.sourceRequests===0&&e.paidRoundRequests===0&&e.completedThisRun===0
  &&e.error==='DEMO_FRESH_GROUP_CHANGED'&&/^[a-f0-9]{64}$/.test(e.logHash)),'VERYFRUITY_ZERO_EVIDENCE');
}
export async function rebindVeryFruityZero({store,transport,plan,profile,original,evidence,boundary,commit,run,now=Date.now}){
 checkVeryFruityZeroProfile(profile,original,evidence);
 assert(hash(plan)===profile.planHash&&now()>=profile.createdAt&&now()<profile.expiresAt
  &&/^[a-f0-9]{40}$/.test(commit)&&commit!==profile.originalCommit&&/^\d+:1$/.test(run),'VERYFRUITY_ZERO_RUNTIME');
 await boundary();const get=async(c,k)=>(await store.get(c,k))?.value;
 const c=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId),key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;
 const spec=await get('journal',key),done=await get('journal',key+':complete');
 assert(hash({campaign:c,pool})===profile.sceneHash&&c.group==='secondary'&&c.activeGame===32812&&c.enabled
  &&c.protocolValidation?.commit===profile.originalCommit&&c.protocolValidation.runKey===profile.sourceRunKey
  &&!c.protocolValidation.runtimeRebind&&c.protocolValidation.demoFresh===hash(spec)
  &&spec.group==='secondary'&&spec.workerOffset===20&&spec.commit===profile.originalCommit&&spec.planHash===hash(plan)
  &&spec.newBetAllowance===100&&spec.firstBatchId===1&&spec.completePreserved===0&&spec.expiresAt===profile.expiresAt
  &&done?.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run
  &&pool.enabled&&!pool.failure&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
  &&pool.nextSequence===1&&pool.nextBatchId===1&&pool.confirmed===0&&Object.keys(pool.workers).length===0,'VERYFRUITY_ZERO_SCENE');
 assert((await store.getMany('state',Array.from({length:100},(_,i)=>`batch:${plan.trialId}:${i+1}`))).every(r=>!r),'VERYFRUITY_ZERO_BATCH');
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:0})).length===0,'VERYFRUITY_ZERO_RECORDS');
 for(const prefix of ['receipt:','abandoned-demo:'])assert((await transport.request('scan',{collection:'journal',key:prefix+plan.trialId+':'})).length===0,'VERYFRUITY_ZERO_HISTORY');
 const rebind=`demo-zero-source-rebind:${plan.trialId}:${plan.demoGeneration}`;
 assert(!await get('journal',rebind+':before'),'VERYFRUITY_ZERO_ALREADY_STARTED');
 const before={schema:'sg-demo-zero-source-rebind-before-v1',campaign:c,pool,spec,evidence,sourceRunKey:profile.sourceRunKey,group:'secondary',profileHash:hash(profile),commit,run,at:now()};
 const result={schema:'sg-demo-zero-source-rebind-complete-v1',profileHash:hash(profile),specHash:hash(spec),planHash:hash(plan),generation:plan.demoGeneration,originalCommit:spec.commit,commit,run,beforeHash:hash(before),expiresAt:spec.expiresAt,sourceRequests:0,newBetAllowance:0,retainedBetAllowance:100,group:'secondary',completePreserved:0};
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await get('journal',k))===hash(v),'VERYFRUITY_ZERO_READBACK');};
 await save(rebind+':before',before);await boundary();assert(hash(await get('state','pool:'+plan.trialId))===hash(pool),'VERYFRUITY_ZERO_POOL_CHANGED');
 await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'VERYFRUITY_ZERO_CAS');return {...v,protocolValidation:{...v.protocolValidation,commit,runKey:null,runtimeRebind:{key:rebind,profileHash:hash(profile),completeHash:hash(result)}}};});
 await save(rebind+':complete',result);return result;
}
