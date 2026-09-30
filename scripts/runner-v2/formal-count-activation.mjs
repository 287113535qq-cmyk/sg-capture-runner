import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {pilotCloseScene} from './demo-pilot-close.mjs';
import {reviewSpentDemoGeneration} from './demo-spent-generation.mjs';
import {receiptKey} from './durable-queue.mjs';
import {checkLedger} from './complete-count.mjs';

// No source transport. The caller supplies the fresh GitHub run/lease/resource
// boundary, and the profile binds the exact immutable, successfully spent pilot.
export async function activateFormalCount({store,transport,parser,plans,profile,boundary,commit,run,now=Date.now}){
 assert(typeof boundary==='function'&&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'FORMAL_COUNT_RUNTIME');
 assert(Number.isSafeInteger(profile.createdAt)&&Number.isSafeInteger(profile.expiresAt)
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000,'FORMAL_COUNT_PROFILE_STALE');
 const plan=applyFormalCount(plans,profile)[32795],base=plans[32795],fromPlan={...base,demoGeneration:profile.sourceGeneration};
 await boundary();const scene=await pilotCloseScene(store,fromPlan),{campaign,pool,batches}=scene;
 assert(hash(scene)===profile.sceneHash&&pool.enabled&&!pool.failure&&!pool.countAllocation&&!pool.demoPilotClosed
  &&pool.planHash===hash(fromPlan)&&campaign.enabled&&campaign.activeGame===32795
  &&campaign.protocolValidation?.runKey===profile.sourceRunKey
  &&campaign.protocolValidation.commit===profile.sourceCommit
  &&campaign.protocolValidation.generation===profile.sourceGeneration,'FORMAL_COUNT_SOURCE_CHANGED');
 const parent=(await store.get('journal',`demo-generation:${base.trialId}:${profile.sourceGeneration}`))?.value;
 assert(parent?.activationStage?.profileHash===profile.sourceProfileHash&&parent.firstBatchId===1
  &&pool.confirmed===0&&pool.nextBatchId===21,'FORMAL_COUNT_PILOT_LAYOUT');
 // Pilot accounting deliberately lives in receipts, not pool.confirmed.
 const spent=await reviewSpentDemoGeneration({store,parser,basePlan:base,fromPlan,profile,
  scene:{fromPool:pool,sourceBatches:batches},now});
 assert(spent.spent===100&&spent.verified===100&&spent.newBetAllowance===0,'FORMAL_COUNT_PILOT_UNSPENT');
 const records=[];
 for(const b of batches){
  assert(b.journaled===b.start+4&&!b.failure,'FORMAL_COUNT_PILOT_LAYOUT');
  const rs=(await store.getMany('journal',Array.from({length:5},(_,i)=>receiptKey(base.trialId,b.start+i)))).map(r=>r.value);
  const mongo=await transport.request('rounds_read',{trialId:base.trialId,ids:rs.map(r=>r._id)});
  assert(hash(mongo.map(hash).sort())===hash(rs.map(hash).sort()),'FORMAL_COUNT_MONGO_CHANGED');records.push(...rs);
 }
 assert(hash(records)===profile.recordsHash&&records.filter(r=>r.normalized.bonus===1).length>=2,'FORMAL_COUNT_NATURAL_FREE_REQUIRED');
 const baseline=batches.map(b=>({id:b.id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,
  closed:true,complete:b.journaled-b.start+1,evidenceHash:hash(b)}));
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),trialId:plan.trialId,
  gameId:plan.gameId,target:plan.target,maxSequence:profile.maxSequence,baselineBatchCount:baseline.length,
  baselineHash:hash(baseline),firstSequence:pool.nextSequence,sessionRotation:profile.sessionRotation,
  runAdmission:'unique-github-run-v1',profileHash:hash(profile),sourceGeneration:profile.sourceGeneration,sourceRecordsHash:profile.recordsHash};
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 assert(!(await store.get('journal',key+':before'))&&!(await store.get('journal',key)),'FORMAL_COUNT_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'FORMAL_COUNT_READBACK');};
 await boundary();assert(hash(await pilotCloseScene(store,fromPlan))===profile.sceneHash,'FORMAL_COUNT_SOURCE_CHANGED');
 await save(key+':before',{schema:'sg-formal-count-before-v1',scene,profileHash:hash(profile),commit,run});
 await save(key,spec);
 await store.update('state','pool:'+plan.trialId,v=>{
  assert(hash(v)===hash(pool),'FORMAL_COUNT_POOL_CHANGED');
  const next={...v,planHash:hash(plan),confirmed:100,workers:{},countAllocation:{specHash:hash(spec),reserved:0,
   batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
  delete next.demoGeneration;checkLedger(next,plan,spec);return next;
 });
 await store.update('state','campaign',v=>{
  assert(hash(v)===hash(campaign),'FORMAL_COUNT_CAMPAIGN_CHANGED');
  delete v.protocolValidation;v.validationLimit=0;v.formalCount={activation:profile.activation,trialId:plan.trialId,profileHash:hash(profile)};
  return v;
 });
 const result={schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit,
  run,completePreserved:100,remainingComplete:299900,sourceRequests:0,profileHash:hash(profile)};
 await save(key+':complete',result);return result;
}
