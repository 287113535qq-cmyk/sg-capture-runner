import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {taskId,quotas} from './ag-core.mjs';
const statuses=['pending','running','success','failed','blocked'];
const copy=v=>structuredClone(v);
export function taskKey(queueId,game,id){
 const [kind,number]=id.split(':');assert(taskId(kind,Number(number))===id,'AG_TASK_ID');
 const namespace=createHash('sha256').update(JSON.stringify([queueId,game.gameId,game.dbName,game.campaignId])).digest('hex');
 return `rolling-task:${namespace}:${id}`;
}
function identity(row,queueId,game,id){
 assert(row?._id===id&&row.queueId===queueId&&row.campaignId===game.campaignId
  &&statuses.includes(row.status),'AG_TASK_IDENTITY');return row;
}
export async function prepareTasks({store,game,queueId,guard}){
 // Same 22 AG task records, in SG's group-scoped native metadata namespace.
 // Never reuse or reset a running task at provisioning time.
 await guard();
 for(const id of [...[1,2].map(i=>taskId('canary',i)),...Array.from({length:20},(_,i)=>taskId('worker',i+1))]){
  const row={_id:id,queueId,campaignId:game.campaignId,status:'pending'};
  const existing=await store.create('state',taskKey(queueId,game,id),row);
  assert(identity(existing?.value,queueId,game,id).status==='pending','AG_INITIAL_TASK_STATE');
 }
}
export function connectTaskStore({store,game,queueId,guard,verifyTask,now=Date.now,close=async()=>{}}){
 assert(typeof guard==='function'&&typeof verifyTask==='function','SG_TASK_ADAPTER_REQUIRED');
 const verified=new Map();
 const read=async id=>identity((await store.get('state',taskKey(queueId,game,id)))?.value,queueId,game,id);
 return {
  read:async id=>copy(await read(id)),
  async claim(id,owner){
   assert(typeof owner==='string'&&/^[A-Za-z0-9._:-]{1,150}$/.test(owner),'AG_TASK_OWNER');
   await guard();
   const key=taskKey(queueId,game,id),before=await store.get('state',key);
   const row=identity(before?.value,queueId,game,id);if(row.status!=='pending')return false;
   const value={...row,status:'running',owner,startedAt:new Date(now()).toISOString(),updatedAt:new Date(now()).toISOString()};
   // Only a definite negative CAS means another lane won. An uncertain ACK
   // throws, preserving the AG running/pending state for ended-run review.
   const result=await store.cas('state',key,before,value);return !!result;
  },
  async verify(kind,index,quota){
   const id=taskId(kind,index),row=await read(id);
   assert(row.status==='running','AG_VERIFY_TASK_STATE');
   assert(quota===(kind==='canary'?10:quotas(game.baseline)[index-1]),'AG_VERIFY_QUOTA');
   const proof=await verifyTask({game,queueId,kind,index,quota,owner:row.owner});
   const cap=quota+(kind==='worker'?7:0);
   assert(proof?.queueId===queueId&&proof.gameId===game.gameId&&proof.campaignId===game.campaignId
    &&proof.taskId===id&&proof.owner===row.owner&&proof.fullReadback===true&&proof.independentlyVerified===true
    &&Number.isSafeInteger(proof.count)&&proof.count>=quota&&proof.count<=cap
    &&proof.pending===0&&proof.activeLeases===0&&proof.unknownRequests===0
    &&/^[a-f0-9]{64}$/.test(proof.recordsHash??''),'SG_TASK_FULL_READBACK');
   verified.set(id,{owner:row.owner,proof:copy(proof)});
  },
  async finish(id,owner,status,exitCode){
   assert(['success','failed','blocked'].includes(status)&&Number.isInteger(exitCode),'AG_TASK_FINISH');
   await guard();const key=taskKey(queueId,game,id),before=await store.get('state',key);
   const row=identity(before?.value,queueId,game,id);
   assert(row.status==='running'&&row.owner===owner,'AG_TASK_OWNERSHIP_LOST');
   if(status==='success')assert(exitCode===0&&verified.get(id)?.owner===owner,'SG_SUCCESS_REQUIRES_VERIFICATION');
   const value={...row,status,exitCode,finishedAt:new Date(now()).toISOString(),updatedAt:new Date(now()).toISOString()};
   assert(await store.cas('state',key,before,value),'AG_TASK_OWNERSHIP_LOST');
   verified.delete(id);
  },close,
 };
}
