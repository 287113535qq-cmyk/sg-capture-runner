import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {readClosedPilot} from './demo-pilot-close.mjs';
// Read-only proof that the previous finite generation is finished and spent.
// A completed v1 pilot is not a new source allowance for the previous game.
export async function reviewSpentDemoGeneration({store,parser,basePlan,fromPlan,profile,scene,now=Date.now}){
 const get=async k=>(await store.get('journal',k))?.value,key=`demo-generation:${fromPlan.trialId}:${fromPlan.demoGeneration}`;
 const parent=await get(key),done=await get(key+':complete');
 assert(parent&&hash(parent)===profile.sourceSpecHash&&hash(parent)===scene.fromPool.demoGeneration?.specHash
  &&done?.specHash===hash(parent)&&done.schema==='sg-demo-generation-complete-v1'&&done.commit===parent.commit&&done.run===parent.run
  &&parent.planHash===hash(fromPlan)&&parent.trialId===fromPlan.trialId&&parent.generation===fromPlan.demoGeneration,'NEXT_GAME_SOURCE_PROOF');
 const residual=parent.schema==='sg-demo-generation-residual-v1';
 assert(residual||parent.schema==='sg-demo-generation-v1','NEXT_GAME_SOURCE_PROOF');
 let budgets,closure;
 if(residual){
  assert(Array.isArray(parent.budgets)&&parent.budgets.length===20&&parent.budgets.every(n=>Number.isInteger(n)&&n>=0&&n<=5),'NEXT_GAME_SOURCE_PROOF');budgets=parent.budgets;
 }else{
  assert(parent.workers===20&&parent.perWorker===5&&parent.newBetAllowance===100,'NEXT_GAME_SOURCE_PROOF');budgets=Array(20).fill(5);
  if(parent.activationStage){const a=parent.activationStage,k=`next-demo-game:${parent.trialId}:${parent.generation}`,top=await get(k+':complete');
   assert(a.key===k&&/^[a-f0-9]{64}$/.test(a.profileHash)&&top?.schema==='sg-next-demo-game-complete-v1'&&top.profileHash===a.profileHash&&top.generation===parent.generation&&top.commit===parent.commit&&top.run===parent.run&&top.newBetAllowance===100&&top.sourceRequests===0,'NEXT_GAME_SOURCE_ACTIVATION');
  }
 }
 if(profile.sourceClosureHash||scene.fromPool.demoPilotClosed){
  assert(!residual,'NEXT_GAME_CLOSURE_SCHEMA');closure=await readClosedPilot({store,plan:fromPlan,profile,scene});budgets=closure.usedByWorker;
 }
 assert(Number.isSafeInteger(parent.firstBatchId)&&parent.firstBatchId>=1&&parent.firstBatchId<=scene.fromPool.nextBatchId,'NEXT_GAME_SOURCE_BATCH_BOUND');
 assert(scene.sourceBatches.length===scene.fromPool.nextBatchId-1
  &&scene.sourceBatches.every((b,i)=>b.id===i+1),'NEXT_GAME_SOURCE_BATCH_COVERAGE');
 assert(scene.sourceBatches.every(b=>!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled&&b.leaseUntil<=now()),'NEXT_GAME_SOURCE_UNSETTLED');
 assert(Object.values(scene.fromPool.workers).every(w=>w.leaseUntil<=now()),'NEXT_GAME_SOURCE_UNSETTLED');
 const rows=scene.sourceBatches.filter(b=>b.id>=parent.firstBatchId);
 assert(rows.every(b=>Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20&&Number.isSafeInteger(b.journaled)&&b.start-1<=b.journaled&&b.journaled<=b.end),'NEXT_GAME_SOURCE_BATCH_BOUND');
 for(let worker=0;worker<20;worker++)assert(rows.filter(b=>b.worker===worker).reduce((n,b)=>n+b.journaled-b.start+1,0)===budgets[worker],'NEXT_GAME_SOURCE_QUOTA_NOT_SPENT');
 // New v1 support additionally verifies the actual complete BET records, not
 // just high-water marks. Existing applied residual evidence stays unchanged.
 let verified=0;
 if(!residual)for(const b of rows){
  const keys=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(fromPlan.trialId,b.start+i));
  const records=keys.length?await store.getMany('journal',keys):[];assert(records.length===keys.length&&records.every(Boolean),'NEXT_GAME_SOURCE_RECEIPT_MISSING');
  for(const [i,{value:r}] of records.entries()){
   assert(r.trialId===fromPlan.trialId&&r.batchId===b.id&&r.shardId===b.worker&&r.sequence===b.start+i&&r.sourceSessionHash===b.sessionHash
    &&r.raw?.steps?.[0]?.msgId==='BET'&&r.raw.steps.filter(s=>s.msgId==='BET').length===1,'NEXT_GAME_SOURCE_RECEIPT_CHANGED');
   assert((await parser.call({op:'verify',plan:basePlan,raw:r.raw,record:r})).verified,'NEXT_GAME_SOURCE_RECORD_INVALID');verified++;
  }
 }
 return {schema:parent.schema,spent:budgets.reduce((a,b)=>a+b,0),verified,newBetAllowance:0,...(closure?{foregone:closure.foregone,closureHash:hash(closure)}:{})};
}
