import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkSecondaryIdleProfile,checkIdleSecondaryCampaign} from './secondary-idle-profile.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';
import {rolloverDemo} from './demo-rollover.mjs';

export async function secondaryIdleScene(store,plan){
 const campaign=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(pool&&Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=101,'SECONDARY_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.every(Boolean),'SECONDARY_BATCH_MISSING');return {campaign,pool,batches:rows.map(r=>r.value)};
}
// No source client. Explicitly idle secondary campaign; no invented source game.
export async function activateSecondaryIdle({store,transport,gate,parser,plans,profile,boundary,commit,run,now=Date.now}){
 const oldPlan=plans[profile.gameId];checkSecondaryIdleProfile(profile,oldPlan);
 assert(profile.createdAt<=now()&&now()<profile.expiresAt&&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'SECONDARY_IDLE_SCOPE');
 const plan=applyDemoPilot(plans,profile)[profile.gameId];await boundary();
 const scene=await secondaryIdleScene(store,oldPlan);checkIdleSecondaryCampaign(scene.campaign);
 assert(hash(scene)===profile.sceneHash&&hash(scene.campaign)===profile.legacyImport.campaignHash
  &&!scene.pool.enabled&&!scene.pool.demoGeneration&&scene.pool.planHash===hash(oldPlan)
  &&scene.batches.every(b=>Number.isInteger(b.worker)&&b.worker>=20&&b.worker<40&&b.leaseUntil<=now())
  &&Object.entries(scene.pool.workers).every(([w,v])=>/^(2[0-9]|3[0-9])$/.test(w)&&v.leaseUntil<=now()),'SECONDARY_IDLE_SCENE_CHANGED');
 const imported=(await store.get('journal',scene.pool.legacyImport?.key+':complete'))?.value;
 assert(imported?.schema==='sg-parked-import-complete-v1'&&imported.specHash===hash(profile.legacyImport)
  &&scene.pool.legacyImport?.specHash===hash(profile.legacyImport)&&imported.profileHash===hash(profile)
  &&imported.commit===commit&&imported.run===run&&imported.newBetAllowance===0&&imported.sourceRequests===0,'SECONDARY_IMPORT_INCOMPLETE');
 const key=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
 assert(!await store.get('journal',key+':before'),'SECONDARY_IDLE_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'SECONDARY_IDLE_READBACK');};
 await save(key+':before',{schema:'sg-secondary-idle-before-v1',profileHash:hash(profile),sceneHash:hash(scene),commit,run,at:now()});
 const retired=await retireDemoPool({store,transport,gate,parser,plan:oldPlan,boundary,owner:'secondary-idle:'+run,expectedPoolHash:hash(scene.pool),commit,group:'secondary',now});
 assert(retired.completePreserved===profile.completePreserved&&retired.abandonedAttempts===profile.abandonedAttempts,'SECONDARY_RETIRE_COUNT');
 await boundary();const after=await secondaryIdleScene(store,oldPlan);
 assert(hash(after.campaign)===hash(scene.campaign),'SECONDARY_CAMPAIGN_CHANGED');
 const result=await rolloverDemo({store,transport,parser,boundary,oldPlan,plan,expected:hash({campaign:after.campaign,pool:after.pool,fromPool:null}),
  commit,run,expiresAt:profile.expiresAt,activationStage:{key,profileHash:hash(profile)},idleProfile:profile,now});
 assert(result.completePreserved===profile.completePreserved,'SECONDARY_COUNT_CHANGED');
 const complete={schema:'sg-next-demo-game-complete-v1',profileHash:hash(profile),generation:plan.demoGeneration,commit,run,
  completePreserved:retired.completePreserved,abandonedAttempts:retired.abandonedAttempts,newBetAllowance:100,sourceRequests:0,group:'secondary',workerOffset:20,at:now()};
 await save(key+':complete',complete);return complete;
}
