import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger} from './complete-count.mjs';
import {receiptKey} from './durable-queue.mjs';

// This revision changes runtime identity only, after a failed admission with no
// count-run permit. It cannot reopen, recreate or extend the frozen allocation.
export async function amendFormalRuntime({store,transport,plan,profile,revision,ended,jobs,commit,run,boundary,now=Date.now}){
 assert(revision.schema==='sg-formal-runtime-profile-v1'&&revision.activation===profile.activation
  &&revision.profileHash===hash(profile)&&revision.sourceRun==='36728815536:1'
  &&revision.fromCommit==='7200e7b74df1eb29e86c0b74d1940dfab2449557'
  &&revision.createdAt<=now()&&now()<revision.expiresAt&&revision.expiresAt-revision.createdAt<=7200000,'COUNT_REVISION_SCOPE');
 assert(ended.id===36728815536&&ended.run_attempt===1&&ended.status==='completed'&&ended.conclusion==='failure'
  &&ended.head_sha===revision.fromCommit&&ended.repository.full_name==='zyzuoyang/sg-capture-runner','COUNT_REVISION_RUN');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100
  &&jobs.jobs.some(j=>j.name==='formal-admit'&&j.conclusion==='failure')
  &&jobs.jobs.every(j=>j.status==='completed'&&(j.name==='formal-admit'||j.name==='verify'||j.conclusion==='skipped')),'COUNT_REVISION_JOBS');
 await boundary();
 const key=`complete-count:${plan.trialId}:${profile.activation}`,spec=(await store.get('journal',key))?.value;
 const complete=(await store.get('journal',key+':complete'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(spec?.commit===revision.fromCommit&&spec.profileHash===hash(profile)&&complete?.specHash===hash(spec)
  &&pool.confirmed===100&&pool.nextBatchId===21&&pool.nextSequence===2001&&pool.enabled&&!pool.failure
  &&Object.keys(pool.workers).length===0,'COUNT_REVISION_SOURCE_CHANGED');
 checkLedger(pool,plan,spec);assert(pool.countAllocation.reserved===0,'COUNT_REVISION_RESERVED');
 assert(!(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`)),'COUNT_REVISION_ADMISSION_EXISTS');
 const campaign=(await store.get('state','campaign'))?.value;
 assert(campaign.enabled&&campaign.activeGame===32795&&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===profile.activation,'COUNT_REVISION_CAMPAIGN');
 const records=[];
 for(const b of Object.values(pool.countAllocation.batches)){
  const actual=(await store.get('state',`batch:${plan.trialId}:${b.id}`))?.value;
  assert(b.closed&&b.complete===5&&hash(actual)===b.evidenceHash,'COUNT_REVISION_BASELINE_CHANGED');
  const rs=(await store.getMany('journal',Array.from({length:5},(_,i)=>receiptKey(plan.trialId,b.start+i)))).map(r=>r.value);
  const mongo=await transport.request('rounds_read',{trialId:plan.trialId,ids:rs.map(r=>r._id)});
  assert(hash(mongo.map(hash).sort())===hash(rs.map(hash).sort()),'COUNT_REVISION_MONGO_CHANGED');records.push(...rs);
 }
 assert(records.length===100&&hash(records)===profile.recordsHash,'COUNT_REVISION_RECORDS_CHANGED');
 await boundary();assert(hash((await store.get('state','pool:'+plan.trialId)).value)===hash(pool),'COUNT_REVISION_POOL_CHANGED');
 assert(hash((await store.get('state','campaign')).value)===hash(campaign),'COUNT_REVISION_CAMPAIGN_CHANGED');
 const rkey=`count-runtime:${plan.trialId}:${profile.activation}:${commit}`;
 assert(!(await store.get('journal',rkey)),'COUNT_REVISION_ALREADY_APPLIED');
 const result={schema:'sg-count-runtime-v1',commit,fromCommit:spec.commit,specHash:hash(spec),profileHash:hash(profile),
  revisionHash:hash(revision),activation:profile.activation,run,sourceRun:revision.sourceRun,
  completePreserved:100,remainingComplete:299900,sourceRequests:0};
 await store.create('journal',rkey,result,{immutable:true});
 assert(hash((await store.get('journal',rkey))?.value)===hash(result),'COUNT_REVISION_READBACK');return result;
}
