import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';
import {receiptKey} from './durable-queue.mjs';

// Settle a parked formal pool through the existing retirement implementation.
// The historical commit authenticates old records, never this runtime's source permission.
export async function retireStoppedFormal({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run,now=Date.now}){
 const stamp=now();
 const secondary=profile?.schema==='sg-formal-stopped-retire-pyramids-v1';
 assert(!secondary||(profile.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'
  &&profile.group==='secondary'&&plan.target===299850),'FORMAL_RETIRE_SECONDARY_SCOPE');
 assert(secondary||profile.closedBatchDecorations===undefined,'FORMAL_RETIRE_DECORATION_SCOPE');
 assert((secondary||profile?.schema==='sg-formal-stopped-retire-profile-v1')&&profile.trialId===plan.trialId
  &&profile.gameId===plan.gameId&&profile.planHash===hash(plan)&&profile.sourceAllowance===0
  &&Number.isSafeInteger(profile.createdAt)&&profile.createdAt<=stamp&&stamp<profile.expiresAt
  &&profile.expiresAt-profile.createdAt<=7200000&&/^[a-f0-9]{40}$/.test(commit??'')
  &&/^\d+:1$/.test(run??''),'FORMAL_RETIRE_PROFILE');
 assert(ended?.repository?.full_name===(secondary?'287113535qq-cmyk/sg-capture-runner':'zyzuoyang/sg-capture-runner')&&ended.status==='completed'
  &&ended.conclusion==='success'&&ended.head_sha===profile.sourceCommit
  &&`${ended.id}:${ended.run_attempt}`===profile.sourceRun,'FORMAL_RETIRE_SOURCE');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.jobs.every(j=>j.status==='completed')
  &&jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name)).length===20
  &&Array.from({length:20},(_,i)=>`capture-${i}`).every(name=>jobs.jobs.some(j=>j.name===name&&j.conclusion==='success'))
  &&[secondary?'pyramids-formal-admit':'formal-admit','verify'].every(name=>jobs.jobs.some(j=>j.name===name&&j.conclusion==='success')),'FORMAL_RETIRE_JOBS');
 const key=`formal-stopped-retire:${plan.trialId}:${hash(profile)}`;
 assert(!(await store.get('journal',key+':complete')),'FORMAL_RETIRE_ALREADY_COMPLETE');
 await boundary();
 const c=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(c&&hash(c)===profile.campaignHash&&c.activeGame===null&&pool&&!pool.enabled
  &&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&hash(pool)===profile.poolHash,'FORMAL_RETIRE_SCENE');
 const entry=c.games.find(g=>g.game_id===plan.gameId),repair=(await store.get('state',profile.repairKey))?.value;
 assert(entry?.status==='parked-protocol'&&entry.repairKey===profile.repairKey&&repair
  &&hash(repair)===profile.repairHash&&repair.sourceAllowance===0&&repair.requiresNewSession===true,'FORMAL_RETIRE_REPAIR');
 const spec=await loadCountPermission({store,plan,pool,commit:profile.sourceCommit});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${profile.sourceRun}`))?.value;
 assert(permit?.activation===spec.activation&&permit.commit===profile.sourceCommit
  &&permit.profileHash===spec.profileHash&&permit.run===profile.sourceRun,'FORMAL_RETIRE_RUN_PERMISSION');
 const records=[];
 for(let start=1;start<pool.nextBatchId;start+=100){
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${plan.trialId}:${start+i}`);
  const rows=await store.getMany('state',keys);assert(rows.every(Boolean),'FORMAL_RETIRE_BATCH');
  for(const {value:b} of rows){
   assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.checkpoint===b.journaled
    &&b.leaseUntil<=stamp&&b.journaled>=b.start-1&&b.journaled<=b.end&&b.end-b.start<100,'FORMAL_RETIRE_PENDING');
   const keys=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(plan.trialId,b.start+i));
   const got=keys.length?await store.getMany('journal',keys):[];assert(got.every(Boolean),'FORMAL_RETIRE_RECEIPT');
   records.push(...got.map(r=>r.value));
  }
 }
 assert(records.length===profile.completePreserved&&hash(records)===profile.recordsHash,'FORMAL_RETIRE_RECORDS');
 const originalJournal=(await store.get('journal',profile.abandonedKey))?.value;
 assert(originalJournal&&hash(originalJournal)===profile.abandonedHash,'FORMAL_RETIRE_ABANDONED');
 const guarded=async()=>{await boundary();assert(hash((await store.get('state','campaign'))?.value)===profile.campaignHash
  &&hash((await store.get('state',profile.repairKey))?.value)===profile.repairHash,'FORMAL_RETIRE_SCENE_CHANGED');};
 const result=await retireDemoPool({store,transport,gate,parser,plan,boundary:guarded,owner:run,
  expectedPoolHash:profile.poolHash,commit:profile.sourceCommit,group:secondary?'secondary':'primary',
  closedBatchDecorations:profile.closedBatchDecorations??[],now});
 assert(result.completePreserved===profile.completePreserved&&result.abandonedAttempts===0
  &&result.sourceRequests===0&&result.newBetAllowance===0,'FORMAL_RETIRE_RESULT');
 const out={schema:'sg-formal-stopped-retire-v1',profileHash:hash(profile),trialId:plan.trialId,
  sourceRun:profile.sourceRun,sourceCommit:profile.sourceCommit,commit,run,completePreserved:result.completePreserved,
  recordsHash:profile.recordsHash,repairKey:profile.repairKey,abandonedKey:profile.abandonedKey,
  newAbandoned:0,sourceRequests:0,newBetAllowance:0,at:now()};
 await store.create('journal',key+':complete',out,{immutable:true});
 assert(hash((await store.get('journal',key+':complete'))?.value)===hash(out),'FORMAL_RETIRE_READBACK');
 return out;
}
