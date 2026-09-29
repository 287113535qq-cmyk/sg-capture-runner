import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

// One residual generation for an original finite pilot. Interrupted BETs consume
// budget even after retirement; this never restores or retries an old attempt.
export function residualBudgets(parent,batches,attempts){
 assert(parent.schema==='sg-demo-generation-v1'&&parent.workers===20&&parent.perWorker===5&&parent.newBetAllowance===100,'RESIDUAL_PARENT_SCOPE');
 const used=Array(20).fill(0),seen=new Set();
 for(const b of batches.filter(b=>b.id>=parent.firstBatchId)){
  assert(Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20&&!seen.has(b.worker),'RESIDUAL_WORKER_CHANGED');seen.add(b.worker);
  const count=b.journaled-b.start+1;assert(Number.isInteger(count)&&count>=0&&count<=5,'RESIDUAL_COMPLETE_COUNT');used[b.worker]+=count;
 }
 const ids=new Set();
 for(const a of attempts){
  const b=batches.find(b=>b.id===a.batchId);
  assert(b&&b.id>=parent.firstBatchId&&b.worker===a.worker&&!ids.has(b.id)&&a.pending&&!a.pendingOriginal&&!a.bootstrapAwaiting,'RESIDUAL_ATTEMPT_SCOPE');ids.add(b.id);
  assert(a.pending.sequence===b.journaled+1&&a.pending.raw?.steps?.[0]?.msgId==='BET','RESIDUAL_ATTEMPT_CHANGED');
  used[b.worker]++; // Conservative: a saved/unknown BET consumes one, not zero.
 }
 assert(used.every(n=>n>=0&&n<=5),'RESIDUAL_BUDGET_EXCEEDED');
 return {usedByWorker:used,budgets:used.map(n=>5-n),used:used.reduce((a,b)=>a+b,0)};
}

export async function rolloverDemoResidual({store,transport,parser,boundary,basePlan,oldPlan,plan,profile,commit,run,now=Date.now}){
 assert(profile.schema==='sg-demo-residual-pilot-v1'&&plan.gameId===basePlan.gameId&&plan.buy===0&&plan.phase===1
  &&hash({...basePlan,demoGeneration:profile.parentGeneration})===hash(oldPlan)
  &&hash({...basePlan,demoGeneration:profile.generation})===hash(plan)&&plan.demoGeneration!==oldPlan.demoGeneration
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'RESIDUAL_SCOPE');
 assert(now()>=profile.createdAt&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000,'RESIDUAL_EXPIRED');
 const get=async(c,k)=>(await store.get(c,k))?.value;
 await boundary();
 const campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId),hold=await get('state','global-hold');
 assert(hash({campaign,pool,hold})===profile.snapshotHash&&!pool.enabled&&pool.planHash===hash(oldPlan)&&campaign.activeGame===plan.gameId
  &&campaign.protocolValidation.runKey==='capture-run:'+profile.sourceRun&&campaign.protocolValidation.generation===oldPlan.demoGeneration
  &&hold.active&&hold.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW','RESIDUAL_SNAPSHOT_CHANGED');
 assert(Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'RESIDUAL_WORKER_LEASE');
 const parentKey=`demo-generation:${plan.trialId}:${oldPlan.demoGeneration}`,parent=await get('journal',parentKey),parentDone=await get('journal',parentKey+':complete');
 assert(parent&&hash(parent)===pool.demoGeneration.specHash&&hash(parent)===campaign.protocolValidation.demoFresh
  &&parentDone?.specHash===hash(parent)&&parentDone.commit===parent.commit&&parentDone.run===parent.run,'RESIDUAL_PARENT_CHANGED');
 const retirement=await get('journal',pool.retiredDemo+':complete'),retiredBefore=await get('journal',pool.retiredDemo+':before'),analysis=await get('journal',pool.retiredDemo+':analysis');
 assert(retirement?.schema==='sg-retired-demo-result-v1'&&retirement.trialId===plan.trialId&&retirement.sourceRequests===0&&retirement.newBetAllowance===0
  &&retirement.beforeHash===hash(retiredBefore)&&retiredBefore.pool.demoGeneration.id===oldPlan.demoGeneration&&analysis?.sourceRequests===0
  &&retirement.abandonedAttempts===analysis.attempts.length,'RESIDUAL_RETIREMENT_CHANGED');
 assert(Number.isInteger(pool.nextBatchId)&&pool.nextBatchId>parent.firstBatchId&&pool.nextBatchId<=101,'RESIDUAL_BATCH_BOUND');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=await store.getMany('state',keys);
 assert(rows.every(Boolean),'RESIDUAL_BATCH_MISSING');const batches=rows.map(r=>r.value),records=[];
 for(const [i,b] of batches.entries()){
  assert(b.id===i+1&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now(),'RESIDUAL_BATCH_UNSAFE');
  const before=retiredBefore.batches.find(x=>x.id===b.id);assert(before&&before.sessionHash===b.sessionHash&&before.journaled===b.journaled&&before.start===b.start,'RESIDUAL_HISTORY_CHANGED');
  const ids=Array.from({length:b.journaled-b.start+1},(_,n)=>receiptKey(plan.trialId,b.start+n)),got=ids.length?await store.getMany('journal',ids):[];assert(got.every(Boolean),'RESIDUAL_RECEIPT_MISSING');
  for(const {value:r} of got){assert(r.batchId===b.id&&r.shardId===b.worker&&r.sourceSessionHash===b.sessionHash,'RESIDUAL_SESSION_CHANGED');assert((await parser.call({op:'verify',plan:basePlan,raw:r.raw,record:r})).verified,'RESIDUAL_COMPLETE_INVALID');records.push(r);}
 }
 assert(records.length===retirement.completePreserved&&records.length===profile.completePreserved,'RESIDUAL_COUNT_CHANGED');
 for(let i=0;i<records.length;i+=100){const wanted=records.slice(i,i+100),actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:wanted.map(r=>r._id)});assert(hash(actual.map(hash).sort())===hash(wanted.map(hash).sort()),'RESIDUAL_MONGO_CHANGED');}
 const budget=residualBudgets(parent,batches,analysis.attempts);
 assert(hash(budget.budgets)===hash(profile.budgets)&&budget.used===profile.usedBetAllowance&&100-budget.used===profile.newBetAllowance,'RESIDUAL_BUDGET_CHANGED');
 // The exact interrupted evidence that caused this hold is now understood.
 // Validate offline only; no attempt is restored to an active batch.
 assert(analysis.attempts.length===1&&analysis.attempts[0].batchId===profile.failureBatch,'RESIDUAL_FAILURE_CHANGED');
 const partial=analysis.attempts[0].pending;assert(hash(partial)===profile.failurePendingHash&&!partial.awaiting,'RESIDUAL_FAILURE_CHANGED');
 assert(hash(await parser.call({op:'next',plan:basePlan,raw:partial.raw}))===hash({MSGID:'FREE_GAME'}),'RESIDUAL_FIX_NOT_VERIFIED');
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;assert(!await get('journal',key+':before'),'RESIDUAL_ALREADY_STARTED');
 await boundary();assert(hash({campaign:await get('state','campaign'),pool:await get('state','pool:'+plan.trialId),hold:await get('state','global-hold')})===profile.snapshotHash,'RESIDUAL_SNAPSHOT_CHANGED');
 assert(hash((await store.getMany('state',keys)).map(r=>r?.value))===hash(batches),'RESIDUAL_BATCH_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash(await get('journal',k))===hash(v),'RESIDUAL_READBACK');};
 const before={campaign,pool,hold,batches,oldPlan,retirement,recordsHash:hash(records),budget,commit,run,at:now()};
 const spec={schema:'sg-demo-generation-residual-v1',generation:plan.demoGeneration,trialId:plan.trialId,gameId:plan.gameId,planHash:hash(plan),commit,run,createdAt:now(),expiresAt:profile.expiresAt,
  firstBatchId:pool.nextBatchId,historicalBatches:Object.fromEntries(batches.map(b=>[b.id,hash(b)])),retirement:pool.retiredDemo,retirementHash:hash(retirement),beforeHash:hash(before),
  completePreserved:records.length,perWorker:5,workers:20,newBetAllowance:profile.newBetAllowance,budgets:budget.budgets,usedBetAllowance:budget.used,parentKey,parentHash:hash(parent),
  oldSessions:[...new Set([...parent.oldSessions,...batches.map(b=>b.sessionHash),...Object.values(pool.workers).map(w=>w.sessionHash)])]};
 await save(key+':before',before);await save(key,spec);
 await boundary();
 await store.update('state','pool:'+plan.trialId,v=>{assert(hash(v)===hash(pool),'RESIDUAL_POOL_CHANGED');return {...v,enabled:true,failure:null,planHash:hash(plan),workers:{},confirmed:records.length,demoGeneration:{id:plan.demoGeneration,specHash:hash(spec)},legacyConfirmedByBatch:{...v.legacyConfirmedByBatch,...Object.fromEntries(batches.map(b=>[b.id,b.journaled-b.start+1]))}};});
 await store.update('state','campaign',v=>{assert(hash(v)===hash(campaign),'RESIDUAL_CAMPAIGN_CHANGED');return {...v,protocolValidation:{phase:'short',gameId:plan.gameId,commit,runKey:null,demoFresh:hash(spec),generation:plan.demoGeneration},validationLimit:5};});
 // Write the completion only after CAS clearing the exact reviewed hold. If any
 // earlier phase fails, admission still requires the missing completion receipt.
 await boundary();
 await store.update('state','global-hold',v=>{assert(hash(v)===hash(hold),'RESIDUAL_HOLD_CHANGED');return {...v,active:false,reason:null,details:{resolvedBy:key,previousHash:hash(hold)},at:now()};});
 const result={schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit,run,completePreserved:records.length,newBetAllowance:spec.newBetAllowance,sourceRequests:0,at:now()};
 await save(key+':complete',result);return result;
}
