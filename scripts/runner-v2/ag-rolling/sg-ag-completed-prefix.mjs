import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {stagingPrefix} from './sg-staging-store.mjs';
import {verifySavedSources,stageOwner} from './sg-resume.mjs';
import {businessInventory,readBusinessNativePages} from './sg-business-native-reader.mjs';
import {assertCompleteBinding} from './sg-business-delivery.mjs';
import {verifyOrdinaryNativePage,mongoOnce} from './sg-ag-ordinary-business.mjs';

export function originalWorkerOrdinal(record,index){
 assert(record.shardId===index-1&&Number.isSafeInteger(record.sequence),'SG_AG_COMPLETED_WORKER_IDENTITY');
 const n=record.sequence>(index-1)*15000&&record.sequence<=index*15000?record.sequence-(index-1)*15000:15000+record.sequence-300000-(index-1)*7;
 assert(n>=1&&n<=15007,'SG_AG_COMPLETED_WORKER_ORDINAL');return n;
}
// The running legacy controller already cleaned selected staging rows after
// native completion. Reconstruct the ORIGINAL full prefix from its insert-only
// official rows plus the retained excess. Counts and hashes must equal the
// original task's full independent proof. No task/proof is rewritten.
export async function auditCompletedNativePrefixes({source,store,game,queueId,plan,binding,parser,tasks,state,receipt,guard}){
 const complete=assertCompleteBinding(state,receipt,binding),before=stable(tasks),inventory=await mongoOnce(()=>businessInventory(source,binding));
 const results=Array(20);let workerRows=new Map();
 const full=await mongoOnce(()=>readBusinessNativePages({source,binding,inventory,verify:async records=>{await guard();return verifyOrdinaryNativePage({records,plan,parser});},visit:async(records,worker,end)=>{
  const index=worker+1,task=tasks.find(t=>t._id==='worker:'+index),p=task.proof;
  assert(p?.queueId===queueId&&p.gameId===game.gameId&&p.campaignId===game.campaignId&&p.taskId===task._id&&p.owner===task.owner&&p.fullReadback&&p.independentlyVerified&&p.pending===0&&p.unknownRequests===0&&p.activeLeases===0&&p.count>=15000&&p.count<=15007,'SG_AG_COMPLETED_ORIGINAL_TASK_PROOF');
  for(const record of records){const ordinal=originalWorkerOrdinal(record,index);assert(ordinal<=p.count&&!workerRows.has(ordinal),'SG_AG_COMPLETED_DUPLICATE_ORDINAL');workerRows.set(ordinal,record);}
  if(end!==15000)return;
  const prefix=stagingPrefix(queueId,game,'worker',index),missing=Array.from({length:p.count},(_,i)=>i+1).filter(n=>!workerRows.has(n));
  assert(missing.length===p.count-15000&&missing.length<=7,'SG_AG_COMPLETED_RETAINED_EXCESS_COUNT');
  if(missing.length){
   const rows=await store.getMany('journal',missing.map(n=>prefix+String(n).padStart(10,'0')));
   assert(rows.every((r,i)=>r?.value.ordinal===missing[i]&&r.value.queueId===queueId&&r.value.gameId===game.gameId&&r.value.campaignId===game.campaignId&&r.value.taskId===task._id&&(r.value.owner===task.owner||r.value.owner===stageOwner(p,missing[i]))),'SG_AG_COMPLETED_RETAINED_EXCESS_CHANGED');
   const retained=rows.map(r=>r.value);await verifyOrdinaryNativePage({records:retained.map(r=>r.record),plan,parser});
   await verifySavedSources({store,rows:retained,game,queueId,kind:'worker',index});
   for(const row of retained){assert(originalWorkerOrdinal(row.record,index)===row.ordinal,'SG_AG_COMPLETED_RETAINED_EXCESS_ORDINAL');workerRows.set(row.ordinal,row.record);}
  }
  const hash=createHash('sha256');for(let n=1;n<=p.count;n++){assert(workerRows.has(n),'SG_AG_COMPLETED_PREFIX_GAP');hash.update(stable(workerRows.get(n))+'\n');}
  assert(hash.digest('hex')===p.recordsHash,'SG_AG_COMPLETED_ORIGINAL_PREFIX_HASH_CHANGED');
  results[worker]={...structuredClone(p),taskHash:queueHash(task),acceptedUnknownRequests:0,reconstructedFromImmutableNative:true,originalTaskProofPreserved:true,nativeReceiptHash:queueHash(complete)};workerRows=new Map();
 }}));
 assert(full.recordsHash===complete.recordsHash&&full.count===300000&&results.every(Boolean),'SG_AG_COMPLETED_FULL_NATIVE_HASH_CHANGED');
 assert(stable(tasks)===before,'SG_AG_COMPLETED_TASKS_MUTATED');return results;
}
