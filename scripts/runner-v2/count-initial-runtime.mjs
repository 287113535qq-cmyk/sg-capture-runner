import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger,auditCountBatch} from './complete-count.mjs';

// A bounded observation run consumes the existing count allocation. It adds
// no quota and can only be prepared before its first source allocation.
export async function authorizeInitialCountRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary,now=Date.now}){
 assert(revision.schema==='sg-count-initial-runtime-v1'&&plan.gameId===32799&&plan.adapter==='rhino-wms-v1'
  &&plan.trialId==='sg_r1_20261001_32799'&&plan.target===300000&&plan.buy===0&&plan.phase===1
  &&profile.schema==='sg-formal-count-rhino-v2'&&revision.profileHash===hash(profile)
  &&revision.activation===profile.activation&&revision.planHash===hash(plan)
  &&revision.completePreserved===151&&revision.remainingComplete===299849
  &&revision.captureMinutes===20&&revision.newBetAllowance===0
  &&revision.createdAt<=now()&&now()<revision.expiresAt&&revision.expiresAt-revision.createdAt<=7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&commit!==revision.fromCommit&&/^\d+:1$/.test(run),'COUNT_INITIAL_SCOPE');
 assert(ended.status==='completed'&&ended.conclusion==='success'&&ended.run_attempt===1
  &&`${ended.id}:1`===revision.sourceRun&&ended.head_sha===revision.fromCommit
  &&ended.repository.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/demo-maintenance.yml','COUNT_INITIAL_ACTIVATION_RUN');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length>0&&jobs.jobs.length<100&&jobs.jobs.some(j=>j.conclusion==='success')
  &&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion)),'COUNT_INITIAL_JOBS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===revision.poolHash&&hash(campaign)===revision.campaignHash,'COUNT_INITIAL_SCENE');
 const spec=await loadCountPermission({store,plan,pool,commit:revision.fromCommit});
 const done=(await store.get('journal',`complete-count:${plan.trialId}:${spec.activation}:complete`))?.value;
 assert(spec.profileHash===hash(profile)&&done.run===revision.sourceRun&&done.commit===revision.fromCommit
  &&pool.enabled&&!pool.failure&&pool.confirmed===151&&checkLedger(pool,plan,spec).reserved===0
  &&Object.keys(pool.workers).length===0&&spec.baselineBatchCount===36&&pool.nextBatchId===37
  &&pool.nextSequence===spec.firstSequence&&campaign.enabled&&campaign.activeGame===32799
  &&!campaign.audit&&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===spec.activation,'COUNT_INITIAL_SOURCE_ALREADY_STARTED');
 const ids=Array.from({length:36},(_,i)=>i+1),rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
 assert(rows.length===36&&rows.every(Boolean),'COUNT_INITIAL_BATCH_MISSING');
 let preserved=0;
 for(const [i,row]of rows.entries()){
  const b=row.value;assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now()
   &&b.checkpoint===b.journaled,'COUNT_INITIAL_UNFINISHED');
  await auditCountBatch({store,pool,plan,spec,record:{batchId:ids[i]},cache:new Map([[`batch:${plan.trialId}:${ids[i]}`,b]])});
  preserved+=b.journaled-b.start+1;
 }
 assert(preserved===151,'COUNT_INITIAL_COUNT_CHANGED');await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===revision.poolHash
  &&hash((await store.get('state','campaign'))?.value)===revision.campaignHash,'COUNT_INITIAL_SCENE');
 const key=`count-runtime:${plan.trialId}:${spec.activation}:${commit}`;assert(!(await store.get('journal',key)),'COUNT_INITIAL_ALREADY_APPLIED');
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,previousCommit:revision.fromCommit,
  specHash:hash(spec),profileHash:hash(profile),planHash:hash(plan),activation:spec.activation,
  revisionHash:hash(revision),sourceRun:revision.sourceRun,run,poolHash:hash(pool),campaignHash:hash(campaign),
  completePreserved:151,remainingComplete:299849,sourceRequests:0,newBetAllowance:0,captureMinutes:20};
 await store.create('journal',key,receipt,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(receipt),'COUNT_INITIAL_READBACK');return receipt;
}

export function countMeasurementMinutes(revision,receipt){
 assert(revision.schema==='sg-count-initial-runtime-v1'&&revision.captureMinutes===20
  &&receipt?.schema==='sg-count-runtime-v2'&&receipt.revisionHash===hash(revision)
  &&receipt.captureMinutes===20&&receipt.newBetAllowance===0&&receipt.sourceRequests===0,'COUNT_MEASUREMENT_PERMISSION');
 return 20;
}
