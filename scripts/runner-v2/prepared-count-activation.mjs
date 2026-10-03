import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {reviewPreparedCountScene} from './prepared-count-scene.mjs';
import {checkLedger} from './complete-count.mjs';

// A separately authorized maintenance operation converts the preserved,
// closed source into a complete-count ledger. It never invokes a game client.
export async function activatePreparedCount({store,transport,parser,base,plans,publication,group,readEvidence,
 profile,authorization,boundary,commit,run,now=Date.now}){
 assert(typeof boundary==='function'&&/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??''),
  'PREPARED_COUNT_RUNTIME');
 const plan=preparedCountPlan(base,profile,authorization);
 assert(profile.createdAt<=now()&&now()<profile.expiresAt,'PREPARED_COUNT_PROFILE_STALE');
 const key=`complete-count:${base.trialId}:${profile.activation}`;
 await boundary();
 assert(!(await store.get('journal',key))&&!(await store.get('journal',key+':before'))
  &&!(await store.get('journal',key+':complete')),'PREPARED_COUNT_ALREADY_STARTED');
 const scene=await reviewPreparedCountScene({store,transport,parser,base,plans,publication,group,readEvidence,now});
 assert(hash(scene)===profile.sceneHash&&scene.recordsHash===profile.recordsHash
  &&scene.completePreserved===profile.completePreserved&&hash(scene.closed)===profile.closureHash
  &&scene.preparationProofHash===profile.preparationProofHash
  &&scene.failureEvidenceHash===profile.failureEvidenceHash,'PREPARED_COUNT_SCENE_CHANGED');
 const baseline=scene.batches.map(b=>({id:b.id,worker:b.worker,start:b.start,end:b.end,
  sessionHash:b.sessionHash,closed:true,complete:b.journaled-b.start+1,evidenceHash:hash(b)}));
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),trialId:plan.trialId,
  gameId:plan.gameId,target:plan.target,maxSequence:profile.maxSequence,baselineBatchCount:baseline.length,
  baselineHash:hash(baseline),firstSequence:scene.pool.nextSequence,sessionRotation:profile.sessionRotation,
  runAdmission:'unique-github-run-v1',profileHash:hash(profile),sourceGeneration:scene.closed.generation,
  sourceRecordsHash:scene.recordsHash,preparationProofHash:scene.preparationProofHash};
 const pool={...scene.pool,enabled:true,failure:null,planHash:hash(plan),confirmed:scene.completePreserved,workers:{},
  countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
 for(const field of ['demoGeneration','demoPilotClosed','drainingProtocol','retiredDemo'])delete pool[field];
 checkLedger(pool,plan,spec);
 await boundary();
 assert(hash((await store.get('state','campaign'))?.value)===hash(scene.campaign)
  &&hash((await store.get('state','pool:'+base.trialId))?.value)===hash(scene.pool)
  &&hash((await store.get('state',scene.closed.repairKey))?.value)===hash(scene.repair),
 'PREPARED_COUNT_SCENE_CHANGED');
 const save=async(k,value)=>{
  await store.create('journal',k,value,{immutable:true});
  assert(hash((await store.get('journal',k))?.value)===hash(value),'PREPARED_COUNT_READBACK');
 };
 await save(key+':before',{schema:'sg-prepared-count-before-v1',scene,profileHash:hash(profile),commit,run});
 await save(key,spec);
 await store.update('state','pool:'+base.trialId,value=>{
  assert(hash(value)===hash(scene.pool),'PREPARED_COUNT_POOL_CHANGED');return pool;
 });
 await store.update('state','campaign',value=>{
  assert(hash(value)===hash(scene.campaign),'PREPARED_COUNT_CAMPAIGN_CHANGED');
  const next=structuredClone(value),game=next.games.find(g=>g.game_id===base.gameId);
  assert(game.status==='parked-protocol'&&game.repairKey===scene.closed.repairKey,'PREPARED_COUNT_CAMPAIGN_CHANGED');
  game.status='ready';game.preparationProofHash=scene.preparationProofHash;game.countActivation=profile.activation;
  next.validationLimit=0;delete next.protocolValidation;
  next.formalCount={activation:profile.activation,trialId:plan.trialId,profileHash:hash(profile)};
  if(next.activeGame===base.gameId)next.activeGame=null;
  return next;
 });
 await store.update('state',scene.closed.repairKey,value=>{
  assert(hash(value)===hash(scene.repair),'PREPARED_COUNT_REPAIR_CHANGED');
  return {...value,status:'validated-awaiting-admission',preparationProofHash:scene.preparationProofHash,
   countActivation:profile.activation,sourceAllowance:0};
 });
 const result={schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),
  commit,run,profileHash:hash(profile),completePreserved:scene.completePreserved,
  remainingComplete:profile.remainingComplete,sourceRequests:0,newBetAllowance:0};
 await save(key+':complete',result);return result;
}
