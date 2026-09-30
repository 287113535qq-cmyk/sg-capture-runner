import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {pyramidsCountPlan} from './pyramids-count-profile.mjs';
import {pilotCloseScene} from './demo-pilot-close.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
import {auditSessionOwner} from './demo-session-audit.mjs';
import {receiptKey} from './durable-queue.mjs';
import {checkLedger} from './complete-count.mjs';

export async function activatePyramidsCount({store,transport,parser,plans,profile,boundary,commit,run,now=Date.now}){
 const base=plans[32721],plan=pyramidsCountPlan(base,profile),from={...base,demoGeneration:profile.sourceGeneration};
 assert(typeof boundary==='function'&&/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??''),'PYRAMIDS_COUNT_RUNTIME');
 assert(Number.isSafeInteger(profile.createdAt)&&Number.isSafeInteger(profile.expiresAt)&&profile.createdAt<=now()
  &&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000,'PYRAMIDS_COUNT_STALE');
 await boundary();const scene=await pilotCloseScene(store,from),{campaign,pool,batches}=scene;
 assert(hash(scene)===profile.sceneHash&&campaign.group==='secondary'&&campaign.enabled&&campaign.activeGame===32721
  &&campaign.validationLimit===5&&campaign.protocolValidation?.generation===from.demoGeneration
  &&campaign.protocolValidation.runKey===profile.sourceRunKey&&campaign.protocolValidation.commit===profile.sourceCommit
  &&pool.enabled&&!pool.failure&&!pool.countAllocation&&!pool.demoPilotClosed&&pool.confirmed===1262
  &&pool.planHash===hash(from)&&pool.nextBatchId===48&&batches.length===47,'PYRAMIDS_COUNT_SCENE_CHANGED');
 assert(campaign.games.find(g=>g.game_id===32721)?.baseline===150,'PYRAMIDS_COUNT_BASELINE_CHANGED');
 const specKey=`demo-generation:${from.trialId}:${from.demoGeneration}`;
 const parent=(await store.get('journal',specKey))?.value,done=(await store.get('journal',specKey+':complete'))?.value;
 assert(parent?.schema==='sg-demo-generation-v1'&&parent.group==='secondary'&&parent.workerOffset===20&&parent.firstBatchId===28
  &&parent.workers===20&&parent.perWorker===5&&parent.newBetAllowance===100&&parent.completePreserved===1262
  &&parent.activationStage?.profileHash===profile.sourceProfileHash&&parent.planHash===hash(from)
  &&hash(parent)===profile.sourceSpecHash&&pool.demoGeneration?.specHash===hash(parent)
  &&done?.schema==='sg-demo-generation-complete-v1'&&done.specHash===hash(parent)&&done.commit===parent.commit&&done.run===parent.run
  &&await demoRuntimeCommit({store,plan:from,spec:parent,campaign})===profile.sourceCommit,'PYRAMIDS_COUNT_SOURCE_PROOF');
 const topKey=`next-demo-game:${from.trialId}:${from.demoGeneration}`,top=(await store.get('journal',topKey+':complete'))?.value;
 assert(parent.activationStage.key===topKey&&top?.schema==='sg-next-demo-game-complete-v1'&&top.profileHash===profile.sourceProfileHash
  &&top.commit===parent.commit&&top.run===parent.run&&top.generation===from.demoGeneration&&top.newBetAllowance===100
  &&top.sourceRequests===0&&top.completePreserved===1262&&campaign.protocolValidation.demoFresh===hash(parent),'PYRAMIDS_COUNT_ACTIVATION_PROOF');
 assert(Object.values(pool.workers).every(w=>Number.isFinite(w.leaseUntil)&&w.leaseUntil<=now()),'PYRAMIDS_COUNT_ACTIVE_WORKER');
 assert(batches.every((b,i)=>b.id===i+1&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled
  &&Number.isSafeInteger(b.journaled)&&b.journaled>=b.start-1&&b.journaled<=b.end&&Number.isFinite(b.leaseUntil)&&b.leaseUntil<=now()),'PYRAMIDS_COUNT_UNSETTLED');
 const recent=batches.slice(27);
 assert(recent.every(b=>!b.failure&&!b.abandonedDemo&&b.journaled===b.start+4)
  &&Array.from({length:20},(_,i)=>i+20).every(w=>recent.filter(b=>b.worker===w).length===1),'PYRAMIDS_COUNT_PILOT_NOT_SPENT');
 const records=[],cache=new Map();let oldCount=0,newHold=0;
 for(const b of batches){
  const n=b.journaled-b.start+1;
  for(let offset=0;offset<n;offset+=100){
   const keys=Array.from({length:Math.min(100,n-offset)},(_,i)=>receiptKey(base.trialId,b.start+offset+i));
   const receipts=await store.getMany('journal',keys);assert(receipts.length===keys.length&&receipts.every(Boolean),'PYRAMIDS_COUNT_RECEIPT_MISSING');
   const rs=receipts.map(r=>r.value),mongo=await transport.request('rounds_read',{trialId:base.trialId,ids:rs.map(r=>r._id)});
   assert(hash(mongo.map(hash).sort())===hash(rs.map(hash).sort()),'PYRAMIDS_COUNT_MONGO_CHANGED');
   for(const [i,r] of rs.entries()){
    assert(r.trialId===base.trialId&&r.sequence===b.start+offset+i&&r.batchId===b.id&&r.shardId===b.worker
     &&r.sourceSessionHash===b.sessionHash&&!r.fixtureOnly&&r.buy===0,'PYRAMIDS_COUNT_RECORD_SCOPE');
    assert((await parser.call({op:'verify',plan:base,raw:r.raw,record:r})).verified,'PYRAMIDS_COUNT_PYTHON');
    await auditSessionOwner({store,plan:from,pool,record:r,cache});records.push(r);
    if(b.id<28)oldCount++;else if(r.normalized.bonus===1)newHold++;
   }
  }
 }
 assert(oldCount===1262&&records.length===1362&&new Set(records.map(r=>r._id)).size===1362&&newHold>=1
  &&hash(records.map(hash).sort())===profile.recordsHash,'PYRAMIDS_COUNT_RECORDS_CHANGED');
 // Also reject records outside the authenticated receipts, using bounded pages.
 let after=0,seen=[];
 for(;;){const rows=await transport.request('rounds_scan',{trialId:base.trialId,after});assert(Array.isArray(rows)&&rows.length<=100,'PYRAMIDS_COUNT_PAGE');
  if(!rows.length)break;for(const r of rows){assert(r.sequence>after,'PYRAMIDS_COUNT_CURSOR');after=r.sequence;seen.push(hash(r));assert(seen.length<=1362,'PYRAMIDS_COUNT_EXCESS');}}
 assert(hash(seen.sort())===profile.recordsHash,'PYRAMIDS_COUNT_SCAN_CHANGED');
 const baseline=batches.map(b=>({id:b.id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:b.journaled-b.start+1,evidenceHash:hash(b)}));
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),trialId:plan.trialId,gameId:32721,
  target:plan.target,maxSequence:profile.maxSequence,baselineBatchCount:47,baselineHash:hash(baseline),firstSequence:pool.nextSequence,
  sessionRotation:profile.sessionRotation,runAdmission:'unique-github-run-v1',profileHash:hash(profile),sourceGeneration:from.demoGeneration,sourceRecordsHash:profile.recordsHash};
 const nextPool={...pool,planHash:hash(plan),confirmed:1362,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
 delete nextPool.demoGeneration;checkLedger(nextPool,plan,spec);
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 assert(!(await store.get('journal',key+':before'))&&!(await store.get('journal',key))&&!(await store.get('journal',key+':complete')),'PYRAMIDS_COUNT_ALREADY_STARTED');
 await boundary();assert(hash(await pilotCloseScene(store,from))===profile.sceneHash,'PYRAMIDS_COUNT_SOURCE_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'PYRAMIDS_COUNT_READBACK');};
 await save(key+':before',{schema:'sg-formal-count-before-v1',scene,profileHash:hash(profile),commit,run});await save(key,spec);
 await store.update('state','pool:'+plan.trialId,v=>{assert(hash(v)===hash(pool),'PYRAMIDS_COUNT_POOL_CHANGED');return nextPool;});
 await store.update('state','campaign',v=>{assert(hash(v)===hash(campaign),'PYRAMIDS_COUNT_CAMPAIGN_CHANGED');delete v.protocolValidation;v.validationLimit=0;
  v.formalCount={activation:profile.activation,trialId:plan.trialId,profileHash:hash(profile)};return v;});
 const result={schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit,run,
  completePreserved:1362,remainingComplete:298488,sourceRequests:0,profileHash:hash(profile)};
 await save(key+':complete',result);return result;
}
