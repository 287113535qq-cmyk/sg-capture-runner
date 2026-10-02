import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger,auditCountBatch} from './complete-count.mjs';
import {checkActionCanaryRevision,checkActionCanaryBinding} from './action-canary-contract.mjs';

// The parent is the successful zero-source activation, not a failed capture.
// Updating executable authorization does not retire, reactivate or reset it.
export async function amendActionCanaryRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary,now=Date.now}){
 checkActionCanaryRevision({plan,profile,revision});
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&commit!==revision.fromCommit&&/^[0-9]+:1$/.test(run??'')
  &&Number.isSafeInteger(revision.createdAt)&&Number.isSafeInteger(revision.expiresAt)
  &&revision.createdAt<=now()&&now()<revision.expiresAt
  &&revision.expiresAt>revision.createdAt&&revision.expiresAt-revision.createdAt<=7200000,'ACTION_RUNTIME_WINDOW');
 assert(`${ended?.id}:${ended?.run_attempt}`===revision.sourceRun&&ended.head_sha===revision.fromCommit
  &&ended.status==='completed'&&ended.conclusion==='success'
  &&ended.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.path==='.github/workflows/demo-maintenance.yml','ACTION_RUNTIME_PARENT');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.jobs.length>0&&jobs.jobs.length<100
  &&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&jobs.jobs.filter(j=>j.conclusion==='success').length===1,'ACTION_RUNTIME_PARENT_JOBS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:revision.fromCommit});
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const complete=(await store.get('journal',key+':complete'))?.value;
 const ledger=checkLedger(pool,plan,spec);
 assert(hash(pool)===revision.poolHash&&hash(campaign)===revision.campaignHash
  &&pool.enabled&&!pool.failure&&pool.confirmed===16913&&ledger.reserved===0
  &&Object.keys(pool.workers).length===0&&spec.baselineBatchCount===321
  &&pool.nextBatchId===322&&pool.nextSequence===31279
  &&campaign.enabled&&campaign.activeGame===32721&&!campaign.audit
  &&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===profile.activation,'ACTION_RUNTIME_NOT_IDLE');
 assert(!(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`)),
  'ACTION_RUNTIME_PARENT_HAS_SOURCE_PERMISSION');
 let preserved=0;const cache=new Map();
 for(let first=1;first<pool.nextBatchId;first+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>first+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'ACTION_RUNTIME_BATCH_MISSING');
  for(const [i,row]of rows.entries()){
   const b=row.value;
   assert(b.id===ids[i]&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
    &&b.leaseUntil<=now()&&b.checkpoint===b.journaled,'ACTION_RUNTIME_BATCH_UNSETTLED');
   cache.set(`batch:${plan.trialId}:${b.id}`,b);
   await auditCountBatch({store,plan,pool,spec,record:{batchId:b.id},cache});
   preserved+=b.journaled-b.start+1;
  }cache.clear();
 }
 assert(preserved===16913,'ACTION_RUNTIME_PRESERVED_COUNT');
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'ACTION_RUNTIME_SCENE_CHANGED');
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,specHash:hash(spec),
  profileHash:hash(profile),planHash:hash(plan),activation:profile.activation,revisionHash:hash(revision),
  completePreserved:preserved,remainingComplete:plan.target-preserved,sourceRun:revision.sourceRun,
  sourceRequests:0,newBetAllowance:0,run,poolHash:hash(pool),campaignHash:hash(campaign),zeroRegistration:true};
 checkActionCanaryBinding({plan,profile,revision,receipt,spec,complete,commit});
 const receiptKey=`count-runtime:${plan.trialId}:${profile.activation}:${commit}`;
 assert(!(await store.get('journal',receiptKey)),'ACTION_RUNTIME_ALREADY_APPLIED');
 await store.create('journal',receiptKey,receipt,{immutable:true});
 assert(hash((await store.get('journal',receiptKey))?.value)===hash(receipt),'ACTION_RUNTIME_READBACK');
 return receipt;
}

export async function admitActionCanary({store,plan,profile,revision,commit,run,boundary,now=Date.now}){
 checkActionCanaryRevision({plan,profile,revision});
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit});
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 const complete=(await store.get('journal',key+':complete'))?.value;
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${profile.activation}:${commit}`))?.value;
 checkActionCanaryBinding({plan,profile,revision,receipt,spec,complete,commit});
 assert(/^[0-9]+:1$/.test(run??'')&&now()<revision.expiresAt
  &&pool.enabled&&!pool.failure&&pool.confirmed===16913&&checkLedger(pool,plan,spec).reserved===0
  &&Object.keys(pool.workers).length===0&&campaign.enabled&&campaign.activeGame===32721
  &&!campaign.audit&&!campaign.protocolValidation&&!campaign.validationLimit,'ACTION_CANARY_NOT_READY');
 // One source run per revision, including ambiguous dispatches and restarts.
 const claimKey=`action-canary-run:${plan.trialId}:${hash(revision)}`;
 const claim={schema:'sg-action-canary-run-v1',run,commit,revisionHash:hash(revision),sourceRequests:0};
 await store.writable();
 assert((await store.transport.request('create',{collection:'journal',key:claimKey,value:claim})).created===true,
  'ACTION_CANARY_RUN_ALREADY_CLAIMED');
 assert(hash((await store.get('journal',claimKey))?.value)===hash(claim),'ACTION_CANARY_RUN_CLAIM_READBACK');
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign),'ACTION_CANARY_SCENE_CHANGED');
 const createdAt=now(),permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),
  commit,run,poolHash:hash(pool),completeBefore:16913,remainingComplete:282937,
  runtimeRevisionHash:hash(revision),createdAt,expiresAt:createdAt+300000};
 const permitKey=`count-run:${plan.trialId}:${run}`;
 assert(!(await store.get('journal',permitKey)),'ACTION_CANARY_RUN_ALREADY_ADMITTED');
 await store.create('journal',permitKey,permit,{immutable:true});
 assert(hash((await store.get('journal',permitKey))?.value)===hash(permit),'ACTION_CANARY_PERMIT_READBACK');
 return permit;
}
