import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {interruptedScene,closeInterruptedPilot} from './demo-interrupted-close.mjs';
import {freezeFinishedDemo} from './freeze-finished-demo.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';

// No source transport. Convert one reviewed adapter-only shared stop into the
// existing retirement and zero-allowance repair closure. Release the exact
// original hold last; a new/different fault always remains held.
export async function closeReviewedAdapterStop({store,transport,gate,parser,basePlan,plan,profile,boundary,commit,run,now=Date.now}){
 assert(profile.schema==='sg-ag-shared-stop-close-v1'&&profile.newBetAllowance===0&&profile.planHash===hash(plan)
  &&profile.code==='HUFF_UNREVIEWED_FEATURE_SLOTS'&&profile.createdAt<=now()&&now()<profile.expiresAt
  &&profile.expiresAt-profile.createdAt===7200000,'AG_RECLASSIFY_SCOPE');
 await boundary();const scene=await interruptedScene(store,plan),hold=await store.get('state','global-hold');
 assert(hash(scene)===profile.sceneHash&&hash(hold?.value)===profile.holdHash,'AG_RECLASSIFY_SCENE');
 assert(hold.value.active&&hold.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
  &&hold.value.details?.trialId===plan.trialId&&hold.value.details.batchId===profile.batchId
  &&hold.value.details.code===profile.code&&hold.value.details.category==='source_protocol'
  &&hold.value.details.cooldownUntil===0,'AG_RECLASSIFY_HOLD');
 const bad=scene.batches.find(b=>b.id===profile.batchId),pending=bad?.pending;
 assert(bad?.failure==='RESPONSE_VALIDATION_REQUIRES_REVIEW'&&pending?.awaiting===null&&!bad.pendingOriginal&&!bad.bootstrapAwaiting
  &&hash(pending)===profile.pendingHash&&pending.sequence===bad.journaled+1,'AG_RECLASSIFY_PENDING');
 assert(scene.batches.every(b=>b===bad||!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting),'AG_RECLASSIFY_OTHER_PENDING');
 const steps=pending.raw?.steps;
 assert(Array.isArray(steps)&&steps.length>0&&steps[0].msgId==='BET'&&steps.filter(s=>s.msgId==='BET').length===1
  &&steps.every(s=>s.responseXml&&s.responsePayload),'AG_RECLASSIFY_RAW');
 let code=null;try{await parser.call({op:'next',plan:basePlan,raw:pending.raw});}catch(e){code=e.code;}
 assert(code===profile.code,'AG_RECLASSIFY_DIAGNOSIS');
 assert(scene.campaign.activeGame===plan.gameId&&scene.campaign.protocolValidation?.runKey===profile.sourceRunKey
  &&scene.pool.planHash===hash(plan)&&!scene.pool.demoPilotClosed,'AG_RECLASSIFY_GENERATION');
 const key=`ag-shared-stop:${plan.trialId}:${plan.demoGeneration}`;
 assert(!await store.get('journal',key+':before'),'AG_RECLASSIFY_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'AG_RECLASSIFY_READBACK');};
 await save(key+':before',{schema:'sg-ag-shared-stop-before-v1',profileHash:hash(profile),scene,hold:hold.value,commit,run,at:now()});
 const frozenHash=await freezeFinishedDemo({store,boundary,plan,sourceRun:profile.sourceRunKey.replace('capture-run:',''),
  expectedPoolHash:hash(scene.pool),expectedBatches:scene.batches.map(b=>({id:b.id,hash:hash(b)})),now});
 const abandonedKey=`abandoned-demo:${plan.trialId}:${bad.id}:${hash(pending)}`;
 await save(abandonedKey,{schema:'sg-abandoned-demo-v1',trialId:plan.trialId,batchId:bad.id,reason:profile.code,
  disposition:'interrupted-abandoned-without-replay',pending,pendingOriginal:null,sourceRequests:0});
 const retired=await retireDemoPool({store,transport,gate,parser,plan,boundary,owner:'ag-retire:'+run,expectedPoolHash:frozenHash,commit,now});
 assert(retired.completePreserved===profile.completePreserved&&retired.abandonedAttempts===1,'AG_RECLASSIFY_COUNTS');
 await boundary();
 await store.update('state',`batch:${plan.trialId}:${bad.id}`,v=>{
  assert(!v.pending&&!v.pendingOriginal&&!v.bootstrapAwaiting&&v.checkpoint===v.journaled&&v.journaled===bad.journaled
   &&v.retiredDemo&&v.leaseUntil===0,'AG_RECLASSIFY_RETIREMENT');
  return {...v,failure:'PROTOCOL_VALIDATION_FAILED',adapterFailureCode:profile.code,abandonedDemo:abandonedKey};
 });
 await store.update('state','pool:'+plan.trialId,v=>{
  assert(!v.enabled&&v.planHash===hash(plan)&&v.retiredDemo,'AG_RECLASSIFY_POOL');
  return {...v,failure:'PROTOCOL_VALIDATION_FAILED',drainingProtocol:true};
 });
 await store.update('state','campaign',v=>{
  assert(hash(v)===hash(scene.campaign),'AG_RECLASSIFY_CAMPAIGN');
  const g=v.games.find(g=>g.game_id===plan.gameId);g.status='parking-protocol';
  g.pendingReview={batchId:bad.id,sequence:pending.sequence,rawHash:hash(pending.raw)};return v;
 });
 const after=await interruptedScene(store,plan);
 // This derived closure cannot grant requests. Its parent fixes the original
 // scene, completed counts, spent quota, source run and all runtime files.
 const closeProfile={...profile,schema:'sg-demo-pilot-close-v2',parentProfileHash:hash(profile),sceneHash:hash(after)};
 await save(key+':closure-profile',closeProfile);
 const closed=await closeInterruptedPilot({store,transport,parser,basePlan,plan,profile:closeProfile,boundary,commit,run,now});
 await boundary();const current=await store.get('state','global-hold');
 assert(hash(current?.value)===profile.holdHash,'AG_RECLASSIFY_NEW_HOLD');
 const released={...current.value,active:false,reason:null,agAdapterClosure:hash(closed)};
 assert(await store.cas('state','global-hold',current,released),'AG_RECLASSIFY_HOLD_CAS');
 assert(hash((await store.get('state','global-hold'))?.value)===hash(released),'AG_RECLASSIFY_HOLD_READBACK');
 const result={schema:'sg-ag-shared-stop-complete-v1',profileHash:hash(profile),closeHash:hash(closed),
  completePreserved:closed.completePreserved,used:closed.used,foregone:closed.foregone,sourceRequests:0,newBetAllowance:0,commit,run,at:now()};
 await save(key+':complete',result);return result;
}
