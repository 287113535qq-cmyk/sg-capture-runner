import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {readTasks} from './sg-queue-control.mjs';
import {quotas} from './ag-core.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
// A settled rolling game keeps its original tasks and immutable completion
// proof across windows. Selected official rows are insert-only in the native
// adapter; cleanup removes staging, never official rows or these receipts.
// Count alone never authorizes treating an existing game as complete.
export async function inspectFormalBaseline({profile,game,plan,store,transport,ended,guard=async()=>{},now=Date.now}){
 assert(game.baseline===0&&String(plan.gameId)===game.gameId,'SG_AG_FIRST_QUEUE_BASELINE');
 await guard();
 const key='rolling-merge:'+queueHash([profile.payload.queueId,game.gameId,game.campaignId]);
 const state=(await store.get('state',key))?.value;
 const native=await transport.request('rounds_count',{trialId:plan.trialId});
 assert(Number.isSafeInteger(native?.count)&&native.count>=0,'SG_AG_FORMAL_COUNT_REQUIRED');
 if(native.count===0&&state?.status!=='complete')return {status:'empty',count:0};
 assert(profile.resume&&ended?.status==='completed'&&ended.sourceJobsEnded===true
  &&ended.queueId===profile.payload.queueId&&ended.run===profile.resume.previousRun,'SG_AG_FORMAL_BASELINE_CHANGED');
 const proof=state?.result,receipt=(await store.get('journal',key+':complete'))?.value;
 assert(state?.status==='complete'&&state.queueId===profile.payload.queueId&&state.gameId===game.gameId
  &&proof?.schema==='sg-ag-rolling-complete-v1'&&proof.queueId===profile.payload.queueId
  &&proof.gameId===game.gameId&&proof.campaignId===game.campaignId&&proof.trialId===plan.trialId
  &&proof.baseline===0&&proof.count===300000&&native.count===300000
  &&proof.fullReadback===true&&proof.independentlyVerified===true&&/^[a-f0-9]{64}$/.test(proof.recordsHash??'')
  &&queueHash(proof)===queueHash(receipt),'SG_AG_MERGED_BASELINE_PROOF');
 const tasks=await readTasks({store,game,queueId:profile.payload.queueId}),limits=quotas(game.baseline);
 for(const task of tasks){
  const [kind,id]=task._id.split(':'),quota=kind==='canary'?10:limits[Number(id)-1],p=task.proof;
  assert(task.status==='success'&&task.exitCode===0&&p?.queueId===profile.payload.queueId
   &&p.gameId===game.gameId&&p.campaignId===game.campaignId&&p.taskId===task._id&&p.owner===task.owner
   &&p.fullReadback===true&&p.independentlyVerified===true&&p.pending===0&&p.unknownRequests===0
   &&p.activeLeases===0&&Number.isSafeInteger(p.count)&&p.count>=quota&&p.count<=quota+(kind==='worker'?7:0)
   &&task.count===p.count&&/^[a-f0-9]{64}$/.test(p.recordsHash??''),'SG_AG_MERGED_TASK_PROOF');
 }
 const keys=tasks.map(t=>{const [kind,id]=t._id.split(':');return stagingLeaseKey(profile.payload.queueId,game,kind,Number(id));});
 const leases=await store.getMany('state',keys);
 assert(leases.length===keys.length&&leases.every(r=>!r||r.value.expiresAt<=now()),'SG_AG_MERGED_LIVE_LEASE');
 await guard();
 assert(queueHash((await store.get('state',key))?.value)===queueHash(state)
  &&(await transport.request('rounds_count',{trialId:plan.trialId})).count===300000,'SG_AG_MERGED_BASELINE_CHANGED');
 return {status:'complete',count:300000,proofHash:queueHash(proof),sourceRequests:0};
}
