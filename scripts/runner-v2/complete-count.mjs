import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
import {sessionLayout,sessionWorkerAllowed} from './session-layout.mjs';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');

// This opt-in path is dormant without a separately created immutable activation
// receipt. Existing plans and spent short-run permissions cannot enable it.
export async function loadCountPermission({store,plan,pool,commit}){
 if(plan.countAllocation===undefined){assert(!pool.countAllocation,'COUNT_PLAN_MISSING');return null;}
 assert(/^[a-f0-9]{64}$/.test(plan.countAllocation)&&/^[a-f0-9]{40}$/.test(commit||''),'COUNT_RUNTIME_REQUIRED');
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const spec=(await store.get('journal',key))?.value,complete=(await store.get('journal',key+':complete'))?.value;
 // The key is an activation identity, distinct from the plan hash to avoid a
 // circular spec -> plan -> spec hash dependency.
 assert(spec&&spec.activation===plan.countAllocation&&spec.planHash===hash(plan)
  &&spec.gameId===plan.gameId&&plan.buy===0&&plan.phase===1,'COUNT_AUTHORIZATION');
 assert(complete&&complete.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)
  &&complete.trialId===plan.trialId&&complete.planHash===hash(plan)&&complete.commit===spec.commit,'COUNT_ACTIVATION_INCOMPLETE');
 if(spec.commit!==commit){
  const revision=(await store.get('journal',`count-runtime:${plan.trialId}:${spec.activation}:${commit}`))?.value;
  const oldRevision=revision?.schema==='sg-count-runtime-v1'&&revision.completePreserved===100&&revision.remainingComplete===299900;
  const refreshed=revision?.schema==='sg-count-runtime-v2'&&revision.planHash===hash(plan)&&revision.newBetAllowance===0
   &&Number.isSafeInteger(revision.completePreserved)&&revision.completePreserved>=0&&revision.completePreserved<=pool.confirmed
   &&revision.remainingComplete===plan.target-revision.completePreserved&&revision.remainingComplete>0
   &&/^[a-f0-9]{64}$/.test(revision.revisionHash??'');
  assert((oldRevision||refreshed)&&revision.commit===commit&&revision.fromCommit===spec.commit
   &&revision.specHash===hash(spec)&&revision.profileHash===spec.profileHash&&revision.activation===spec.activation
   &&revision.sourceRequests===0,'COUNT_AUTHORIZATION');
 }
 checkLedger(pool,plan,spec);return spec;
}

export function allocateCountBatch({pool,plan,spec,worker,now}){
 const w=pool.workers[String(worker)],{available}=checkLedger(pool,plan,spec);
 if(w.activeBatch){
  const item=pool.countAllocation.batches[w.activeBatch.id];
  assert(item&&!item.closed&&item.worker===worker&&item.sessionHash===w.sessionHash
   &&item.start===w.activeBatch.start&&item.end===w.activeBatch.end,'COUNT_ACTIVE_CHANGED');
  return {batch:w.activeBatch,changed:false};
 }
 const capacity=spec.maxSequence-pool.nextSequence+1;
 if(!available||capacity<=0)return {batch:null,changed:false};
 const layout=sessionLayout(plan,spec);
 const size=Math.min(100,Math.ceil(available/(20*(layout?.lanesPerHost??1))),available,capacity);
 const batch={id:pool.nextBatchId,worker,start:pool.nextSequence,end:pool.nextSequence+size-1};
 pool.countAllocation.batches[batch.id]={...batch,sessionHash:w.sessionHash,closed:false,complete:0,evidenceHash:null};
 pool.countAllocation.reserved+=size;pool.nextBatchId++;pool.nextSequence=batch.end+1;
 w.activeBatch=batch;w.leaseUntil=now+600000;checkLedger(pool,plan,spec);
 return {batch,changed:true};
}

export function completeCountBatch({pool,plan,spec,worker,batch,proof}){
 checkLedger(pool,plan,spec);
 const w=pool.workers[String(worker)],item=pool.countAllocation.batches[batch.id];
 assert(proof.pending===null&&proof.fullReadback===true&&proof.confirmed===batch.end-batch.start+1,'COUNT_COMPLETION_PROOF');
 assert(item&&!item.closed&&item.worker===worker&&item.sessionHash===w.sessionHash
  &&item.start===batch.start&&item.end===batch.end&&w.activeBatch?.id===batch.id,'COUNT_OWNER_CHANGED');
 item.closed=true;item.complete=proof.confirmed;item.evidenceHash=hash({batch,proof});
 pool.confirmed+=proof.confirmed;pool.countAllocation.reserved-=proof.confirmed;w.activeBatch=null;
 checkLedger(pool,plan,spec);
}

// A graceful run boundary discards only the unused suffix. Completed records
// remain bound to the old session; a later process must allocate a new range.
export function settleCountBatch({pool,plan,spec,worker,batch,evidence,key}){
 checkLedger(pool,plan,spec);
 assert(spec.sessionRotation==='closed-batches-v1','COUNT_ROTATION_NOT_AUTHORIZED');
 const w=pool.workers[String(worker)],item=pool.countAllocation.batches[batch.id];
 assert(item&&!item.closed&&w?.activeBatch?.id===batch.id&&item.worker===worker
  &&item.sessionHash===w.sessionHash&&item.start===batch.start&&item.end===batch.end,'COUNT_OWNER_CHANGED');
 assert(evidence.schema==='sg-count-batch-settlement-v1'&&evidence.activation===spec.activation
  &&evidence.trialId===plan.trialId&&evidence.fullReadback===true,'COUNT_SETTLEMENT_SCOPE');
 const b=evidence.batch,complete=b.checkpoint-b.start+1;
 assert(b.id===item.id&&b.worker===worker&&b.sessionHash===item.sessionHash
  &&b.start===item.start&&b.end===item.end&&b.pending===null&&!b.pendingOriginal&&!b.bootstrapAwaiting
  &&!b.failure&&b.leaseUntil===0&&b.checkpoint===b.journaled
  &&Number.isSafeInteger(complete)&&complete>=0&&complete<=b.end-b.start+1,'COUNT_SETTLEMENT_UNFINISHED');
 assert(key===`count-settlement:${plan.trialId}:${spec.activation}:${b.id}`,'COUNT_SETTLEMENT_KEY');
 Object.assign(item,{closed:true,complete,evidenceHash:hash(evidence),settlementKey:key});
 pool.confirmed+=complete;pool.countAllocation.reserved-=item.end-item.start+1;
 w.activeBatch=null;w.resumeSafe=false;
 checkLedger(pool,plan,spec);
}

export function allowCountSessionRotation({pool,plan,spec,worker,sessionHash,now}){
 checkLedger(pool,plan,spec);
 const old=pool.workers[String(worker)];
 assert(spec.sessionRotation==='closed-batches-v1'&&old&&!old.activeBatch&&old.leaseUntil<=now,
  'COUNT_SESSION_STILL_ACTIVE');
 for(const b of Object.values(pool.countAllocation.batches)){
  assert(b.sessionHash!==sessionHash,'COUNT_SESSION_REUSED');
  if(b.worker===worker)assert(b.closed&&(b.id<=spec.baselineBatchCount||b.settlementKey),
   'COUNT_SESSION_UNSETTLED');
 }
}

const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function checkLedger(pool,plan,spec){
 const layout=sessionLayout(plan,spec);
 assert(spec.schema==='sg-complete-count-v1'&&spec.trialId===plan.trialId&&spec.target===plan.target,'COUNT_SCOPE');
 assert(integer(plan.target)&&plan.target>0&&integer(pool.nextBatchId)&&pool.nextBatchId>0,'COUNT_TARGET');
 assert(integer(spec.maxSequence)&&spec.maxSequence>=spec.firstSequence&&integer(spec.firstSequence)&&spec.firstSequence>0,'COUNT_CEILING');
 assert(pool.countAllocation?.specHash===hash(spec),'COUNT_PERMISSION');
 const ledger=pool.countAllocation.batches;
 assert(ledger&&Object.keys(ledger).length===pool.nextBatchId-1,'COUNT_BATCH_COVERAGE');
 assert(integer(spec.baselineBatchCount)&&spec.baselineBatchCount<pool.nextBatchId,'COUNT_BASELINE');
 const baseline=Array.from({length:spec.baselineBatchCount},(_,i)=>ledger[i+1]);
 assert(hash(baseline)===spec.baselineHash&&baseline.every(b=>b?.closed)
  &&(baseline.at(-1)?.end??0)+1===spec.firstSequence,'COUNT_BASELINE_CHANGED');
 let completed=0,reserved=0,next=1;
 for(let id=1;id<pool.nextBatchId;id++){
  const b=ledger[id];
  assert(b&&b.id===id&&integer(b.start)&&b.start===next&&integer(b.end)&&b.end>=b.start,'COUNT_RANGE');
  assert(integer(b.worker)&&(layout?sessionWorkerAllowed(plan,b.worker,layout.group):b.worker<40)
   &&/^[a-f0-9]{64}$/.test(b.sessionHash),'COUNT_IDENTITY');
  const size=b.end-b.start+1;
  if(b.closed){assert(integer(b.complete)&&b.complete<=size&&/^[a-f0-9]{64}$/.test(b.evidenceHash),'COUNT_CLOSED');completed+=b.complete;}
  else {assert(b.complete===0&&b.evidenceHash===null,'COUNT_OPEN');reserved+=size;}
  next=b.end+1;
 }
 assert(next===pool.nextSequence&&completed===pool.confirmed&&reserved===pool.countAllocation.reserved,'COUNT_COUNTER');
 assert(completed+reserved<=plan.target&&next-1<=spec.maxSequence,'COUNT_OVERBOOKED');
 return {completed,reserved,available:plan.target-completed-reserved};
}

// Sequence numbers may exceed target, but may never escape their reviewed
// allocation or enter the discarded suffix of a partially completed batch.
export function auditAllocatedRecord({pool,plan,spec,record}){
 const item=pool.countAllocation.batches[record.batchId];
 assert(record.trialId===plan.trialId&&record.buy===0&&record.fixtureOnly===false&&item?.closed,'COUNT_AUDIT_SCOPE');
 assert(integer(record.sequence)&&record.sequence>=item.start&&record.sequence<item.start+item.complete
  &&record.sequence<=spec.maxSequence&&record.shardId===item.worker&&record.sourceSessionHash===item.sessionHash,'COUNT_AUDIT_RANGE');
 return true;
}

export async function auditCountBatch({store,pool,plan,spec,record,cache}){
 const key=`batch:${plan.trialId}:${record.batchId}`;
 if(!cache.has(key))cache.set(key,(await store.get('state',key))?.value);
 const b=cache.get(key),item=pool.countAllocation.batches[record.batchId];
 assert(b&&b.id===item.id&&b.worker===item.worker&&b.sessionHash===item.sessionHash
  &&b.start===item.start&&b.end===item.end&&b.pending===null&&!b.bootstrapAwaiting
  &&b.checkpoint===b.journaled&&b.journaled===b.start+item.complete-1,'COUNT_AUDIT_BATCH_CHANGED');
 if(b.id<=spec.baselineBatchCount)assert(hash(b)===item.evidenceHash,'COUNT_AUDIT_HISTORY_CHANGED');
 else if(spec.sessionRotation==='closed-batches-v1'){
  assert(item.settlementKey===`count-settlement:${plan.trialId}:${spec.activation}:${b.id}`,'COUNT_AUDIT_SETTLEMENT');
  const receiptKey='journal/'+item.settlementKey;
  if(!cache.has(receiptKey))cache.set(receiptKey,(await store.get('journal',item.settlementKey))?.value);
  const receipt=cache.get(receiptKey);
  assert(receipt?.schema==='sg-count-batch-settlement-v1'&&receipt.activation===spec.activation
   &&receipt.trialId===plan.trialId&&receipt.fullReadback===true
   &&hash(receipt)===item.evidenceHash&&hash(receipt.batch)===hash(b),'COUNT_AUDIT_SETTLEMENT_CHANGED');
 }else assert(pool.workers[String(b.worker)]?.sessionHash===b.sessionHash,'COUNT_AUDIT_SESSION_CHANGED');
}

export function idleAtCountTail(pool,plan,spec,worker,now){
 const own=pool.workers[String(worker)],{available}=checkLedger(pool,plan,spec);
 return !!(own&&!own.activeBatch&&own.leaseUntil<=now&&pool.confirmed<plan.target
  &&(!available||pool.nextSequence>spec.maxSequence));
}

export async function auditCountPages({pool,plan,spec,scan,verifyRecord}){
 const {reserved}=checkLedger(pool,plan,spec);
 assert(pool.confirmed===plan.target&&reserved===0,'COUNT_AUDIT_NOT_READY');
 assert(typeof verifyRecord==='function','COUNT_VERIFIER_REQUIRED');
 let after=0,count=0;const counts=new Map();
 while(true){
  const rows=await scan(after);assert(Array.isArray(rows),'COUNT_AUDIT_PAGE');
  if(!rows.length)break;
  for(const record of rows){
   assert(record.sequence>after,'COUNT_AUDIT_ORDER');
   auditAllocatedRecord({pool,plan,spec,record});
   assert(await verifyRecord(record)===true,'COUNT_AUDIT_UNVERIFIED');
   count++;assert(count<=plan.target,'COUNT_AUDIT_EXCESS');
   counts.set(record.batchId,(counts.get(record.batchId)||0)+1);after=record.sequence;
  }
 }
 assert(count===plan.target,'COUNT_AUDIT_MISSING');
 for(const item of Object.values(pool.countAllocation.batches))assert((counts.get(item.id)||0)===item.complete,'COUNT_AUDIT_BATCH_COUNT');
 return {count,lastSequence:after};
}
