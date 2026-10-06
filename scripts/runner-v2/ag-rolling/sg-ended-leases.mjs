import assert from 'node:assert/strict';
import {stagingLeaseKey} from './sg-staging-store.mjs';

// A hosted job may have ended before its last capture lease expires. Settle
// those leases before AG inspects task status, so its single reconciliation
// sees the ended workers instead of preserving a stale running task.
export async function waitForEndedLeases({profile,store,sourceJobsEnded,deadline,guard,
 now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),pollMs=10000}){
 assert(sourceJobsEnded===true,'SG_AG_SOURCE_JOBS_ACTIVE');
 assert(Number.isFinite(deadline)&&Number.isSafeInteger(pollMs)&&pollMs>0&&pollMs<=10000
  &&typeof guard==='function','SG_AG_ENDED_LEASE_WAIT_BOUND');
 const {queueId,games}=profile.payload;
 const keys=games.flatMap(game=>[...[1,2].map(i=>stagingLeaseKey(queueId,game,'canary',i)),
  ...Array.from({length:20},(_,i)=>stagingLeaseKey(queueId,game,'worker',i+1))]);
 assert(keys.length>0&&new Set(keys).size===keys.length,'SG_AG_SOURCE_LEASE_SCOPE');
 const checkDeadline=()=>assert(now()<deadline,'SG_AG_SOURCE_LEASES_ACTIVE');
 for(;;){
  checkDeadline();await guard();checkDeadline();let live=0;
  for(let offset=0;offset<keys.length;offset+=100){
   const wanted=keys.slice(offset,offset+100),rows=await store.getMany('state',wanted);
   checkDeadline();
   assert(Array.isArray(rows)&&rows.length===wanted.length
    &&wanted.every((key,i)=>rows[i]===null||rows[i]&&rows[i]._id==='primary/'+key
     &&Number.isSafeInteger(rows[i].value?.expiresAt)&&rows[i].value.expiresAt>=0),'SG_AG_SOURCE_LEASE_READBACK');
   live+=rows.filter(row=>row!==null&&row.value.expiresAt>now()).length;
  }
  checkDeadline();if(live===0)return;
  const remaining=deadline-now();assert(remaining>0,'SG_AG_SOURCE_LEASES_ACTIVE');
  await sleep(Math.min(pollMs,remaining));
 }
}
