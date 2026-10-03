import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coalesceWriter} from './sg-batch-writer.mjs';
import {taskKey} from './sg-task-store.mjs';
import {taskId,quotas} from './ag-core.mjs';
import {stable} from '../mongo-writer.mjs';
import {inspectStaging,verifySavedSources,stageOwner} from './sg-resume.mjs';
const digest=v=>createHash('sha256').update(stable(v)).digest('hex');
export function stagingPrefix(queueId,game,kind,index){
 return 'rolling-stage:'+digest([queueId,game.gameId,game.dbName,game.campaignId,taskId(kind,index)])+':';
}
export const stagingLeaseKey=(queueId,game,kind,index)=>'rolling-lease:'+digest([stagingPrefix(queueId,game,kind,index)]);
export function createStagingStore({store,transport,game,queueId,kind,index,quota,owner,guard,
 verifyRecords,assertDurable,inspectSource,resume,onResume=()=>{},now=Date.now}){
 assert(typeof verifyRecords==='function'&&typeof assertDurable==='function'&&typeof guard==='function'
  &&typeof inspectSource==='function','SG_STAGE_DEPENDENCIES');
 assert(quota===(kind==='canary'?10:quotas(game.baseline)[index-1]),'AG_STAGE_QUOTA');
 const id=taskId(kind,index),prefix=stagingPrefix(queueId,game,kind,index),leaseKey=stagingLeaseKey(queueId,game,kind,index);
 const max=quota+(kind==='canary'?0:7),seen=new Set();let ordinal=0,capability=false;
 const rowKey=n=>prefix+String(n).padStart(10,'0');
 const checkTask=async()=>{
  await guard();const t=(await store.get('state',taskKey(queueId,game,id)))?.value;
  assert(t?._id===id&&t.status==='running'&&t.owner===owner&&t.queueId===queueId&&t.campaignId===game.campaignId,'SG_STAGE_TASK_OWNERSHIP');
 };
 const verifyPage=async rows=>{
  const records=rows.map(r=>r.record);
  assert(rows.every(r=>r.queueId===queueId&&r.gameId===game.gameId&&r.campaignId===game.campaignId
   &&r.taskId===id&&(r.owner===owner||r.owner===stageOwner(resume,r.ordinal))
   &&Number.isSafeInteger(r.ordinal)&&r.ordinal>0),'SG_STAGE_IDENTITY');
  const result=await verifyRecords(records);
  assert(result?.verified===true&&result.count===records.length,'SG_STAGE_INDEPENDENT_VALIDATION');
 };
 const writer=coalesceWriter({guard:checkTask,writeAndReadback:async values=>{
  if(!capability){const hello=await transport.request('hello');
   assert(hello?.database==='sg_capture_staging_v1'&&hello.rollingJournalBatchEnabled===true,'SG_STAGE_NATIVE_CAPABILITY');capability=true;}
  const rows=values.map(v=>({key:v._id,value:v.value}));
  await verifyPage(rows.map(r=>r.value));await assertDurable(rows.map(r=>r.value.record));
  await transport.request('rolling_journal_insert',{records:rows});
  const saved=await store.getMany('journal',rows.map(r=>r.key));
  assert(saved.length===rows.length&&saved.every(Boolean),'SG_STAGE_NATIVE_READBACK');
  return saved.map((d,i)=>{assert(typeof d._id==='string'&&d._id.endsWith('/'+rows[i].key),'SG_STAGE_NATIVE_KEY');
   return {_id:rows[i].key,value:d.value};});
 }});
 const api={
  async tryAcquireGameLease(db,g,who,ms){
   assert(db===game.dbName&&g===game.gameId&&who===owner,'SG_STAGE_LEASE_SCOPE');await checkTask();
   const before=await store.create('state',leaseKey,{owner:null,expiresAt:0});
   if(before.value.expiresAt>now())return false;
   return !!await store.cas('state',leaseKey,before,{owner,expiresAt:now()+ms});
  },
  async renewGameLease(db,who,ms){
   assert(db===game.dbName&&who===owner,'SG_STAGE_LEASE_SCOPE');await checkTask();
   const before=await store.get('state',leaseKey);
   if(before?.value.owner!==owner||before.value.expiresAt<=now())return false;
   return !!await store.cas('state',leaseKey,before,{owner,expiresAt:now()+ms});
  },
  async releaseGameLease(db,who){
   assert(db===game.dbName&&who===owner,'SG_STAGE_LEASE_SCOPE');
   await writer.drain();const before=await store.get('state',leaseKey);
   assert(before?.value.owner===owner,'SG_STAGE_LEASE_LOST');
   assert(await store.cas('state',leaseKey,before,{owner,expiresAt:0}),'SG_STAGE_LEASE_LOST');
  },
  async getCounts(db){assert(db===game.dbName,'SG_STAGE_DATABASE');await checkTask();
   assert(ordinal===0,'SG_STAGE_REENTRY_REVIEW_REQUIRED');
   if(resume){
    const receipt=(await store.get('journal',resume.receiptKey))?.value;
    assert(receipt&&digest(receipt)===resume.receiptHash&&receipt.queueId===queueId&&receipt.gameId===game.gameId
     &&receipt.taskId===id&&receipt.count===resume.count&&receipt.recordsHash===resume.recordsHash
     &&stable(receipt.segments)===stable(resume.segments),'SG_STAGE_RESUME_RECEIPT');
    const actual=await inspectStaging({store,transport,game,queueId,kind,index,guard:checkTask,verifyRecords,max});
    assert(stable(actual)===stable({count:resume.count,recordsHash:resume.recordsHash,segments:resume.segments,
     fullReadback:true,independentlyVerified:true}),'SG_STAGE_RESUME_CHANGED');
    ordinal=actual.count;onResume(ordinal);
   }else assert(!await store.get('journal',rowKey(1)),'SG_STAGE_REENTRY_REVIEW_REQUIRED');
   return {base:ordinal,feature:0,optionCount:0,freeChoiceOptions:{}};
  },
  async insertRound(db,round){
   assert(db===game.dbName,'SG_STAGE_DATABASE');await checkTask();
   const record=round?.data?.sgRecord;
   assert(record?.fixtureOnly===false&&record.buy===0&&String(record.gameId)===game.gameId
    &&/^[a-f0-9]{64}$/.test(record._id??'')&&/^[a-f0-9]{64}$/.test(record.contentHash??'')
    &&!seen.has(record._id)&&ordinal<max,'SG_STAGE_RECORD');
   seen.add(record._id);const n=++ordinal;
   const value={queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,ordinal:n,record:structuredClone(record)};
   return writer.insert({_id:rowKey(n),value});
  },
  async verify(){
   await writer.drain();await checkTask();
   const lease=(await store.get('state',leaseKey))?.value;
   assert(!lease||lease.expiresAt<=now(),'SG_STAGE_LIVE_LEASE');
   const source=await inspectSource();
   assert(source?.queueId===queueId&&source.gameId===game.gameId&&source.taskId===id&&source.owner===owner
    &&source.pending===0&&source.unknownRequests===0&&source.activeLeases===0&&source.protocolFaults===0
    &&source.sourcesClosed===true,'SG_STAGE_SOURCE_UNSETTLED');
   const hash=createHash('sha256'),segments=[];let count=0;const unique=new Set();
   for(let n=1;n<=ordinal;n+=100){
    const keys=Array.from({length:Math.min(100,ordinal-n+1)},(_,i)=>rowKey(n+i));
    const docs=await store.getMany('journal',keys);
    assert(docs.length===keys.length&&docs.every(Boolean),'SG_STAGE_FULL_READBACK');
    const rows=docs.map((d,i)=>{assert(d._id.endsWith('/'+keys[i])&&d.value.ordinal===n+i,'SG_STAGE_ORDER');return d.value;});
    await verifyPage(rows);
    const previous=rows.filter(r=>r.owner!==owner);
    if(previous.length)await verifySavedSources({store,rows:previous,game,queueId,kind,index});
    for(const r of rows){assert(!unique.has(r.record._id),'SG_STAGE_DUPLICATE_ROUND');unique.add(r.record._id);hash.update(stable(r.record)+'\n');count++;
     if(segments.at(-1)?.owner===r.owner)segments.at(-1).last=count;
     else segments.push({first:count,last:count,owner:r.owner});}
   }
   assert(!await store.get('journal',rowKey(ordinal+1)),'SG_STAGE_UNEXPECTED_SUFFIX');
   assert(count>=quota&&count<=max,'SG_STAGE_COUNT');
   return {queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:id,owner,count,
    fullReadback:true,independentlyVerified:true,recordsHash:hash.digest('hex'),segments,
    ...(resume?{resumeReceiptKey:resume.receiptKey,resumeReceiptHash:resume.receiptHash}:{}),
    pending:0,activeLeases:0,unknownRequests:0};
  },close:()=>writer.close(),status:()=>({ordinal,...writer.status()}),
 };
 return api;
}
