import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {finalizePreparedAudit} from './prepared-audit-completion.mjs';

// Bounded deferred finalization after the original matrix and all leases end.
// The original finalizer's wait limit can expire first; it grants no new BET.
export async function finalizePreparedEndedSource({store,campaign,plan,profile,authorization,
 ended,jobs,boundary,now=Date.now}){
 assert(profile?.schema==='sg-prepared-count-profile-v1'&&profile.group==='primary'
  &&authorization?.profileHash===hash(profile)&&authorization.activation===profile.activation
  &&authorization.gameId===plan.gameId&&authorization.trialId===plan.trialId
  &&authorization.group==='primary'&&plan.countAllocation===profile.activation
  &&profile.planHash===hash(plan)&&plan.target===300000&&plan.phase===1&&plan.buy===0,'PREPARED_ENDED_PROFILE');
 assert(ended.repository.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.run_attempt===1
  &&ended.status==='completed'&&['success','failure','cancelled'].includes(ended.conclusion)
  &&Number.isSafeInteger(ended.id)&&/^[a-f0-9]{40}$/.test(ended.head_sha),'PREPARED_ENDED_SOURCE');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100&&jobs.jobs.every(j=>j.status==='completed')
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(n=>jobs.jobs.filter(j=>j.name===n).length===1),'PREPARED_ENDED_JOBS');
 await boundary();
 const run=ended.id+':1',pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:ended.head_sha});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${run}`))?.value;
 const bound=(await store.get('state','capture-run:'+run))?.value;
 assert(bound?.gameId===plan.gameId&&spec.profileHash===hash(profile)&&permit?.schema==='sg-count-run-v1'
  &&permit.run===run&&permit.commit===ended.head_sha&&permit.activation===profile.activation
  &&permit.profileHash===hash(profile),'PREPARED_ENDED_PERMISSION');
 const key=`count-prepared-close:${plan.trialId}:${run}:complete`;
 const old=(await store.get('journal',key))?.value;
 const c=(await store.get('state','campaign'))?.value,g=c?.games.find(g=>g.game_id===plan.gameId);
 if(pool.confirmed===plan.target&&['ready','active'].includes(g?.status)){
  return finalizePreparedAudit({store,plan,pool,spec,campaign:c,sourceRun:run,sourceCommit:ended.head_sha,boundary,now});
 }
 if(old){
  assert(old.schema==='sg-count-prepared-close-v1'&&old.sourceRun===run&&old.activation===profile.activation
   &&old.sourceCommit===ended.head_sha&&old.unknownAttempts===0&&old.newBetAllowance===0
   &&g?.status==='parked-protocol'&&g.repairKey===old.repairKey&&c.activeGame===null,'PREPARED_ENDED_CLOSED');
  return{alreadyClosed:true,completePreserved:old.completePreserved,sourceRequests:0,newBetAllowance:0};
 }
 assert(c.activeGame===plan.gameId&&g?.status==='parking-protocol'&&!c.validationLimit&&!c.protocolValidation
  &&pool.enabled===false&&pool.drainingProtocol===true&&pool.failure==='PROTOCOL_VALIDATION_FAILED'
  &&Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'PREPARED_ENDED_NOT_IDLE');
 await boundary();
 assert(hash((await store.get('state','campaign'))?.value)===hash(c)
  &&hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'PREPARED_ENDED_CHANGED');
 // The existing controller pages every batch and performs full raw/Mongo audit.
 await campaign.finalizeStoppedRun('capture-run:'+run,{waitMs:0});
 const closed=(await store.get('journal',key))?.value;
 assert(closed?.schema==='sg-count-prepared-close-v1'&&closed.sourceRun===run
  &&closed.activation===profile.activation&&closed.sourceCommit===ended.head_sha
  &&closed.unknownAttempts===0&&closed.sourceRequests===0&&closed.newBetAllowance===0,'PREPARED_ENDED_READBACK');
 return{closed:true,completePreserved:closed.completePreserved,sourceRequests:0,newBetAllowance:0};
}
