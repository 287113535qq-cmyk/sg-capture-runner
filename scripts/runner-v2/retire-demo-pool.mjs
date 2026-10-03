import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter} from './mongo-writer.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {retireCountPool} from './retire-count-pool.mjs';

// Retire an idle demo pool without attempting source-session recovery. Complete
// records are verified/flushed; interrupted attempts are retained only in the
// private analysis journal and removed from active batches. No source transport.
export async function retireDemoPool({store,transport,gate,parser,plan,boundary,owner,expectedPoolHash,commit=process.env.GITHUB_SHA,group='primary',closedBatchDecorations=[],beforeOnlyRecovery,historyPermit,capturedFault,closedReadbackReuse,now=Date.now}){
 assert(typeof boundary==='function'&&plan.buy===0&&plan.phase===1&&typeof owner==='string'&&owner.length>0,'RETIRE_SCOPE');
 assert(group==='primary'||(group==='secondary'&&([32719,32721].includes(plan.gameId)&&plan.trialId===`sg_r1_20260928_${plan.gameId}`
  ||plan.gameId===32812&&plan.trialId==='sg_r1_20261003_32812'&&plan.adapter==='veryfruity-wms-action-v1'&&plan.runnerGroup==='secondary')),'RETIRE_GROUP_SCOPE');
 await boundary();await store.writable();
 const poolKey='pool:'+plan.trialId,pool=(await store.get('state',poolKey))?.value;
 const countSpec=pool?await loadCountPermission({store,plan,pool,commit}):null;
 if(countSpec?.sessionRotation==='closed-batches-v1')return retireCountPool({store,transport,gate,parser,plan,boundary,owner,expectedPoolHash,pool,spec:countSpec,group,closedBatchDecorations,beforeOnlyRecovery,historyPermit,capturedFault,closedReadbackReuse,now});
 assert(!closedReadbackReuse,'CLOSED_READBACK_FORMAL_SCOPE');
 assert(!capturedFault,'COUNT_FAULT_FORMAL_SCOPE');
 assert(!beforeOnlyRecovery,'BEFORE_ONLY_FORMAL_SCOPE');
 assert(pool&&!pool.enabled&&pool.planHash===hash(plan)&&hash(pool)===expectedPoolHash&&pool.nextBatchId>0&&pool.nextBatchId<=101,'RETIRE_POOL_CHANGED');
 assert(Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'RETIRE_WORKER_ACTIVE');
 const prefix='retired-demo:'+plan.trialId+':'+expectedPoolHash.slice(0,16);
 assert(!(await store.get('journal',prefix+':before')),'RETIRE_ALREADY_STARTED');
 const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`),rows=keys.length?await store.getMany('state',keys):[];
 assert(rows.every(Boolean),'RETIRE_BATCH_MISSING');
 const batches=rows.map(r=>r.value),records=[];
 for(const [i,b] of batches.entries()){
  assert(b.id===i+1&&b.leaseUntil<=now()&&b.start-1<=b.checkpoint&&b.checkpoint<=b.journaled&&b.journaled<=b.end&&b.journaled-b.start<100,'RETIRE_BATCH_UNSAFE');
  const ks=Array.from({length:b.journaled-b.start+1},(_,n)=>receiptKey(plan.trialId,b.start+n)),got=ks.length?await store.getMany('journal',ks):[];
  assert(got.every(Boolean),'RETIRE_RECEIPT_MISSING');
  for(const [j,{value:r}] of got.entries()){
   assert(r.sequence===b.start+j&&r.batchId===b.id&&r.shardId===b.worker&&r.sourceSessionHash===b.sessionHash&&r.trialId===plan.trialId&&r.fixtureOnly===false&&r.buy===0,'RETIRE_RECORD_IDENTITY');
   assert((await parser.call({op:'verify',plan,raw:r.raw,record:r})).verified,'RETIRE_INVALID_COMPLETE');records.push(r);
  }
 }
 await boundary();assert(hash((await store.get('state',poolKey))?.value)===expectedPoolHash,'RETIRE_POOL_CHANGED');
 assert(hash((keys.length?await store.getMany('state',keys):[]).map(r=>r?.value))===hash(batches),'RETIRE_BATCH_CHANGED');
 const save=async(key,v)=>{await store.create('journal',key,v,{immutable:true});assert(hash((await store.get('journal',key))?.value)===hash(v),'RETIRE_BACKUP_READBACK');};
 const before={schema:'sg-retired-demo-v1',plan,pool,batches,owner,at:now(),completeCount:records.length,recordsHash:hash(records)};
 await save(prefix+':before',before);
 // Records already have durable immutable receipts; bind their full content
 // hash in the private archive rather than duplicating every historical chain.
 const attempts=batches.filter(b=>b.pending||b.pendingOriginal||b.bootstrapAwaiting).map(b=>({batchId:b.id,worker:b.worker,sessionHash:b.sessionHash,disposition:b.pending?.awaiting||b.bootstrapAwaiting?'unknown-abandoned-without-replay':'interrupted-abandoned-without-replay',pending:b.pending,pendingOriginal:b.pendingOriginal??null,bootstrapAwaiting:b.bootstrapAwaiting??null}));
 await save(prefix+':analysis',{attempts,sourceRequests:0});
 for(const b of batches){
  // Already settled batches may be bound by an immutable generation audit.
  // Verify their contents without rewriting ownership, epochs or retirement.
  if(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled){
   const complete=records.filter(r=>r.batchId===b.id);
   if(complete.length){const actual=await transport.request('rounds_read',{trialId:plan.trialId,ids:complete.map(r=>r._id)});assert(hash(actual.map(hash).sort())===hash(complete.map(hash).sort()),'MONGO_CONTENT_CONFLICT');}
   continue;
  }
  await boundary();await store.writable();const key=`batch:${plan.trialId}:${b.id}`,epoch=b.epoch+1;
  await store.update('state',key,v=>{assert(hash(v)===hash(b),'RETIRE_BATCH_CHANGED');return {...v,epoch,owner,leaseUntil:0};});
  const queue=new DurableQueue({store,plan,batchKey:key,owner,epoch});
  const writer=new MongoWriter({gate,queue,permits:new WritePermits({store,group,owner,now}),sink:{read:ids=>transport.request('rounds_read',{trialId:plan.trialId,ids}),insert:rs=>transport.request('rounds_insert',{trialId:plan.trialId,records:rs})}});
  const outstanding=await queue.outstanding();if(outstanding.length){const r=await writer.deliver(outstanding);assert(!r.paused&&r.confirmed===outstanding.length,'RETIRE_FLUSH_INCOMPLETE');}
  assert((await queue.outstanding()).length===0,'RETIRE_FLUSH_INCOMPLETE');
  const complete=records.filter(r=>r.batchId===b.id);if(complete.length)writer.compare(complete,await transport.request('rounds_read',{trialId:plan.trialId,ids:complete.map(r=>r._id)}));
  await boundary();
  await store.update('state',key,v=>{assert(v.owner===owner&&v.epoch===epoch&&v.checkpoint===v.journaled&&v.journaled===b.journaled&&hash(v.pending)===hash(b.pending),'RETIRE_PROGRESS_CHANGED');return {...v,owner:null,leaseUntil:0,pending:null,pendingOriginal:null,bootstrapAwaiting:null,protocolResume:null,failure:null,retiredDemo:prefix};});
 }
 await boundary();await store.update('state',poolKey,v=>{
  assert(hash(v)===expectedPoolHash,'RETIRE_POOL_CHANGED');
  if(countSpec){
   checkLedger(v,plan,countSpec);
   for(const b of batches){
    const item=v.countAllocation.batches[b.id];
    assert(item&&item.worker===b.worker&&item.sessionHash===b.sessionHash&&item.start===b.start&&item.end===b.end,'COUNT_RETIRE_BATCH_CHANGED');
    const complete=b.journaled-b.start+1;
    if(item.closed){assert(item.complete===complete,'COUNT_RETIRE_CLOSED_CHANGED');continue;}
    item.closed=true;item.complete=complete;
    item.evidenceHash=hash({retirement:prefix,beforeBatchHash:hash(b),complete});
    v.countAllocation.reserved-=b.end-b.start+1;v.confirmed+=complete;
   }
   // Detach only now, after the full readback and private analysis archive.
   // Keep the session identities: fresh generation activation is separate.
   for(const w of Object.values(v.workers)){w.activeBatch=null;w.resumeSafe=false;}
   checkLedger(v,plan,countSpec);
  }
  return {...v,enabled:false,retiredDemo:prefix};
 });
 const result={schema:'sg-retired-demo-result-v1',trialId:plan.trialId,completePreserved:records.length,abandonedAttempts:attempts.length,sourceRequests:0,newBetAllowance:0,beforeHash:hash(before),at:now()};
 await save(prefix+':complete',result);return result;
}
