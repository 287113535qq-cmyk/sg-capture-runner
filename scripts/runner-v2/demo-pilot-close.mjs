import {onePaidRound} from './paid-round-evidence.mjs';
import assert from 'node:assert/strict';
import {demoRuntimeCommit} from './demo-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {readInterruptedClosure} from './demo-interrupted-close.mjs';

export const pilotCloseKey=plan=>`closed-demo-pilot:${plan.trialId}:${plan.demoGeneration}`;
export async function pilotCloseScene(store,plan){
 const campaign=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(pool&&Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=101,'PILOT_CLOSE_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===i+1),'PILOT_CLOSE_BATCH_MISSING');
 return {campaign,pool,batches:rows.map(r=>r.value)};
}

// Closing an unused allowance is distinct from spending it. The first version
// covers workers that either completed their five BETs or never registered.
// Partial/unknown attempts must use the separate abandonment policy first.
export async function reviewClosablePilot({store,transport,parser,basePlan,plan,profile,scene,now=Date.now}){
 const get=async k=>(await store.get('journal',k))?.value,key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;
 const spec=await get(key),done=await get(key+':complete'),{campaign,pool,batches}=scene;
 assert(spec?.schema==='sg-demo-generation-v1'&&spec.trialId===plan.trialId&&spec.generation===plan.demoGeneration
  &&spec.planHash===hash(plan)&&hash(spec)===profile.sourceSpecHash&&pool.demoGeneration?.specHash===hash(spec)
  &&(await demoRuntimeCommit({store,plan,spec,campaign}))===profile.sourceCommit&&spec.workers===20&&spec.perWorker===5&&spec.newBetAllowance===100
  &&done?.schema==='sg-demo-generation-complete-v1'&&done.specHash===hash(spec)&&done.commit===spec.commit&&done.run===spec.run,'PILOT_CLOSE_SPEC_CHANGED');
 const top=spec.activationStage&&await get(spec.activationStage.key+':complete');
 assert(spec.activationStage?.key===`next-demo-game:${plan.trialId}:${plan.demoGeneration}`
  &&spec.activationStage.profileHash===profile.sourceProfileHash&&top?.schema==='sg-next-demo-game-complete-v1'
  &&top.profileHash===profile.sourceProfileHash&&top.commit===spec.commit&&top.run===spec.run
  &&top.generation===plan.demoGeneration&&top.newBetAllowance===100&&top.sourceRequests===0,'PILOT_CLOSE_ACTIVATION');
 assert(campaign.activeGame===plan.gameId&&campaign.protocolValidation?.runKey===profile.sourceRunKey
  &&campaign.protocolValidation.commit===profile.sourceCommit&&campaign.protocolValidation.demoFresh===hash(spec)
  &&campaign.protocolValidation.generation===plan.demoGeneration&&pool.planHash===hash(plan)
  &&pool.enabled&&!pool.failure&&!pool.demoPilotClosed,'PILOT_CLOSE_BINDING');
 assert(Number.isSafeInteger(spec.firstBatchId)&&spec.firstBatchId>=1&&spec.firstBatchId<=pool.nextBatchId
  &&Array.isArray(profile.usedByWorker)&&profile.usedByWorker.length===20&&profile.usedByWorker.every(n=>n===0||n===5)
  &&profile.usedByWorker.some(n=>n===0)&&profile.usedByWorker.some(n=>n===5),'PILOT_CLOSE_BUDGET');
 assert(Object.values(pool.workers).every(w=>Number.isFinite(w.leaseUntil)&&w.leaseUntil<=now()),'PILOT_CLOSE_LEASE');
 const records=[],used=Array(20).fill(0),newBatches=batches.filter(b=>b.id>=spec.firstBatchId);
 for(const b of batches){
  assert(Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20&&Number.isSafeInteger(b.start)&&Number.isSafeInteger(b.end)
   &&Number.isSafeInteger(b.journaled)&&b.start>=1&&b.start-1<=b.journaled&&b.journaled<=b.end&&b.end-b.start<100
   &&b.checkpoint===b.journaled&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
   &&Number.isFinite(b.leaseUntil)&&b.leaseUntil<=now(),'PILOT_CLOSE_UNSETTLED');
  const keys=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(plan.trialId,b.start+i)),rows=keys.length?await store.getMany('journal',keys):[];
  assert(rows.length===keys.length&&rows.every(Boolean),'PILOT_CLOSE_RECEIPT_MISSING');
  for(const [i,{value:r}] of rows.entries()){
   assert(r.trialId===plan.trialId&&r.batchId===b.id&&r.shardId===b.worker&&r.sequence===b.start+i
    &&r.sourceSessionHash===b.sessionHash&&onePaidRound(plan,r.raw),'PILOT_CLOSE_RECEIPT_CHANGED');
   assert((await parser.call({op:'verify',plan:basePlan,raw:r.raw,record:r})).verified,'PILOT_CLOSE_RECORD_INVALID');records.push(r);
   if(b.id>=spec.firstBatchId)used[b.worker]++;
  }
 }
 assert(records.length===profile.completePreserved&&new Set(records.map(r=>r._id)).size===records.length
  &&new Set(records.map(r=>r.sequence)).size===records.length&&hash(used)===hash(profile.usedByWorker),'PILOT_CLOSE_COUNT_CHANGED');
 for(let w=0;w<20;w++){
  const own=newBatches.filter(b=>b.worker===w),registered=pool.workers[String(w)];
  if(used[w]===0)assert(!registered&&own.length===0,'PILOT_CLOSE_UNUSED_WORKER_HAS_ACTIVITY');
  else assert(own.length===1&&registered?.sessionHash===own[0].sessionHash&&!own[0].failure
   &&(!registered.activeBatch||registered.activeBatch.id===own[0].id),'PILOT_CLOSE_WORKER_CHANGED');
 }
 for(let i=0;i<records.length;i+=100){const wanted=records.slice(i,i+100),actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:wanted.map(r=>r._id)});
  assert(hash(actual.map(hash).sort())===hash(wanted.map(hash).sort()),'PILOT_CLOSE_MONGO_CHANGED');}
 return {usedByWorker:used,foregoneByWorker:used.map(n=>5-n),used:used.reduce((a,b)=>a+b,0),foregone:100-used.reduce((a,b)=>a+b,0),recordsHash:hash(records)};
}

export async function closeDemoPilot({store,transport,parser,basePlan,plan,profile,boundary,commit,run,now=Date.now}){
 assert(profile.schema==='sg-demo-pilot-close-v1'&&profile.newBetAllowance===0&&hash(plan)===profile.planHash
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'PILOT_CLOSE_SCOPE');
 const key=pilotCloseKey(plan),save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'PILOT_CLOSE_READBACK');};
 await boundary();assert(!await store.get('journal',key+':before')&&!await store.get('journal',key+':complete'),'PILOT_CLOSE_ALREADY_STARTED');
 const scene=await pilotCloseScene(store,plan);assert(hash(scene)===profile.sceneHash,'PILOT_CLOSE_SCENE_CHANGED');
 const review=await reviewClosablePilot({store,transport,parser,basePlan,plan,profile,scene,now});
 const before={schema:'sg-demo-pilot-close-before-v1',scene,review,profileHash:hash(profile),commit,run,at:now()};
 await save(key+':before',before);await boundary();
 assert(hash(await pilotCloseScene(store,plan))===hash(scene),'PILOT_CLOSE_SCENE_CHANGED');
 const doc=await store.get('state','pool:'+plan.trialId);assert(hash(doc?.value)===hash(scene.pool),'PILOT_CLOSE_POOL_CHANGED');
 const after={...scene.pool,enabled:false,demoPilotClosed:{key,profileHash:hash(profile)}};
 assert(await store.cas('state','pool:'+plan.trialId,doc,after),'PILOT_CLOSE_CAS_CONFLICT');
 assert(hash(await pilotCloseScene(store,plan))===hash({...scene,pool:after}),'PILOT_CLOSE_AFTER_CHANGED');
 const result={schema:'sg-demo-pilot-closed-v1',trialId:plan.trialId,generation:plan.demoGeneration,planHash:hash(plan),specHash:profile.sourceSpecHash,
  sourceRunKey:profile.sourceRunKey,sourceCommit:profile.sourceCommit,sourceProfileHash:profile.sourceProfileHash,
  profileHash:hash(profile),beforeHash:hash(before),afterPoolHash:hash(after),campaignHash:hash(scene.campaign),batchesHash:hash(scene.batches),
  ...review,completePreserved:profile.completePreserved,newBetAllowance:0,sourceRequests:0,commit,run,at:now()};
 await save(key+':complete',result);return result;
}

// A later game may consume this closure as source evidence. Partial stages,
// altered state, or changed counts never stand in for a completed close.
export async function readClosedPilot({store,plan,profile,scene}){
 const key=pilotCloseKey(plan),closed=(await store.get('journal',key+':complete'))?.value,before=(await store.get('journal',key+':before'))?.value;
 if(closed?.schema==='sg-demo-pilot-closed-v2')return readInterruptedClosure({store,plan,profile,scene,closed,before});
 assert(closed?.schema==='sg-demo-pilot-closed-v1'&&closed.trialId===plan.trialId&&closed.generation===plan.demoGeneration
  &&closed.planHash===hash(plan)&&closed.specHash===profile.sourceSpecHash&&closed.sourceRunKey===profile.sourceRunKey
  &&closed.sourceCommit===profile.sourceCommit&&closed.sourceProfileHash===profile.sourceProfileHash
  &&hash(closed)===profile.sourceClosureHash&&closed.newBetAllowance===0&&closed.sourceRequests===0
  &&before?.schema==='sg-demo-pilot-close-before-v1'&&hash(before)===closed.beforeHash&&before.profileHash===closed.profileHash
  &&before.commit===closed.commit&&before.run===closed.run&&!scene.fromPool.enabled
  &&scene.fromPool.demoPilotClosed?.key===key&&scene.fromPool.demoPilotClosed.profileHash===closed.profileHash
  &&hash(scene.fromPool)===closed.afterPoolHash&&hash(scene.sourceBatches)===closed.batchesHash&&hash(scene.campaign)===closed.campaignHash,'NEXT_GAME_CLOSURE_INVALID');
 assert(Array.isArray(closed.usedByWorker)&&closed.usedByWorker.length===20&&closed.usedByWorker.every(n=>n===0||n===5)
  &&hash(closed.foregoneByWorker)===hash(closed.usedByWorker.map(n=>5-n))&&closed.used===closed.usedByWorker.reduce((a,b)=>a+b,0)
  &&closed.used>0&&closed.foregone>0&&closed.used+closed.foregone===100,'NEXT_GAME_CLOSURE_BUDGET');
 return closed;
}
