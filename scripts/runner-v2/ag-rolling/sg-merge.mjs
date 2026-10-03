import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mergeDecision,quotas} from './ag-core.mjs';
import {readTasks} from './sg-queue-control.mjs';
import {stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
import {sourceJournalKey} from './sg-source-journal.mjs';
import {stageOwner} from './sg-resume.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {stable} from '../mongo-writer.mjs';
const stageKey=(prefix,n)=>prefix+String(n).padStart(10,'0');
async function independentlyVerify(verify,records){
 const result=await verify(records);
 assert(result?.verified===true&&result.count===records.length,'SG_MERGE_INDEPENDENT_VALIDATION');
}
// The original AG merge decision selects exactly the worker quotas. SG's
// I/O adapter streams full content readback instead of server-side gameplay
// processing. A game can merge while other games continue in other lanes.
export async function mergeGame({store,transport,game,queueId,plan,guard,verifyRecords,inspectBaseline,
 now=Date.now,owner,cleanup=false,recoverMerging}){
 const mergeKey='rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]);
 const completed=(await store.get('state',mergeKey))?.value;
 if(completed?.status==='complete'){
  assert(queueHash((await store.get('journal',mergeKey+':complete'))?.value)===queueHash(completed.result),'SG_MERGE_RECEIPT_CHANGED');
  return completed.result;
 }
 const tasks=await readTasks({store,game,queueId}),workers=tasks.filter(t=>t._id.startsWith('worker:'));
 if(workers.some(t=>['pending','running'].includes(t.status)))return {gameId:game.gameId,status:'active'};
 const leases=await store.getMany('state',Array.from({length:20},(_,i)=>stagingLeaseKey(queueId,game,'worker',i+1)));
 if(leases.some(r=>r?.value.expiresAt>now()))return {gameId:game.gameId,status:'active'};
 const inventory=[],limits=quotas(game.baseline),hash=createHash('sha256');
 for(let index=1;index<=20;index++){
  const task=workers.find(t=>t._id===`worker:${index}`),prefix=stagingPrefix(queueId,game,'worker',index),ids=[];
  if(task.status!=='success'||!task.proof)return {gameId:game.gameId,status:'blocked',reason:'SG_TASK_SOURCE_REVIEW_REQUIRED'};
  const proof=task.proof;assert(proof.fullReadback&&proof.independentlyVerified&&proof.queueId===queueId
   &&proof.gameId===game.gameId&&proof.campaignId===game.campaignId&&proof.taskId===task._id
   &&proof.owner===task.owner&&proof.pending===0&&proof.unknownRequests===0&&proof.activeLeases===0
   &&Number.isSafeInteger(proof.count)&&proof.count>=limits[index-1]&&proof.count<=limits[index-1]+7,'SG_MERGE_TASK_PROOF');
  const workerHash=createHash('sha256');
  for(let n=1;n<=proof.count;n+=100){
   await guard();const keys=Array.from({length:Math.min(100,proof.count-n+1)},(_,i)=>stageKey(prefix,n+i));
   const rows=await store.getMany('journal',keys);assert(rows.length===keys.length&&rows.every(Boolean),'SG_MERGE_STAGE_MISSING');
   const records=rows.map((r,i)=>{const v=r.value;
    assert(r._id.endsWith('/'+keys[i])&&v.queueId===queueId&&v.gameId===game.gameId&&v.campaignId===game.campaignId
     &&v.taskId===task._id&&(v.owner===task.owner||v.owner===stageOwner(proof,v.ordinal))
     &&v.ordinal===n+i,'SG_MERGE_STAGE_IDENTITY');
    ids.push({id:v.record._id,key:keys[i],ordinal:v.ordinal,owner:v.owner});workerHash.update(stable(v.record)+'\n');return v.record;});
   await independentlyVerify(verifyRecords,records);
  }
  assert(workerHash.digest('hex')===proof.recordsHash&&!await store.get('journal',stageKey(prefix,proof.count+1)),
   'SG_MERGE_STAGE_CHANGED');
  assert(new Set(ids.map(r=>r.id)).size===ids.length,'SG_MERGE_DUPLICATES');
  ids.sort((a,b)=>a.id.localeCompare(b.id));inventory.push({task,index,ids,count:proof.count});
 }
 const decision=mergeDecision(game,tasks,queueId,inventory.map(r=>r.count),0);
 if(!decision.acceptable)return {gameId:game.gameId,status:'blocked',count:decision.total};
 const existing=await store.create('state',mergeKey,{status:'pending',owner:null});
 if(existing.value.status==='complete')return existing.value.result;
 const recovering=existing.value.status==='merging';
 if(recovering){
  if(!recoverMerging)return {gameId:game.gameId,status:'merging'};
  const ended=await recoverMerging(existing.value);
  assert(ended?.actorEnded===true&&ended.owner===existing.value.owner&&ended.sourceRequests===0
   &&queueHash(existing.value.decision)===queueHash(decision),'SG_MERGE_ENDED_ACTOR_REQUIRED');
  await store.create('journal','rolling-merge-recovery:'+queueHash([mergeKey,existing.value,owner]),
   {mergeKey,previousStateHash:queueHash(existing.value),owner,...ended},{immutable:true});
 }else if(existing.value.status!=='pending')return {gameId:game.gameId,status:'merging'};
 const baseline=await inspectBaseline();assert(baseline?.verified===true&&baseline.count===game.baseline,'SG_MERGE_BASELINE_CHANGED');
 assert(typeof owner==='string','SG_MERGE_OWNER');await guard();
 if(!await store.cas('state',mergeKey,existing,{status:'merging',owner,queueId,gameId:game.gameId,decision}))
  return {gameId:game.gameId,status:'merging'};
 const selected=[];
 for(const worker of inventory){
  const rows=worker.ids.slice(0,decision.selected[worker.index-1]);
  for(let n=0;n<rows.length;n+=100){
   await guard();const refs=rows.slice(n,n+100),staged=await store.getMany('journal',refs.map(r=>r.key));
   assert(staged.length===refs.length&&staged.every((r,i)=>r?.value.record._id===refs[i].id),'SG_MERGE_SELECTION_CHANGED');
   const records=staged.map(r=>r.value.record);await independentlyVerify(verifyRecords,records);
   let missing=records.map((r,i)=>({key:refs[i].key,id:r._id,contentHash:r.contentHash}));
   if(recovering){
    const current=await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)});
    const found=new Map(current.map(r=>[r._id,r]));
    assert(found.size===current.length&&current.every(r=>records.some(expected=>expected._id===r._id&&stable(expected)===stable(r))),
     'SG_MERGE_RECOVERY_FORMAL_CHANGED');
    missing=missing.filter(r=>!found.has(r.id));
   }
   // This is storage-only settlement after an ended actor's full fresh
   // readback. Already saved rows are never issued again after unknown ACK.
   if(missing.length)await transport.request('rolling_stage_copy',{trialId:plan.trialId,records:missing});
   const saved=await transport.request('rounds_read',{trialId:plan.trialId,ids:records.map(r=>r._id)});
   const byId=new Map(saved.map(r=>[r._id,r]));assert(byId.size===records.length
    &&records.every(r=>stable(byId.get(r._id))===stable(r)),'SG_MERGE_NATIVE_FULL_READBACK');
   for(const r of records)hash.update(stable(r)+'\n');
   selected.push(...refs.map(r=>({...r,index:worker.index})));
  }
 }
 assert(selected.length+baseline.count===300000,'SG_MERGE_COUNT');
 // All twenty tasks are ended before final audit, and each selected byte was
 // independently checked on the original staging and the formal readback.
 const latest=await readTasks({store,game,queueId});assert(queueHash(latest)===queueHash(tasks),'SG_MERGE_TASKS_CHANGED');
 const finalLeases=await store.getMany('state',Array.from({length:20},(_,i)=>stagingLeaseKey(queueId,game,'worker',i+1)));
 assert(finalLeases.every(r=>!r||r.value.expiresAt<=now()),'SG_MERGE_LIVE_LEASE');
 const formal=await transport.request('rounds_count',{trialId:plan.trialId});
 assert(formal?.count===selected.length,'SG_MERGE_FORMAL_COUNT_CHANGED');
 const result={schema:'sg-ag-rolling-complete-v1',queueId,gameId:game.gameId,campaignId:game.campaignId,
  trialId:plan.trialId,count:300000,baseline:baseline.count,selected:decision.selected,
  recordsHash:hash.digest('hex'),fullReadback:true,independentlyVerified:true,
  excessPreserved:inventory.reduce((a,r)=>a+r.count,0)-selected.length,sourceRequests:0};
 await store.create('journal',mergeKey+':complete',result,{immutable:true});
 assert(queueHash((await store.get('journal',mergeKey+':complete'))?.value)===queueHash(result),'SG_MERGE_RECEIPT_READBACK');
 const before=await store.get('state',mergeKey);assert(before?.value.owner===owner&&before.value.status==='merging','SG_MERGE_FENCE');
 assert(await store.cas('state',mergeKey,before,{...before.value,status:'complete',result}),'SG_MERGE_FENCE');
 if(cleanup)await cleanupMerged({store,transport,game,queueId,plan,selected,result,guard});
 return result;
}
export async function cleanupMerged({store,transport,game,queueId,plan,selected,result,guard}){
 const mergeKey='rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]);
 assert(result.count===300000&&result.fullReadback&&result.independentlyVerified
  &&queueHash((await store.get('journal',mergeKey+':complete'))?.value)===queueHash(result),'SG_CLEANUP_FULL_FORMAL_PROOF');
 const hello=await transport.request('hello');assert(hello.rollingCleanupEnabled===true,'SG_CLEANUP_NATIVE_CAPABILITY');
 for(let n=0;n<selected.length;n+=100){
  await guard();const refs=selected.slice(n,n+100),staged=await store.getMany('journal',refs.map(r=>r.key));
  const saved=await transport.request('rounds_read',{trialId:plan.trialId,ids:refs.map(r=>r.id)}),byId=new Map(saved.map(r=>[r._id,r]));
  assert(staged.length===refs.length&&staged.every((r,i)=>r?.value.record._id===refs[i].id
   &&stable(byId.get(refs[i].id))===stable(r.value.record)),'SG_CLEANUP_FORMAL_BYTES_REQUIRED');
  const keys=new Set(refs.map(r=>r.key));
  for(const [i,row] of staged.entries())for(const step of row.value.record.raw.steps){
   const s=step.rollingSource;assert(s&&s.sessionHash===row.value.record.sourceSessionHash,'SG_CLEANUP_SOURCE_REF');
   for(const type of ['intent','response'])keys.add(sourceJournalKey({queueId,game,kind:'worker',index:refs[i].index,
    owner:refs[i].owner,sessionHash:s.sessionHash,requestNo:s.requestNo,type}));
  }
  const pending=[...keys];for(let i=0;i<pending.length;i+=1000){
   const page=pending.slice(i,i+1000),ack=await transport.request('rolling_journal_delete',{keys:page});
   assert(Number.isSafeInteger(ack?.deleted)&&ack.deleted===page.length,'SG_CLEANUP_ACK');
  }
 }
}
