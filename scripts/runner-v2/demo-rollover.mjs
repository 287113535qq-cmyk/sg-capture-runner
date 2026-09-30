import {checkIdleSecondaryCampaign,checkSecondaryIdleProfile} from './secondary-idle-profile.mjs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {reviewFormalSource,readPoolBatches} from './formal-source-review.mjs';

// No source requests. A completed retirement is required before a fresh,
// bounded generation can replace the inactive worker registrations.
export async function rolloverDemo({store,transport,parser,boundary,oldPlan,plan,fromPlan,expected,commit,run,expiresAt,activationStage,formalSource,idleProfile,now=Date.now}){
 assert(typeof boundary==='function'&&/^[a-f0-9]{64}$/.test(plan.demoGeneration)&&/^[a-f0-9]{40}$/.test(commit)
  &&/^\d+:1$/.test(run)&&expiresAt>now()&&expiresAt-now()<=7200000,'ROLLOVER_SCOPE');
 const idle=!!idleProfile;if(idle){checkSecondaryIdleProfile(idleProfile,oldPlan);assert(!fromPlan&&!formalSource&&activationStage?.profileHash===hash(idleProfile),'ROLLOVER_IDLE_SCOPE');}
 const stripped={...plan};delete stripped.demoGeneration;
 assert(hash(stripped)===hash(oldPlan)&&plan.buy===0&&plan.phase===1&&(idle||fromPlan.gameId!==plan.gameId),'ROLLOVER_PLAN_CHANGED');
 const get=async(c,k)=>(await store.get(c,k))?.value;
 await boundary();
 const campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId),fromPool=idle?null:await get('state','pool:'+fromPlan.trialId);
 if(idle)checkIdleSecondaryCampaign(campaign);
 const candidate=campaign.games.find(g=>g.game_id===plan.gameId);
 if(pool.emptyCandidate){
  const key=`empty-demo-candidate:${plan.trialId}:${plan.demoGeneration}`,ready=await get('journal',key+':complete'),before=await get('journal',key+':before');
  assert(pool.emptyCandidate.key===key&&candidate?.status==='needs-adapter'&&candidate.baseline===0&&candidate.confirmed===0&&!candidate.pendingReview
   &&ready?.schema==='sg-empty-demo-candidate-complete-v1'&&ready.profileHash===activationStage?.profileHash
   &&ready.planHash===hash(oldPlan)&&ready.commit===commit&&ready.run===run
   &&ready.sourceRequests===0&&ready.newBetAllowance===0&&ready.historicalCredit===0
   &&before?.profileHash===ready.profileHash&&hash(before.campaign)===hash(campaign),'ROLLOVER_EMPTY_CANDIDATE_INCOMPLETE');
 }
 assert(hash({campaign,pool,fromPool})===expected&&((formalSource||idle)?campaign.activeGame===null:campaign.activeGame===fromPlan.gameId)
  &&(candidate?.status==='parked-protocol'||(candidate?.status==='needs-adapter'&&pool.emptyCandidate))&&!pool.enabled&&!pool.demoGeneration
  &&pool.planHash===hash(oldPlan)&&pool.retiredDemo,'ROLLOVER_SNAPSHOT_CHANGED');
 assert(Object.values(pool.workers).every(w=>w.leaseUntil<=now())&&(idle||Object.values(fromPool.workers).every(w=>w.leaseUntil<=now())),'ROLLOVER_LEASE_ACTIVE');
 const sourceBatches=idle?[]:await readPoolBatches(store,fromPlan,fromPool,{limit:formalSource?600001:101});
 assert(sourceBatches.every(b=>!b.pending&&!b.bootstrapAwaiting&&!b.pendingOriginal&&b.checkpoint===b.journaled&&b.leaseUntil<=now()),'ROLLOVER_SOURCE_BATCH_UNSAFE');
 if(formalSource)await reviewFormalSource({store,plan:fromPlan,profile:{sourceFormal:formalSource},scene:{campaign,fromPool,sourceBatches},now});
 const retired=await get('journal',pool.retiredDemo+':complete');
 assert(retired?.schema==='sg-retired-demo-result-v1'&&retired.trialId===plan.trialId&&retired.sourceRequests===0&&retired.newBetAllowance===0,'ROLLOVER_RETIREMENT_MISSING');
 assert(Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=101,'ROLLOVER_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.every(Boolean),'ROLLOVER_BATCH_MISSING');const batches=rows.map(x=>x.value),records=[],unchangedRetiredBatches={};
 let retirementBefore;
 for(const b of batches){
  assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now(),'ROLLOVER_BATCH_UNSAFE');
  if(b.retiredDemo!==pool.retiredDemo){
   // Already flushed or empty history is preserved verbatim by retirement.
   retirementBefore??=await get('journal',pool.retiredDemo+':before');
   assert(retirementBefore?.schema==='sg-retired-demo-v1'&&hash(retirementBefore)===retired.beforeHash
    &&hash(retirementBefore.plan)===hash(oldPlan)
    &&hash(retirementBefore.batches.find(x=>x.id===b.id))===hash(b),'ROLLOVER_UNCHANGED_RETIREMENT_PROOF');
   unchangedRetiredBatches[b.id]=hash(b);
  }
  const ids=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(plan.trialId,b.start+i));
  const got=ids.length?await store.getMany('journal',ids):[];assert(got.every(Boolean),'ROLLOVER_RECEIPT_MISSING');
  for(const {value:r} of got){assert(r.batchId===b.id&&r.shardId===b.worker&&r.sourceSessionHash===b.sessionHash,'ROLLOVER_SESSION_CHANGED');assert((await parser.call({op:'verify',plan:oldPlan,raw:r.raw,record:r})).verified,'ROLLOVER_INVALID_COMPLETE');records.push(r);}
 }
 assert(records.length===retired.completePreserved,'ROLLOVER_COUNT_CHANGED');
 for(let i=0;i<records.length;i+=100){const wanted=records.slice(i,i+100),actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:wanted.map(r=>r._id)});assert(hash(actual.map(hash).sort())===hash(wanted.map(hash).sort()),'ROLLOVER_MONGO_CHANGED');}
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;assert(!await get('journal',key+':before'),'ROLLOVER_ALREADY_STARTED');
 await boundary();assert(hash({campaign:await get('state','campaign'),pool:await get('state','pool:'+plan.trialId),fromPool:idle?null:await get('state','pool:'+fromPlan.trialId)})===expected,'ROLLOVER_SNAPSHOT_CHANGED');
 assert(hash((keys.length?await store.getMany('state',keys):[]).map(x=>x?.value))===hash(batches),'ROLLOVER_BATCH_CHANGED');
 assert(hash(idle?[]:await readPoolBatches(store,fromPlan,fromPool,{limit:formalSource?600001:101}))===hash(sourceBatches),'ROLLOVER_SOURCE_BATCH_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await get('journal',k))===hash(v),'ROLLOVER_READBACK');};
 const before={campaign,pool,fromPool,batches,sourceBatches,oldPlan,fromPlan:fromPlan??null,recordsHash:hash(records),commit,run,at:now()};
 const spec={schema:'sg-demo-generation-v1',generation:plan.demoGeneration,trialId:plan.trialId,gameId:plan.gameId,planHash:hash(plan),commit,run,createdAt:now(),expiresAt,firstBatchId:pool.nextBatchId,
  historicalBatches:Object.fromEntries(batches.map(b=>[b.id,hash(b)])),retirement:pool.retiredDemo,retirementHash:hash(retired),beforeHash:hash(before),completePreserved:records.length,perWorker:5,workers:20,newBetAllowance:100,
  oldSessions:[...new Set([...Object.values(pool.workers).map(w=>w.sessionHash),...batches.map(b=>b.sessionHash)].filter(Boolean))],
  ...(idle?{group:'secondary',workerOffset:20}:{}),
  ...(activationStage?{activationStage}:{}),
  ...(Object.keys(unchangedRetiredBatches).length?{unchangedRetiredBatches}:{})};
 await save(key+':before',before);await save(key,spec);
 if(!idle)await save(key+':parked-source',{gameId:fromPlan.gameId,plan:fromPlan,campaign,pool:fromPool,at:now()});
 await boundary();
 if(!idle)await store.update('state','pool:'+fromPlan.trialId,v=>{assert(hash(v)===hash(fromPool),'ROLLOVER_SOURCE_CHANGED');return {...v,enabled:false};});
 await store.update('state','pool:'+plan.trialId,v=>{assert(hash(v)===hash(pool),'ROLLOVER_POOL_CHANGED');return {...v,enabled:true,failure:null,planHash:hash(plan),workers:{},confirmed:records.length,demoGeneration:{id:plan.demoGeneration,specHash:hash(spec)},legacyConfirmedByBatch:{...v.legacyConfirmedByBatch,...Object.fromEntries(batches.map(b=>[b.id,b.journaled-b.start+1]))}};});
 await boundary();
 await store.update('state','campaign',v=>{assert(hash(v)===hash(campaign),'ROLLOVER_CAMPAIGN_CHANGED');if(!idle){const sourceGame=v.games.find(g=>g.game_id===fromPlan.gameId);if(!formalSource||formalSource.kind==='retired')sourceGame.status='parked-protocol';if(fromPool.demoPilotClosed?.repairKey)sourceGame.repairKey=fromPool.demoPilotClosed.repairKey;}v.games.find(g=>g.game_id===plan.gameId).status='active';v.activeGame=plan.gameId;if(formalSource)delete v.formalCount;v.enabled=true;v.audit=null;v.validationLimit=5;v.protocolValidation={phase:'short',gameId:plan.gameId,commit,runKey:null,demoFresh:hash(spec),generation:plan.demoGeneration};return v;});
 const result={schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit,run,completePreserved:records.length,sourceRequests:0,at:now()};
 await save(key+':complete',result);return result;
}
