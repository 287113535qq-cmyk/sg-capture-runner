import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter} from './mongo-writer.mjs';
import {checkLedger,settleCountBatch,auditCountBatch} from './complete-count.mjs';

// Formal pools can have thousands of historical batches. Stream receipts and
// private snapshots in bounded pages; retain immutable closed batches verbatim.
export async function retireCountPool({store,transport,gate,parser,plan,boundary,owner,expectedPoolHash,pool,spec,now=Date.now}){
 assert(spec.sessionRotation==='closed-batches-v1'&&!pool.enabled&&hash(pool)===expectedPoolHash
  &&pool.planHash===hash(plan)&&Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'COUNT_RETIRE_POOL_UNSAFE');
 checkLedger(pool,plan,spec);
 const prefix=`retired-count:${plan.trialId}:${expectedPoolHash.slice(0,16)}`,save=async(k,v)=>{
  await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'COUNT_RETIRE_READBACK');
 };
 assert(!(await store.get('journal',prefix+':before')),'COUNT_RETIRE_ALREADY_STARTED');
 await save(prefix+':before',{schema:'sg-retired-count-before-v1',plan,pool,owner,at:now()});
 let complete=0,abandoned=0;const digest=createHash('sha256'),settlements=[];
 for(let start=1;start<pool.nextBatchId;start+=100){
  await boundary();
  assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===expectedPoolHash,'COUNT_RETIRE_POOL_CHANGED');
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${plan.trialId}:${start+i}`);
  const rows=await store.getMany('state',keys);assert(rows.every(Boolean),'COUNT_RETIRE_BATCH_MISSING');
  const page=[];
  for(const [i,row] of rows.entries()){
   const b=row.value,item=pool.countAllocation.batches[b.id];
   assert(b.id===start+i&&item&&b.worker===item.worker&&b.sessionHash===item.sessionHash
    &&b.start===item.start&&b.end===item.end&&b.end-b.start<100&&b.leaseUntil<=now()
    &&Number.isSafeInteger(b.checkpoint)&&Number.isSafeInteger(b.journaled)
    &&b.start-1<=b.checkpoint&&b.checkpoint<=b.journaled&&b.journaled<=b.end,'COUNT_RETIRE_BATCH_UNSAFE');
   const count=b.journaled-b.start+1;
   const receiptKeys=Array.from({length:count},(_,n)=>receiptKey(plan.trialId,b.start+n));
   const records=receiptKeys.length?(await store.getMany('journal',receiptKeys)).map(r=>r?.value):[];
   assert(records.every(Boolean),'COUNT_RETIRE_RECEIPT_MISSING');
   for(const [n,r] of records.entries()){
    assert(r.sequence===b.start+n&&r.batchId===b.id&&r.shardId===b.worker&&r.sourceSessionHash===b.sessionHash
     &&r.trialId===plan.trialId&&r.fixtureOnly===false&&r.buy===0,'COUNT_RETIRE_RECORD_CHANGED');
    assert((await parser.call({op:'verify',plan,raw:r.raw,record:r})).verified===true,'COUNT_RETIRE_RECORD_INVALID');
    digest.update(hash(r)+'\n');
   }
   const key=keys[i];
   if(item.closed){
    assert(count===item.complete&&b.pending===null&&!b.pendingOriginal&&!b.bootstrapAwaiting
     &&b.checkpoint===b.journaled,'COUNT_RETIRE_CLOSED_CHANGED');
    // Even a zero-record closed batch must preserve its immutable evidence.
    await auditCountBatch({store,pool,plan,spec,record:{batchId:b.id},cache:new Map()});
   }else{
    const beforeKey=prefix+`:batch:${b.id}`;
    await save(beforeKey,{schema:'sg-retired-count-batch-v1',batch:b,recordsHash:hash(records),sourceRequests:0,
     disposition:b.pending?.awaiting||b.bootstrapAwaiting?'unknown-abandoned-without-replay':'interrupted-abandoned-without-replay'});
    await boundary();await store.update('state',key,v=>{
     assert(hash(v)===hash(b),'COUNT_RETIRE_BATCH_CHANGED');return {...v,owner,epoch:b.epoch+1,leaseUntil:0};
    });
    const queue=new DurableQueue({store,plan,batchKey:key,owner,epoch:b.epoch+1}),writer=new MongoWriter({gate,queue,
     permits:new WritePermits({store,group:'primary',owner,now}),sink:{read:ids=>transport.request('rounds_read',{trialId:plan.trialId,ids}),
      insert:records=>transport.request('rounds_insert',{trialId:plan.trialId,records})}});
    const waiting=await queue.outstanding();if(waiting.length){const r=await writer.deliver(waiting);assert(!r.paused&&r.confirmed===waiting.length,'COUNT_RETIRE_FLUSH');}
    assert((await queue.outstanding()).length===0,'COUNT_RETIRE_FLUSH');
    await store.update('state',key,v=>{
     assert(v.owner===owner&&v.epoch===b.epoch+1&&v.journaled===b.journaled&&v.checkpoint===v.journaled
      &&hash(v.pending)===hash(b.pending),'COUNT_RETIRE_PROGRESS_CHANGED');
     return {...v,pending:null,pendingOriginal:null,bootstrapAwaiting:null,protocolResume:null,failure:null,retiredCount:beforeKey};
    });
    const frozen=(await store.get('state',key)).value,settlementKey=`count-settlement:${plan.trialId}:${spec.activation}:${b.id}`;
    const evidence={schema:'sg-count-batch-settlement-v1',activation:spec.activation,trialId:plan.trialId,batch:frozen,fullReadback:true};
    settlements.push({batch:{id:b.id,worker:b.worker,start:b.start,end:b.end},evidence,key:settlementKey});
    abandoned+=Number(!!(b.pending||b.pendingOriginal||b.bootstrapAwaiting));
   }
   if(records.length){const actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)});
    assert(hash(actual.map(hash).sort())===hash(records.map(hash).sort()),'MONGO_CONTENT_CONFLICT');}
   complete+=records.length;page.push({batchId:b.id,beforeHash:hash(b),recordsHash:hash(records),complete:records.length});
  }
  await save(prefix+`:page:${start}`,{schema:'sg-retired-count-page-v1',entries:page});
 }
 // Full Mongo readback precedes every settlement receipt and final pool CAS.
 for(const s of settlements)await save(s.key,s.evidence);
 await boundary();await store.update('state','pool:'+plan.trialId,v=>{
  assert(hash(v)===expectedPoolHash,'COUNT_RETIRE_POOL_CHANGED');
  for(const s of settlements)settleCountBatch({pool:v,plan,spec,worker:s.batch.worker,...s});
  assert(v.confirmed===complete&&v.countAllocation.reserved===0,'COUNT_RETIRE_COUNT_CHANGED');
  return {...v,retiredCount:prefix};
 });
 const result={schema:'sg-retired-count-result-v1',trialId:plan.trialId,completePreserved:complete,abandonedAttempts:abandoned,
  recordsHash:digest.digest('hex'),sourceRequests:0,newBetAllowance:0,beforeHash:hash({plan,pool}),at:now()};
 await save(prefix+':complete',result);return result;
}
