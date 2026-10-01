import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,auditCountBatch,checkLedger} from './complete-count.mjs';
import {checkParentTailFailure} from './parent-tail-failure.mjs';
import {checkVerifyEntryFailure} from './verify-entry-failure.mjs';

// A completed, healthy run may move to a reviewed runtime without minting quota.
// Only immutable authorization is added; campaign, pool, batches and records stay intact.
export async function refreshCountRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary,parentTailFailure,verifyEntryFailure,now=Date.now}){
 const verify=verifyEntryFailure?checkVerifyEntryFailure({ended,jobs,evidence:verifyEntryFailure}):null;
 const tail=ended.conclusion==='failure'&&!verify?checkParentTailFailure({ended,jobs,evidence:parentTailFailure}):null;
 assert(!verify||(profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===2
  &&revision.verifyEntryFailureHash===hash(verify)&&revision.newBetAllowance===0&&revision.completePreserved===35722),'COUNT_REFRESH_VERIFY_FAILURE_SCOPE');
 assert(!tail||(profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===2
  &&revision.parentTailFailureHash===hash(tail)&&revision.newBetAllowance===0&&revision.completePreserved===18694),'COUNT_REFRESH_PARENT_FAILURE_SCOPE');
 assert(revision.schema==='sg-count-runtime-refresh-profile-v1'
  &&revision.profileHash===hash(profile)&&revision.activation===profile.activation
  &&revision.planHash===hash(plan)&&revision.gameId===plan.gameId
  &&/^[a-f0-9]{40}$/.test(commit)&&commit!==revision.fromCommit
  &&revision.createdAt<=now()&&now()<revision.expiresAt
  &&revision.expiresAt-revision.createdAt<=7200000,'COUNT_REFRESH_PROFILE');
 assert(`${ended.id}:${ended.run_attempt}`===revision.sourceRun&&ended.status==='completed'
  &&(ended.conclusion==='success'||tail||verify)&&ended.head_sha===revision.fromCommit
  &&ended.repository.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml','COUNT_REFRESH_SOURCE');
 assert(tail||verify||(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100
  &&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1)
 ),'COUNT_REFRESH_JOBS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===revision.poolHash&&hash(campaign)===revision.campaignHash,'COUNT_REFRESH_SCENE_CHANGED');
 const spec=await loadCountPermission({store,plan,pool,commit:revision.fromCommit});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`))?.value;
 assert(permit?.schema==='sg-count-run-v1'&&permit.commit===revision.fromCommit
  &&permit.run===revision.sourceRun&&permit.activation===spec.activation&&permit.profileHash===spec.profileHash
  &&hash(permit)===revision.sourcePermitHash,'COUNT_REFRESH_PERMIT');
 assert(!tail||permit.completeBefore+tail.childComplete===revision.completePreserved,'COUNT_REFRESH_CHILD_COUNT');
 assert(!verify||permit.completeBefore+verify.childComplete===revision.completePreserved,'COUNT_REFRESH_CHILD_COUNT');
 const ledger=checkLedger(pool,plan,spec);
 assert(spec.profileHash===hash(profile)&&pool.enabled&&!pool.failure&&ledger.reserved===0
  &&pool.confirmed===revision.completePreserved&&pool.confirmed>=permit.completeBefore&&pool.confirmed<plan.target
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now())
  &&campaign.enabled&&campaign.activeGame===plan.gameId&&!campaign.audit
  &&!campaign.protocolValidation&&!campaign.validationLimit&&campaign.formalCount?.activation===spec.activation,
 'COUNT_REFRESH_NOT_IDLE');
 // Reuse immutable per-batch full-readback proofs, in bounded pages. Never scan
 // old raw samples again merely because an observation wrapper changed.
 const cache=new Map();let preserved=0;
 for(let start=1;start<pool.nextBatchId;start+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>start+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'COUNT_REFRESH_BATCH_MISSING');
  const keys=ids.filter(id=>id>spec.baselineBatchCount).map(id=>pool.countAllocation.batches[id].settlementKey);
  assert(keys.every(k=>typeof k==='string'),'COUNT_REFRESH_PROOF_REQUIRED');
  if(keys.length){
   const proofs=await store.getMany('journal',keys);
   assert(proofs.length===keys.length&&proofs.every(Boolean),'COUNT_REFRESH_PROOF_MISSING');
   proofs.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));
  }
  for(const [i,row]of rows.entries()){
   const b=row.value,id=ids[i];
   assert(b.id===id&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now()
    &&b.checkpoint===b.journaled&&pool.countAllocation.batches[id].closed,'COUNT_REFRESH_BATCH_UNSETTLED');
   cache.set(`batch:${plan.trialId}:${id}`,b);
   await auditCountBatch({store,pool,plan,spec,record:{batchId:id},cache});
   preserved+=b.journaled-b.start+1;
  }
  cache.clear();
 }
 assert(preserved===pool.confirmed,'COUNT_REFRESH_COUNT_CHANGED');
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'COUNT_REFRESH_SCENE_CHANGED');
 const key=`count-runtime:${plan.trialId}:${spec.activation}:${commit}`;
 assert(!(await store.get('journal',key)),'COUNT_REFRESH_ALREADY_APPLIED');
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,previousCommit:revision.fromCommit,
  specHash:hash(spec),profileHash:hash(profile),planHash:hash(plan),activation:spec.activation,
  revisionHash:hash(revision),sourceRun:revision.sourceRun,run,poolHash:hash(pool),campaignHash:hash(campaign),
  completePreserved:preserved,remainingComplete:plan.target-preserved,sourceRequests:0,newBetAllowance:0};
 await store.create('journal',key,receipt,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(receipt),'COUNT_REFRESH_READBACK');
 return receipt;
}
