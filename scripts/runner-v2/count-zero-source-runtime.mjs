import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger,auditCountBatch} from './complete-count.mjs';

// Exact zero-registration incident. No counters, old permits, or sessions are
// changed. A separate run admission remains necessary after this runtime proof.
export async function amendZeroSourceCountRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary,now=Date.now}){
 assert(revision.schema==='sg-count-zero-source-runtime-v1'&&plan.gameId===32721
  &&plan.trialId==='sg_r1_20260928_32721'&&plan.target===299850
  &&revision.sourceRun==='36788992387:1'&&revision.fromCommit==='ef8f1a0185fb99f5e1d53cf2bcc2c72a6ad9e366'
  &&revision.profileHash===hash(profile)&&revision.activation===plan.countAllocation&&revision.planHash===hash(plan)
  &&/^[a-f0-9]{40}$/.test(commit)&&commit!==revision.fromCommit&&/^\d+:1$/.test(run)
  &&revision.createdAt<=now()&&now()<revision.expiresAt&&revision.expiresAt-revision.createdAt<=7200000,'COUNT_ZERO_RUNTIME_SCOPE');
 assert(`${ended.id}:${ended.run_attempt}`===revision.sourceRun&&ended.head_sha===revision.fromCommit
  &&ended.status==='completed'&&ended.conclusion==='cancelled'
  &&ended.repository.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml','COUNT_ZERO_RUNTIME_RUN');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100
  &&jobs.jobs.every(j=>j.status==='completed'&&['cancelled','success','skipped'].includes(j.conclusion))
  &&jobs.jobs.filter(j=>j.name==='pyramids-formal-admit'&&j.conclusion==='success').length===1
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='cancelled').length===1),'COUNT_ZERO_RUNTIME_JOBS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:revision.fromCommit});checkLedger(pool,plan,spec);
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`))?.value;
 assert(spec.commit===revision.fromCommit&&spec.profileHash===hash(profile)&&permit?.schema==='sg-count-run-v1'
  &&permit.commit===spec.commit&&permit.activation===spec.activation&&permit.profileHash===spec.profileHash
  &&permit.run===revision.sourceRun&&permit.poolHash===hash(pool)&&hash(permit)===revision.sourcePermitHash,'COUNT_ZERO_RUNTIME_PERMIT');
 assert(pool.enabled&&!pool.failure&&pool.confirmed===1658&&pool.confirmed===permit.completeBefore
  &&Object.keys(pool.workers).length===0&&pool.countAllocation.reserved===0
  &&pool.nextBatchId===spec.baselineBatchCount+1&&pool.nextSequence===spec.firstSequence
  &&hash(pool)===revision.poolHash&&hash(campaign)===revision.campaignHash
  &&campaign.group==='secondary'&&campaign.enabled&&campaign.activeGame===32721
  &&!campaign.audit&&!campaign.validationLimit&&!campaign.protocolValidation
  &&campaign.formalCount?.activation===spec.activation,'COUNT_ZERO_RUNTIME_REGISTERED');
 // Every baseline must still match its immutable full-readback evidence.
 let complete=0;const cache=new Map();
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'COUNT_ZERO_RUNTIME_BATCH_MISSING');
  for(const [i,r] of rows.entries()){
   const b=r.value;assert(b.id===ids[i]&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
    &&b.leaseUntil<=now()&&b.checkpoint===b.journaled,'COUNT_ZERO_RUNTIME_PENDING');
   cache.set(`batch:${plan.trialId}:${b.id}`,b);
   await auditCountBatch({store,plan,pool,spec,record:{batchId:b.id},cache});complete+=b.journaled-b.start+1;
  }cache.clear();
 }
 assert(complete===1658,'COUNT_ZERO_RUNTIME_COUNT');
 await boundary();assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'COUNT_ZERO_RUNTIME_CHANGED');
 const key=`count-runtime:${plan.trialId}:${spec.activation}:${commit}`;assert(!(await store.get('journal',key)),'COUNT_ZERO_RUNTIME_ALREADY_APPLIED');
 const result={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,previousCommit:revision.fromCommit,
  specHash:hash(spec),profileHash:hash(profile),planHash:hash(plan),activation:spec.activation,revisionHash:hash(revision),
  sourceRun:revision.sourceRun,run,poolHash:hash(pool),campaignHash:hash(campaign),completePreserved:complete,
  remainingComplete:plan.target-complete,sourceRequests:0,newBetAllowance:0,zeroRegistration:true};
 await store.create('journal',key,result,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(result),'COUNT_ZERO_RUNTIME_READBACK');return result;
}
