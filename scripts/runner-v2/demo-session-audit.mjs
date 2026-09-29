import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Generation rollover must preserve ownership of completed historical batches.
// This is an audit check, not an authorization to rotate a source session.
export async function auditSessionOwner({store,plan,pool,record,cache=new Map()}) {
 if(plan.demoGeneration===undefined){
  assert(!pool.demoGeneration,'AUDIT_GENERATION_PLAN_MISSING');
  assert(pool.workers[String(record.shardId)]?.sessionHash===record.sourceSessionHash,'AUDIT_SESSION_CHANGED');return;
 }
 assert(/^[a-f0-9]{64}$/.test(plan.demoGeneration)&&pool.demoGeneration?.id===plan.demoGeneration,'AUDIT_GENERATION_CHANGED');
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;
 const read=async(collection,key)=>{const id=collection+'/'+key;if(!cache.has(id))cache.set(id,(await store.get(collection,key))?.value);return cache.get(id);};
 const spec=await read('journal',key);
 assert(spec&&hash(spec)===pool.demoGeneration.specHash&&['sg-demo-generation-v1','sg-demo-generation-residual-v1'].includes(spec.schema)
  &&spec.generation===plan.demoGeneration&&spec.trialId===plan.trialId&&spec.planHash===hash(plan),'AUDIT_GENERATION_PROOF');
 assert(Number.isSafeInteger(spec.firstBatchId)&&spec.firstBatchId>=1
  &&Object.keys(spec.historicalBatches).length===spec.firstBatchId-1,'AUDIT_GENERATION_HISTORY');
 const batch=await read('state',`batch:${plan.trialId}:${record.batchId}`);
 assert(batch&&batch.id===record.batchId&&batch.worker===record.shardId&&batch.sessionHash===record.sourceSessionHash
  &&record.sequence>=batch.start&&record.sequence<=batch.checkpoint&&batch.checkpoint<=batch.journaled,'AUDIT_BATCH_SESSION_CHANGED');
 if(batch.id<spec.firstBatchId){
  assert(hash(batch)===spec.historicalBatches[String(batch.id)]&&batch.pending===null&&batch.checkpoint===batch.journaled,'AUDIT_HISTORICAL_BATCH_CHANGED');
  if(spec.schema==='sg-demo-generation-v1')assert(batch.retiredDemo===spec.retirement,'AUDIT_HISTORICAL_BATCH_CHANGED');
  else {
   const before=await read('journal',key+':before');
   assert(before&&hash(before)===spec.beforeHash&&hash(before.batches.find(b=>b.id===batch.id))===hash(batch),'AUDIT_RESIDUAL_HISTORY');
  }
  const retired=await read('journal',spec.retirement+':complete');
  assert(retired&&hash(retired)===spec.retirementHash&&retired.trialId===plan.trialId
   &&retired.schema==='sg-retired-demo-result-v1','AUDIT_RETIREMENT_CHANGED');
 }else{
  assert(pool.workers[String(record.shardId)]?.sessionHash===record.sourceSessionHash,'AUDIT_SESSION_CHANGED');
 }
}
