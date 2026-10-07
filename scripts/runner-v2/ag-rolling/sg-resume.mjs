import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {quotas,canResetInterruptedTasks} from './ag-core.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
import {sourceJournalKey} from './sg-source-journal.mjs';
import {queueHash} from './sg-queue-profile.mjs';
export const stageOwner=(proof,ordinal)=>proof?.segments?.find(s=>ordinal>=s.first&&ordinal<=s.last)?.owner;
export async function verifyResumePage({verifyRecords,verifySources,records}){
 // Parsing and immutable source-journal readback are independent. Both must
 // finish before the next page or any resume receipt can be committed.
 const results=await Promise.allSettled([
  Promise.resolve().then(()=>verifyRecords(records)),Promise.resolve().then(verifySources),
 ]);
 const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
 const result=results[0].value;
 assert(result?.verified===true&&result.count===records.length,'SG_RESUME_INDEPENDENT_VALIDATION');
}
export async function verifySavedSources({store,rows,game,queueId,kind,index}){
 // An accepted round must have every exact intent and response in native
 // storage. Unfinished/unknown requests outside these rounds are preserved;
 // they are never replayed or included in the accepted staging count.
 const references=new Map();
 for(const row of rows){
  const record=row.record;assert(record.raw?.steps?.length>0,'SG_RESUME_EMPTY_ROUND');
  for(const step of record.raw.steps){const s=step.rollingSource;
   assert(s?.sessionHash===record.sourceSessionHash&&Number.isSafeInteger(s.requestNo)&&s.requestNo>0,'SG_RESUME_SOURCE_REFERENCE');
   const context={queueId,game,kind,index,owner:row.owner,sessionHash:s.sessionHash,requestNo:s.requestNo};
   const intent=sourceJournalKey({...context,type:'intent'}),response=sourceJournalKey({...context,type:'response'});
   const expected={context,step,intent,response};
   if(references.has(response))assert.equal(stable(references.get(response).step),stable(step),'SG_RESUME_SOURCE_CONFLICT');
   references.set(response,expected);
  }
 }
 const refs=[...references.values()];
 for(let n=0;n<refs.length;n+=50){const page=refs.slice(n,n+50),keys=page.flatMap(r=>[r.intent,r.response]);
  const docs=await store.getMany('journal',keys);
  assert(docs.length===keys.length&&docs.every(Boolean),'SG_RESUME_SOURCE_MISSING');
  for(let i=0;i<page.length;i++){
   const ref=page[i],a=docs[2*i],b=docs[2*i+1],{step,...intent}=b.value;
   assert(a._id.endsWith('/'+ref.intent)&&b._id.endsWith('/'+ref.response)
    &&stable(a.value)===stable(intent)&&stable(step)===stable(ref.step)
    &&intent.queueId===queueId&&intent.gameId===game.gameId&&intent.kind===kind&&intent.index===index
    &&intent.owner===ref.context.owner&&intent.sessionHash===ref.context.sessionHash
    &&intent.requestNo===ref.context.requestNo,'SG_RESUME_SOURCE_CHANGED');
  }
 }
}
export async function inspectStaging({store,transport,game,queueId,kind,index,guard,verifyRecords,max}){
 const prefix=stagingPrefix(queueId,game,kind,index),hash=createHash('sha256'),segments=[],seen=new Set();
 let after='primary/'+prefix,count=0;
 for(;;){await guard();
  const docs=await transport.request('scan',{collection:'journal',key:prefix,after});
  assert(Array.isArray(docs)&&docs.length<=100,'SG_RESUME_PAGE');if(docs.length===0)break;
  const rows=docs.map(d=>{
   const row=d.value,ordinal=++count;
   assert(d._id==='primary/'+prefix+String(ordinal).padStart(10,'0')&&row?.ordinal===ordinal
    &&row.queueId===queueId&&row.gameId===game.gameId&&row.campaignId===game.campaignId
    &&row.taskId===`${kind}:${index}`&&typeof row.owner==='string'&&count<=max
    &&row.record?.fixtureOnly===false&&row.record.buy===0&&!seen.has(row.record._id),'SG_RESUME_STAGE_IDENTITY');
   seen.add(row.record._id);hash.update(stable(row.record)+'\n');
   if(segments.at(-1)?.owner===row.owner)segments.at(-1).last=ordinal;
   else segments.push({first:ordinal,last:ordinal,owner:row.owner});
   return row;
  });
  await verifyResumePage({verifyRecords,records:rows.map(r=>r.record),
   verifySources:()=>verifySavedSources({store,rows,game,queueId,kind,index})});after=docs.at(-1)._id;
 }
 return {count,recordsHash:hash.digest('hex'),segments,fullReadback:true,independentlyVerified:true};
}
export async function resetEndedTask({store,transport,game,queueId,kind,index,guard,verifyRecords,ended,
 revalidateSuccess=true,now=Date.now}){
 const key=taskKey(queueId,game,`${kind}:${index}`),before=await store.get('state',key),task=before?.value;
 assert(task?._id===`${kind}:${index}`&&task.queueId===queueId&&task.campaignId===game.campaignId,'SG_RESUME_TASK_SCOPE');
 // Unchanged adapters retain the task's previous complete proof. Revised
 // adapters must verify the same native bytes, including already successful
 // tasks; a previous status alone cannot approve a new normalizer.
 if(task.status==='success'&&!revalidateSuccess||task.status==='pending'&&!task.resume)return task;
 assert(['running','failed','blocked','success','pending'].includes(task.status)&&ended?.status==='completed'
  &&ended.queueId===queueId&&typeof ended.run==='string'&&ended.sourceJobsEnded===true,'SG_RESUME_ENDED_SOURCE_REQUIRED');
 const lease=(await store.get('state',stagingLeaseKey(queueId,game,kind,index)))?.value;
 assert(canResetInterruptedTasks(ended.status,lease?.expiresAt>now()?1:0),'SG_RESUME_LIVE_LEASE');
 const quota=kind==='canary'?10:quotas(game.baseline)[index-1],max=quota+(kind==='worker'?7:0);
 const assertUnchanged=async()=>{
  await guard();
  const currentLease=(await store.get('state',stagingLeaseKey(queueId,game,kind,index)))?.value;
  assert(!currentLease||currentLease.expiresAt<=now(),'SG_RESUME_LIVE_LEASE');
  const current=await store.get('state',key);
  assert(current?.version===before.version&&queueHash(current?.value)===queueHash(task),'SG_RESUME_TASK_CHANGED');
 };
 if(task.status==='pending'&&!revalidateSuccess){
  const proof=task.resume,hash=/^[a-f0-9]{64}$/;
  assert(hash.test(proof.receiptHash??'')&&proof.receiptKey==='rolling-resume:'+proof.receiptHash,
   'SG_RESUME_PENDING_RECEIPT');
  const document=await store.get('journal',proof.receiptKey),receipt=document?.value;
  assert(proof.fullReadback===true&&proof.independentlyVerified===true
   &&Number.isSafeInteger(proof.count)&&proof.count>=0&&proof.count<=max
   &&hash.test(proof.recordsHash??'')&&hash.test(proof.receiptHash??'')
   &&proof.receiptKey==='rolling-resume:'+proof.receiptHash
   &&document?._id==='primary/'+proof.receiptKey
   &&receipt?.schema==='sg-ag-rolling-resume-prefix-v1'&&queueHash(receipt)===proof.receiptHash
   &&receipt.queueId===queueId&&receipt.gameId===game.gameId&&receipt.campaignId===game.campaignId
   &&receipt.taskId===task._id&&receipt.count===proof.count&&receipt.recordsHash===proof.recordsHash
   &&receipt.fullReadback===true&&receipt.independentlyVerified===true
   &&hash.test(receipt.previousTaskHash??'')&&typeof receipt.endedRun==='string'&&receipt.endedRun.length>0
   &&hash.test(receipt.endedProofHash??'')&&receipt.sourceRequests===0
   &&receipt.unknownOrUnfinishedSource==='retained-unreplayed-unaccounted'
   &&Array.isArray(proof.segments)&&stable(receipt.segments)===stable(proof.segments),'SG_RESUME_PENDING_RECEIPT');
  let next=1;
  for(const segment of proof.segments){
   assert(segment&&Number.isSafeInteger(segment.first)&&segment.first===next
    &&Number.isSafeInteger(segment.last)&&segment.last>=segment.first&&segment.last<=proof.count
    &&typeof segment.owner==='string'&&segment.owner.length>0,'SG_RESUME_PENDING_RECEIPT');
   next=segment.last+1;
  }
  assert(next===proof.count+1&&(proof.count!==0||proof.recordsHash===createHash('sha256').digest('hex')),
   'SG_RESUME_PENDING_RECEIPT');
  // An interrupted admission may already have sealed this exact ended prefix.
  // Reuse that immutable proof only when the adapter and ending are unchanged.
  // Older endings and revised adapters still require the complete audit below;
  // task startup independently rereads every staged round before any new request.
  if(receipt.endedRun===ended.run&&receipt.endedProofHash===ended.proofHash){
   await assertUnchanged();return task;
  }
 }
 const accepted=await inspectStaging({store,transport,game,queueId,kind,index,guard,verifyRecords,
  max});
 if(task.status==='success'||task.status==='pending'){
  const proof=task.status==='success'?task.proof:task.resume;
  assert(proof?.fullReadback===true&&proof.independentlyVerified===true
   &&proof.count===accepted.count&&proof.recordsHash===accepted.recordsHash
   &&stable(proof.segments)===stable(accepted.segments),'SG_RESUME_ACCEPTED_PREFIX_CHANGED');
  if(task.status==='success')assert(task.exitCode===0&&task.count===accepted.count&&accepted.count>=quota
   &&proof.queueId===queueId&&proof.gameId===game.gameId&&proof.campaignId===game.campaignId
   &&proof.taskId===task._id&&proof.owner===task.owner&&proof.pending===0
   &&proof.unknownRequests===0&&proof.activeLeases===0,'SG_RESUME_SUCCESS_PROOF');
  else {
   const receipt=(await store.get('journal',proof.receiptKey))?.value;
   assert(receipt?.schema==='sg-ag-rolling-resume-prefix-v1'&&queueHash(receipt)===proof.receiptHash
    &&receipt.queueId===queueId&&receipt.gameId===game.gameId&&receipt.campaignId===game.campaignId
    &&receipt.taskId===task._id&&receipt.count===accepted.count&&receipt.recordsHash===accepted.recordsHash
    &&stable(receipt.segments)===stable(accepted.segments),'SG_RESUME_PENDING_RECEIPT');
  }
  await assertUnchanged();
  return task;
 }
 const receipt={schema:'sg-ag-rolling-resume-prefix-v1',queueId,gameId:game.gameId,campaignId:game.campaignId,
  taskId:task._id,previousTaskHash:queueHash(task),endedRun:ended.run,endedProofHash:ended.proofHash,...accepted,
  unknownOrUnfinishedSource:'retained-unreplayed-unaccounted',sourceRequests:0};
 const receiptKey='rolling-resume:'+queueHash(receipt);
 await store.create('journal',receiptKey,receipt,{immutable:true});
 assert(queueHash((await store.get('journal',receiptKey))?.value)===queueHash(receipt),'SG_RESUME_RECEIPT_READBACK');
 await guard();const currentLease=(await store.get('state',stagingLeaseKey(queueId,game,kind,index)))?.value;
 assert(!currentLease||currentLease.expiresAt<=now(),'SG_RESUME_LIVE_LEASE');
 const value={_id:task._id,queueId,campaignId:game.campaignId,status:'pending',
  resume:{...accepted,receiptKey,receiptHash:queueHash(receipt)}};
 assert(await store.cas('state',key,before,value),'SG_RESUME_TASK_CHANGED');return value;
}
