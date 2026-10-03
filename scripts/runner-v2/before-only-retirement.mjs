import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';

// Recover only an immutable before marker. A partial batch/page is never resumed here.
export async function reviewBeforeOnlyRetirement({store,plan,pool,prefix,before,proof}){
 assert(plan.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'
  &&proof?.schema==='sg-retirement-before-only-v1'&&proof.run==='36840426858:1'
  &&proof.commit==='e4afdf6aeca450710651a07ad66cf1255474d537'
  &&proof.key===prefix+':before'&&hash(before)===proof.hash&&before.schema==='sg-retired-count-before-v1'
  &&before.owner===proof.run&&hash(before.plan)===hash(plan)&&hash(before.pool)===hash(pool),'BEFORE_ONLY_RETIREMENT_SCOPE');
 assert(Object.keys(proof.batchHashes??{}).length===pool.nextBatchId-1,'BEFORE_ONLY_BATCH_SCOPE');
 const absent=[prefix+':complete'];
 for(let i=1;i<pool.nextBatchId;i++){
  absent.push(prefix+`:batch:${i}`,prefix+`:closed-decoration:${i}`);
  if(i%100===1)absent.push(prefix+`:page:${i}`);
  if(!pool.countAllocation.batches[i].closed)absent.push(`count-settlement:${plan.trialId}:${plan.countAllocation}:${i}`);
 }
 for(let start=0;start<absent.length;start+=100){const keys=absent.slice(start,start+100),rows=await store.getMany('journal',keys);
  assert(rows.length===keys.length&&rows.every(r=>!r),'BEFORE_ONLY_HAS_PARTIAL_STAGE');}
 for(let start=1;start<pool.nextBatchId;start+=100){const keys=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${plan.trialId}:${start+i}`);
  const rows=await store.getMany('state',keys);assert(rows.length===keys.length&&rows.every((r,i)=>r&&hash(r.value)===proof.batchHashes[start+i]),'BEFORE_ONLY_BATCH_CHANGED');}
 return true;
}

// A registered prepared finalizer may repeat the full audit only when its
// original immutable marker precedes every mutation. No partial retirement,
// settlement, request, or unknown write acknowledgement is resumed here.
export async function reviewPreparedBeforeOnlyRetirement({store,plan,pool,prefix,before,proof}){
 assert(proof?.schema==='sg-prepared-before-only-v1'&&/^\d+:1$/.test(proof.run??'')
  &&/^[a-f0-9]{40}$/.test(proof.commit??'')&&plan.countAllocation
  &&prefix===`retired-count:${plan.trialId}:${hash(pool).slice(0,16)}`
  &&proof.key===prefix+':before'&&proof.hash===hash(before)
  &&before.schema==='sg-retired-count-before-v1'&&before.owner===proof.run
  &&hash(before.plan)===hash(plan)&&hash(before.pool)===hash(pool),'PREPARED_BEFORE_ONLY_SCOPE');
 assert(Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>1&&pool.nextBatchId<=600001,
  'PREPARED_BEFORE_ONLY_BOUND');
 const absent=[prefix+':complete',prefix+':history'];
 for(let i=1;i<pool.nextBatchId;i++){
  absent.push(prefix+`:batch:${i}`,prefix+`:closed-decoration:${i}`);
  if(i%100===1)absent.push(prefix+`:page:${i}`);
  if(!pool.countAllocation.batches[i].closed)
   absent.push(`count-settlement:${plan.trialId}:${plan.countAllocation}:${i}`);
 }
 for(let start=0;start<absent.length;start+=100){
  const keys=absent.slice(start,start+100),rows=await store.getMany('journal',keys);
  assert(rows.length===keys.length&&rows.every(r=>!r),'PREPARED_BEFORE_ONLY_PARTIAL_STAGE');
 }
 return true;
}
