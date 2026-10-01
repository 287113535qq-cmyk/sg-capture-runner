import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {readInterruptedClosure} from './demo-interrupted-close.mjs';
import {receiptKey} from './durable-queue.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';

// Explicit repaired feature scopes only. This stage grants no BET and has no
// source transport. A separate next-game generation/admission is still required.
const extensions={
 32799:'ragingrhino-wms-v1-terminal-guarantee-v1',
 32714:'huffnpuffmoneymansionhighlimit96-round-one-base-v1-hard-hat-retrigger-v2',
 32636:'richlittlepiggiesworldclass96-round-one-base-v1-size2-free-v1',
 32718:'huffnmorepuffhighlimit96-round-one-base-v1-wheel-megahat-single-v1',
};
export async function reviewRepairCandidate({store,transport,parser,basePlan,profile,registry,now=Date.now}){
 const p=profile.repairedCandidate,plan={...basePlan,demoGeneration:p?.oldGeneration};
 assert(p?.schema==='sg-repaired-demo-candidate-v1'&&extensions[basePlan.gameId]===p.extension
  &&registry.profiles[p.extension]&&hash(registry.profiles[p.extension])===p.mappingHash
  &&hash(basePlan)===p.basePlanHash&&hash(plan)===p.oldPlanHash&&/^[a-f0-9]{64}$/.test(p.oldGeneration)
  &&profile.gameId===basePlan.gameId&&profile.generation!==p.oldGeneration
  &&/^[a-f0-9]{64}$/.test(profile.generation)
  &&profile.completePreserved===p.completePreserved&&profile.abandonedAttempts===0
  &&!profile.emptyCandidate&&!profile.legacyImport,'REPAIR_CANDIDATE_SCOPE');
 const get=async(c,k)=>(await store.get(c,k))?.value;
 const pool=await get('state','pool:'+basePlan.trialId),campaign=await get('state','campaign'),repair=await get('state',p.repairKey);
 const entry=campaign?.games.find(g=>g.game_id===basePlan.gameId);
 assert(pool&&!pool.enabled&&pool.demoGeneration?.id===p.oldGeneration&&pool.planHash===hash(plan)
  &&hash(pool)===p.poolHash&&hash(campaign)===p.campaignHash&&hash(repair)===p.repairHash
  &&entry?.status==='parked-protocol'&&entry.repairKey===p.repairKey&&campaign.activeGame!==basePlan.gameId
  &&repair.sourceAllowance===0&&repair.requiresNewSession===true
  &&['pending-adapter','reviewing-adapter','validated-awaiting-admission'].includes(repair.status),'REPAIR_CANDIDATE_SCENE');
 assert(Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=101,'REPAIR_CANDIDATE_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${basePlan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===i+1),'REPAIR_CANDIDATE_BATCH_MISSING');
 const batches=rows.map(r=>r.value),closed=await get('journal',p.closureKey+':complete'),before=await get('journal',p.closureKey+':before');
 assert(p.closureKey===`closed-demo-pilot:${basePlan.trialId}:${p.oldGeneration}`&&hash(closed)===p.closureHash
  &&closed.completePreserved===p.completePreserved&&closed.repairKey===p.repairKey&&before?.scene
  &&hash(batches)===p.batchesHash,'REPAIR_CANDIDATE_CLOSURE');
 // The old closure binds its historical campaign. The current campaign is
 // independently pinned above; changing games must not invalidate old evidence.
 await readInterruptedClosure({store,plan,closed,before,profile:{sourceSpecHash:closed.specHash,
  sourceRunKey:closed.sourceRunKey,sourceCommit:closed.sourceCommit,sourceProfileHash:closed.sourceProfileHash,
  sourceClosureHash:p.closureHash},scene:{campaign:before.scene.campaign,fromPool:pool,sourceBatches:batches}});
 assert(Object.values(pool.workers).every(w=>Number.isFinite(w.leaseUntil)&&w.leaseUntil<=now()),'REPAIR_CANDIDATE_LEASE');
 const records=[];
 for(const b of batches){
  assert(Number.isFinite(b.leaseUntil)&&b.leaseUntil<=now()&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
   &&b.checkpoint===b.journaled&&b.start>=1&&b.journaled>=b.start-1&&b.journaled<=b.end&&b.end-b.start<100,'REPAIR_CANDIDATE_PENDING');
  const ks=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(basePlan.trialId,b.start+i)),rs=ks.length?await store.getMany('journal',ks):[];
  assert(rs.length===ks.length&&rs.every(Boolean),'REPAIR_CANDIDATE_RECEIPT');
  for(const [i,{value:r}] of rs.entries()){
   assert(r.trialId===basePlan.trialId&&r.sequence===b.start+i&&r.batchId===b.id&&r.shardId===b.worker&&r.sourceSessionHash===b.sessionHash,'REPAIR_CANDIDATE_IDENTITY');
   assert((await parser.call({op:'verify',plan:basePlan,raw:r.raw,record:r})).verified,'REPAIR_CANDIDATE_PYTHON');records.push(r);
  }
 }
 assert(records.length===p.completePreserved&&new Set(records.map(r=>r._id)).size===records.length
  &&hash(records)===p.recordsHash&&p.recordsHash===closed.recordsHash,'REPAIR_CANDIDATE_RECORDS');
 for(let i=0;i<records.length;i+=100){const wanted=records.slice(i,i+100),got=await transport.request('rounds_read',{trialId:basePlan.trialId,ids:wanted.map(r=>r._id)});
  assert(hash(got.map(hash).sort())===hash(wanted.map(hash).sort()),'REPAIR_CANDIDATE_MONGO');}
 return {pool,campaign,repair,batches,closed,recordsHash:hash(records),completePreserved:records.length};
}

export async function prepareRepairCandidate({store,transport,parser,basePlan,profile,registry,boundary,commit,run,now=Date.now}){
 assert(typeof boundary==='function'&&profile.schema==='sg-demo-next-game-v1'&&profile.createdAt<=now()
  &&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'REPAIR_CANDIDATE_AUTHORIZATION');
 applyDemoPilot({[basePlan.gameId]:basePlan,[profile.fromGameId]:{gameId:profile.fromGameId}},profile);
 const key=`repaired-demo-candidate:${basePlan.trialId}:${profile.generation}`;
 await boundary();assert(!await store.get('journal',key+':before')&&!await store.get('journal',key+':complete'),'REPAIR_CANDIDATE_ALREADY_STARTED');
 const scene=await reviewRepairCandidate({store,transport,parser,basePlan,profile,registry,now}),p=profile.repairedCandidate;
 await boundary();assert(hash((await store.get('state','pool:'+basePlan.trialId))?.value)===hash(scene.pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(scene.campaign)
  &&hash((await store.get('state',p.repairKey))?.value)===hash(scene.repair),'REPAIR_CANDIDATE_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'REPAIR_CANDIDATE_READBACK');};
 await save(key+':before',{schema:'sg-repaired-demo-candidate-before-v1',profileHash:hash(profile),scene,commit,run,at:now()});
 const prepared={...scene.pool,enabled:false,planHash:hash(basePlan),confirmed:scene.completePreserved,
  repairedCandidate:{key,specHash:hash(p),closureKey:p.closureKey,closureHash:p.closureHash,repairKey:p.repairKey}};
 // All old values remain in the immutable before image and original closure.
 // No old batch, receipt, session, sequence range or applied profile is changed.
 for(const k of ['demoGeneration','demoPilotClosed','legacyImport','retiredDemo','drainingProtocol'])delete prepared[k];
 await store.update('state','pool:'+basePlan.trialId,v=>{assert(hash(v)===hash(scene.pool),'REPAIR_CANDIDATE_POOL_CHANGED');return prepared;});
 const result={schema:'sg-repaired-demo-candidate-complete-v1',profileHash:hash(profile),specHash:hash(p),planHash:hash(basePlan),
  commit,run,completePreserved:scene.completePreserved,recordsHash:scene.recordsHash,poolHash:hash(prepared),repairHash:hash(scene.repair),
  sourceRequests:0,newBetAllowance:0,foregonePreserved:scene.closed.foregone,oldUsedPreserved:scene.closed.used,at:now()};
 await save(key+':complete',result);return result;
}
