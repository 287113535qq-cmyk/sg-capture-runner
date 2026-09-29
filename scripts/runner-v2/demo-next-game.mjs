import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';
import {rolloverDemo} from './demo-rollover.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';

export async function nextDemoScene(store,oldPlan,fromPlan){
 const get=async k=>(await store.get('state',k))?.value;
 const campaign=await get('campaign'),pool=await get('pool:'+oldPlan.trialId),fromPool=await get('pool:'+fromPlan.trialId);
 const batches=async(p,plan)=>{
  assert(p&&Number.isSafeInteger(p.nextBatchId)&&p.nextBatchId>=1&&p.nextBatchId<=101,'NEXT_GAME_BATCH_BOUND');
  const keys=Array.from({length:p.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`);
  const rows=keys.length?await store.getMany('state',keys):[];assert(rows.every(Boolean),'NEXT_GAME_BATCH_MISSING');return rows.map(r=>r.value);
 };
 return {campaign,pool,fromPool,batches:await batches(pool,oldPlan),sourceBatches:await batches(fromPool,fromPlan)};
}

// This operation never owns a source transport. The subsequent capture run
// must independently bind the completed generation through normal admission.
export async function nextDemoGame({store,transport,gate,parser,plans,profile,boundary,commit,run,now=Date.now}){
 assert(profile.schema==='sg-demo-next-game-v1'&&profile.createdAt<=now()&&now()<profile.expiresAt
  &&profile.expiresAt-profile.createdAt===7200000&&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'NEXT_GAME_SCOPE');
 const oldPlan=plans[profile.gameId],plan=applyDemoPilot(plans,profile)[profile.gameId],fromPlan={...plans[profile.fromGameId],demoGeneration:profile.sourceGeneration};
 assert(hash(fromPlan)===profile.sourcePlanHash,'NEXT_GAME_SOURCE_PLAN');
 await boundary();const scene=await nextDemoScene(store,oldPlan,fromPlan);
 assert(hash(scene)===profile.sceneHash&&!scene.pool.enabled&&!scene.pool.demoGeneration
  &&scene.campaign.activeGame===fromPlan.gameId&&scene.campaign.protocolValidation?.runKey===profile.sourceRunKey
  &&scene.fromPool.planHash===hash(fromPlan),'NEXT_GAME_SCENE_CHANGED');
 const parentKey=`demo-generation:${fromPlan.trialId}:${fromPlan.demoGeneration}`;
 const parent=(await store.get('journal',parentKey))?.value,done=(await store.get('journal',parentKey+':complete'))?.value;
 assert(parent&&hash(parent)===profile.sourceSpecHash&&hash(parent)===scene.fromPool.demoGeneration?.specHash
  &&done?.specHash===hash(parent)&&done.schema==='sg-demo-generation-complete-v1'&&done.commit===parent.commit&&done.run===parent.run
  &&parent.planHash===hash(fromPlan)&&parent.trialId===fromPlan.trialId&&parent.generation===fromPlan.demoGeneration
  &&parent.schema==='sg-demo-generation-residual-v1'&&Array.isArray(parent.budgets)&&parent.budgets.length===20,'NEXT_GAME_SOURCE_PROOF');
 for(let worker=0;worker<20;worker++){
  const rows=scene.sourceBatches.filter(b=>b.id>=parent.firstBatchId&&b.worker===worker);
  assert(rows.reduce((n,b)=>n+b.journaled-b.start+1,0)===parent.budgets[worker],'NEXT_GAME_SOURCE_QUOTA_NOT_SPENT');
 }
 assert(scene.sourceBatches.every(b=>!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now()),'NEXT_GAME_SOURCE_UNSETTLED');
 const key=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
 assert(!(await store.get('journal',key+':before')),'NEXT_GAME_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'NEXT_GAME_READBACK');};
 await save(key+':before',{schema:'sg-next-demo-game-v1',profileHash:hash(profile),sceneHash:hash(scene),commit,run,at:now()});
 const retired=await retireDemoPool({store,transport,gate,parser,plan:oldPlan,boundary,owner:'next-demo-game:'+run,expectedPoolHash:hash(scene.pool),commit,now});
 assert(retired.completePreserved===profile.completePreserved&&retired.abandonedAttempts===profile.abandonedAttempts,'NEXT_GAME_RETIRE_COUNT');
 await boundary();const after=await nextDemoScene(store,oldPlan,fromPlan);
 assert(hash(after.campaign)===hash(scene.campaign)&&hash(after.fromPool)===hash(scene.fromPool)
  &&hash(after.sourceBatches)===hash(scene.sourceBatches),'NEXT_GAME_SOURCE_CHANGED');
 const result=await rolloverDemo({store,transport,parser,boundary,oldPlan,plan,fromPlan,
  expected:hash({campaign:after.campaign,pool:after.pool,fromPool:after.fromPool}),commit,run,expiresAt:profile.expiresAt,activationStage:{key,profileHash:hash(profile)},now});
 assert(result.completePreserved===profile.completePreserved,'NEXT_GAME_COUNT_CHANGED');
 const complete={schema:'sg-next-demo-game-complete-v1',profileHash:hash(profile),generation:plan.demoGeneration,commit,run,
  completePreserved:retired.completePreserved,abandonedAttempts:retired.abandonedAttempts,newBetAllowance:100,sourceRequests:0,at:now()};
 await save(key+':complete',complete);return complete;
}
