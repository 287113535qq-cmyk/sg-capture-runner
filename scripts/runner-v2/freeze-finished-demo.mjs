import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
// Boundary authenticates that every job of sourceRun has terminated. Only
// leases belonging to that exact finished run may be fenced before retirement.
export async function freezeFinishedDemo({store,boundary,plan,sourceRun,expectedPoolHash,expectedBatches,now=Date.now}){
 assert(/^\d+:1$/.test(sourceRun),'FINISHED_RUN_SCOPE');await boundary();
 const poolKey='pool:'+plan.trialId,pool=await store.get('state',poolKey);
 assert(pool&&hash(pool.value)===expectedPoolHash,'FINISHED_POOL_CHANGED');
 const keys=Array.from({length:pool.value.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=await store.getMany('state',keys);
 assert(rows.length===expectedBatches.length&&rows.every((r,i)=>r&&hash(r.value)===expectedBatches[i].hash&&r.value.id===expectedBatches[i].id),'FINISHED_BATCH_CHANGED');
 const owned=v=>typeof v.owner==='string'&&v.owner.startsWith(sourceRun+':');
 assert(Object.values(pool.value.workers).every(v=>v.leaseUntil<=now()||owned(v))&&rows.every(r=>r.value.leaseUntil<=now()||owned(r.value)),'UNRELATED_LEASE_ACTIVE');
 const prefix='finished-demo:'+plan.trialId+':'+sourceRun;
 assert(!await store.get('journal',prefix+':before'),'FINISHED_ALREADY_STARTED');
 await store.create('journal',prefix+':before',{pool:pool.value,batches:rows.map(r=>r.value),sourceRun},{immutable:true});
 await boundary();
 // Past generations remain byte-for-byte unchanged. Fence only this run.
 for(let i=0;i<rows.length;i++)if(owned(rows[i].value)){
  const r=await store.cas('state',keys[i],rows[i],{...rows[i].value,leaseUntil:0});assert(r,'FINISHED_BATCH_CAS');
 }
 const value={...pool.value,enabled:false,workers:Object.fromEntries(Object.entries(pool.value.workers).map(([k,v])=>[k,owned(v)?{...v,leaseUntil:0}:v]))};
 assert(await store.cas('state',poolKey,pool,value),'FINISHED_POOL_CAS');
 const actual=await store.get('state',poolKey);assert(hash(actual.value)===hash(value),'FINISHED_POOL_READBACK');
 await store.create('journal',prefix+':complete',{sourceRun,poolHash:hash(value),sourceRequests:0},{immutable:true});return hash(value);
}
