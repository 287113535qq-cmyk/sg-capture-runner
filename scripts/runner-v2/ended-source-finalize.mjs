import assert from 'node:assert/strict';
import {loadCountPermission} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Maintenance may finish AG parking for an ended source. It does not select a
// new game, settle/rewrite old batches, mint quota or reconnect a source session.
export async function finalizeEndedSource({store,campaign,plan,profile,ended,jobs,boundary}){
 assert(plan.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'&&plan.buy===0&&plan.phase===1
  &&ended.repository.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.run_attempt===1
  &&ended.status==='completed'&&['success','failure','cancelled'].includes(ended.conclusion),'ENDED_FINALIZE_SOURCE');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100&&jobs.jobs.every(j=>j.status==='completed')
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name).length===1),'ENDED_FINALIZE_JOBS');
 await boundary();
 const run=`${ended.id}:1`,bound=(await store.get('state','capture-run:'+run))?.value;
 const c=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:ended.head_sha});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${run}`))?.value;
 assert(bound?.gameId===plan.gameId&&spec.profileHash===hash(profile)&&permit?.schema==='sg-count-run-v1'&&permit.activation===spec.activation
  &&permit.commit===ended.head_sha&&permit.run===run&&permit.profileHash===hash(profile),'ENDED_FINALIZE_PERMISSION');
 const game=c.games.find(g=>g.game_id===plan.gameId);
 if(c.activeGame===null&&game?.status==='parked-protocol')return {parked:true,alreadyParked:true,sourceRequests:0,newBetAllowance:0};
 assert(c.activeGame===plan.gameId&&game?.status==='parking-protocol'&&!c.validationLimit&&!c.protocolValidation
  &&pool.drainingProtocol===true&&!pool.enabled&&pool.failure==='PROTOCOL_VALIDATION_FAILED','ENDED_FINALIZE_SCENE');
 const ids=Object.values(pool.workers).filter(w=>w.activeBatch).map(w=>w.activeBatch.id);
 assert(ids.length<=20&&new Set(ids).size===ids.length,'ENDED_FINALIZE_WORKERS');
 const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
 assert(rows.length===ids.length&&rows.every(r=>r&&!r.value.pending&&!r.value.pendingOriginal&&!r.value.bootstrapAwaiting
  &&r.value.checkpoint===r.value.journaled),'ENDED_FINALIZE_PENDING');
 await boundary();
 assert(hash((await store.get('state','campaign'))?.value)===hash(c)
  &&hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'ENDED_FINALIZE_SCENE_CHANGED');
 await campaign.finalizeStoppedRun('capture-run:'+run,{waitMs:300000});
 const after=(await store.get('state','campaign')).value,entry=after.games.find(g=>g.game_id===plan.gameId);
 assert(after.activeGame===null&&entry.status==='parked-protocol'&&entry.repairKey,'ENDED_FINALIZE_WAITING');
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'ENDED_FINALIZE_POOL_CHANGED');
 return {parked:true,repairKey:entry.repairKey,sourceRequests:0,newBetAllowance:0};
}
