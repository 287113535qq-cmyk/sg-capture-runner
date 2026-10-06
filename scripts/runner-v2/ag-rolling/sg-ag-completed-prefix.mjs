import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {stagingPrefix} from './sg-staging-store.mjs';
import {verifySavedSources,stageOwner} from './sg-resume.mjs';
import {businessInventory,readBusinessNativePages} from './sg-business-native-reader.mjs';
import {assertCompleteBinding} from './sg-business-delivery.mjs';
import {verifyOrdinaryNativePage,mongoOnce} from './sg-ag-ordinary-business.mjs';

export const COMPLETED_NATIVE_PROOF='completed-native-receipt-v1';
// This is the prepared sequence position, NOT the original staging ordinal.
// Eight asynchronous sessions can finish preparation and insertion in a
// different order. Never use this identity to reconstruct a staging hash.
export function preparedWorkerPosition(record,index){
 assert(record.shardId===index-1&&Number.isSafeInteger(record.sequence),'SG_AG_COMPLETED_WORKER_IDENTITY');
 const n=record.sequence>(index-1)*15000&&record.sequence<=index*15000?record.sequence-(index-1)*15000:15000+record.sequence-300000-(index-1)*7;
 assert(n>=1&&n<=15007,'SG_AG_COMPLETED_WORKER_ORDINAL');return n;
}
export function assertCompletedTaskProof({task,game,queueId,index}){
 const p=task?.proof;
 assert(task?._id==='worker:'+index&&task.status==='success'&&task.queueId===queueId&&task.campaignId===game.campaignId
  &&p?.queueId===queueId&&p.gameId===game.gameId&&p.campaignId===game.campaignId&&p.taskId===task._id&&p.owner===task.owner
  &&p.fullReadback===true&&p.independentlyVerified===true&&p.pending===0&&p.unknownRequests===0&&p.activeLeases===0
  &&Number.isSafeInteger(p.count)&&p.count>=15000&&p.count<=15007&&/^[a-f0-9]{64}$/.test(p.recordsHash??''),'SG_AG_COMPLETED_ORIGINAL_TASK_PROOF');
 return p;
}
export function completedNativeWorkerProof({selected,retained,task,game,queueId,index,complete}){
 const p=assertCompletedTaskProof({task,game,queueId,index}),byId=new Map(selected.map(r=>[r._id,r])),positions=new Set();
 assert(selected.length===15000&&byId.size===selected.length,'SG_AG_COMPLETED_SELECTED_COUNT');
 let excess=0;
 for(const row of retained){const previous=byId.get(row.record._id);
  if(previous)assert(stable(previous)===stable(row.record),'SG_AG_COMPLETED_RETAINED_NATIVE_CHANGED');
  else{byId.set(row.record._id,row.record);excess++;}
 }
 assert(excess===p.count-15000&&byId.size===p.count,'SG_AG_COMPLETED_RETAINED_EXCESS_COUNT');
 const hash=createHash('sha256');
 for(const record of [...byId.values()].sort((a,b)=>a._id.localeCompare(b._id))){
  const position=preparedWorkerPosition(record,index);
  assert(position<=p.count&&!positions.has(position),'SG_AG_COMPLETED_DUPLICATE_ORDINAL');positions.add(position);
  hash.update(stable(record)+'\n');
 }
 assert(positions.size===p.count,'SG_AG_COMPLETED_PREFIX_GAP');
 return {proofKind:COMPLETED_NATIVE_PROOF,queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:task._id,owner:task.owner,
  taskHash:queueHash(task),count:p.count,recordsHash:hash.digest('hex'),recordsOrder:'record-id-ascending',
  fullReadback:true,independentlyVerified:true,acceptedUnknownRequests:0,activeLeases:0,
  selectedNativeCount:15000,retainedExcessCount:excess,retainedStageCount:retained.length,
  originalTaskProofHash:queueHash(p),originalPrefixRecordsHash:p.recordsHash,originalPrefixHashRecomputed:false,
  nativeReceiptHash:queueHash(complete),nativeRecordsHash:complete.recordsHash,nativeSelectedCount:complete.count};
}
// Recheck the completed native receipt's exact 300000-row hash with both
// parsers before returning any proof. The old task hash remains provenance;
// its deleted insertion order is neither guessed nor claimed to be rehashed.
export async function auditCompletedNativePrefixes({source,store,transport,game,queueId,plan,binding,parser,tasks,state,receipt,guard,
 verifyRecords=records=>verifyOrdinaryNativePage({records,plan,parser})}){
 const complete=assertCompleteBinding(state,receipt,binding),before=stable(tasks),inventory=await mongoOnce(()=>businessInventory(source,binding));
 assert(game.baseline===0&&complete.queueId===queueId&&complete.gameId===game.gameId&&complete.campaignId===game.campaignId,
  'SG_AG_COMPLETED_GAME_IDENTITY');
 const mergeKey='rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]);
 assert(state?._id==='primary/'+mergeKey&&receipt?._id==='primary/'+mergeKey+':complete'&&receipt.version===0,
  'SG_AG_COMPLETED_IMMUTABLE_RECEIPT');
 assert(transport&&typeof transport.request==='function','SG_AG_COMPLETED_RETAINED_READER_REQUIRED');
 const workers=Array.from({length:20},(_,i)=>{
  const matches=tasks.filter(t=>t._id==='worker:'+(i+1));assert(matches.length===1,'SG_AG_COMPLETED_TASK_INVENTORY');
  assertCompletedTaskProof({task:matches[0],game,queueId,index:i+1});return matches[0];
 });
 assert(workers.reduce((n,t)=>n+t.proof.count-15000,0)===complete.excessPreserved,'SG_AG_COMPLETED_EXCESS_RECEIPT_CHANGED');
 const results=Array(20);let selected=[];
 const verify=async records=>{await guard();const result=await verifyRecords(records);assert(result?.verified===true&&result.count===records.length,'SG_AG_COMPLETED_INDEPENDENT_VALIDATION');return result;};
 const full=await mongoOnce(()=>readBusinessNativePages({source,binding,inventory,verify,visit:async(records,worker,end)=>{
  const index=worker+1,task=workers[worker],p=task.proof;selected.push(...records);
  if(end!==15000)return;
  const prefix=stagingPrefix(queueId,game,'worker',index),retained=[],seen=new Set();let after='primary/'+prefix,lastOrdinal=0;
  for(;;){
   await guard();const docs=await transport.request('scan',{collection:'journal',key:prefix,after});
   assert(Array.isArray(docs)&&docs.length<=100,'SG_AG_COMPLETED_RETAINED_PAGE');if(docs.length===0)break;
   const rows=docs.map(d=>{const row=d?.value;
    assert(Number.isSafeInteger(row?.ordinal)&&row.ordinal>lastOrdinal&&row.ordinal<=p.count
     &&d._id==='primary/'+prefix+String(row.ordinal).padStart(10,'0')&&d._id>after
     &&row.queueId===queueId&&row.gameId===game.gameId&&row.campaignId===game.campaignId&&row.taskId===task._id
     &&(row.owner===task.owner||row.owner===stageOwner(p,row.ordinal))&&row.record?.fixtureOnly===false&&row.record.buy===0
     &&!seen.has(row.record._id),'SG_AG_COMPLETED_RETAINED_EXCESS_CHANGED');
    lastOrdinal=row.ordinal;seen.add(row.record._id);return row;
   });
   await verify(rows.map(r=>r.record));await verifySavedSources({store,rows,game,queueId,kind:'worker',index});
   retained.push(...rows);assert(retained.length<=p.count,'SG_AG_COMPLETED_RETAINED_EXCESS_COUNT');after=docs.at(-1)._id;
  }
  results[worker]=completedNativeWorkerProof({selected,retained,task,game,queueId,index,complete});selected=[];
 }}));
 assert(full.recordsHash===complete.recordsHash&&full.count===300000&&results.every(Boolean),'SG_AG_COMPLETED_FULL_NATIVE_HASH_CHANGED');
 assert(stable(tasks)===before,'SG_AG_COMPLETED_TASKS_MUTATED');return results;
}
