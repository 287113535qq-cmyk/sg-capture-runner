import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {readPoolBatches} from './formal-source-review.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';

// Close a finished run's unknown request and interrupted sessions without source
// replay. Retain the existing count authorization; issue no new run permission.
export async function closeCountNetwork({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run,now=Date.now}){
 assert(profile?.schema==='sg-count-network-close-profile-v1'&&profile.planHash===hash(plan)
  &&profile.trialId===plan.trialId&&profile.gameId===plan.gameId&&profile.sourceAllowance===0
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000
  &&/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??''),'COUNT_NETWORK_PROFILE');
 assert(ended?.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.status==='completed'
  &&ended.conclusion==='failure'&&ended.head_sha===profile.sourceCommit&&`${ended.id}:${ended.run_attempt}`===profile.sourceRun
  &&ended.path==='.github/workflows/trial-300k.yml','COUNT_NETWORK_RUN');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.jobs.every(j=>j.status==='completed')
  &&jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name)).length===20
  &&Array.from({length:20},(_,i)=>`capture-${i}`).every(n=>jobs.jobs.some(j=>j.name===n))
  &&['formal-admit','verify'].every(n=>jobs.jobs.some(j=>j.name===n&&j.conclusion==='success'))
  &&hash(jobs)===profile.jobsHash,'COUNT_NETWORK_JOBS');
 await boundary();const poolKey='pool:'+plan.trialId,campaign=(await store.get('state','campaign'))?.value,
  pool=(await store.get('state',poolKey))?.value,hold=(await store.get('state','global-hold'))?.value;
 assert(hash(campaign)===profile.campaignHash&&campaign.enabled&&campaign.activeGame===plan.gameId
  &&!campaign.protocolValidation&&!campaign.validationLimit&&!campaign.audit&&campaign.formalCount?.activation===plan.countAllocation
  &&pool?.enabled&&!pool.failure&&hash(pool)===profile.poolHash,'COUNT_NETWORK_SCENE');
 assert(hash(hold)===profile.holdHash&&hold.active&&hold.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
  &&hold.details?.trialId===plan.trialId&&hold.details.batchId===profile.batchId
  &&hold.details.code==='SOURCE_NETWORK_OUTCOME_UNKNOWN'&&hold.details.category==='source_network'
  &&hold.details.cooldownUntil===0,'COUNT_NETWORK_HOLD');
 const spec=await loadCountPermission({store,plan,pool,commit:profile.sourceCommit}),batches=await readPoolBatches(store,plan,pool);
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${profile.sourceRun}`))?.value;
 assert(permit?.schema==='sg-count-run-v1'&&permit.commit===profile.sourceCommit&&permit.run===profile.sourceRun
  &&permit.activation===spec.activation&&permit.profileHash===spec.profileHash&&hash(permit)===profile.permitHash,'COUNT_NETWORK_PERMISSION');
 assert(hash(batches)===profile.batchesHash&&Object.values(pool.workers).every(w=>w.leaseUntil<=now())
  &&batches.every(b=>b.leaseUntil<=now()&&!b.failure&&!b.pendingOriginal&&!b.bootstrapAwaiting),'COUNT_NETWORK_BATCHES');
 const bad=batches.find(b=>b.id===profile.batchId);
 assert(bad?.pending?.awaiting&&bad.pending.sequence===bad.journaled+1
  &&hash(bad.pending)===profile.pendingHash,'COUNT_NETWORK_UNKNOWN_REQUEST');
 const complete=batches.reduce((n,b)=>n+b.journaled-b.start+1,0),abandoned=batches.filter(b=>b.pending).length,
  unknown=batches.filter(b=>b.pending?.awaiting).length;
 assert(complete===profile.completePreserved&&abandoned===profile.abandonedAttempts&&unknown===profile.unknownAttempts
  &&unknown===1&&complete>=pool.confirmed&&complete<=plan.target,'COUNT_NETWORK_COUNTS');
 const key=`count-network-close:${plan.trialId}:${profile.sourceRun}`;
 assert(!await store.get('journal',key+':before'),'COUNT_NETWORK_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'COUNT_NETWORK_READBACK');};
 await save(key+':before',{schema:'sg-count-network-before-v1',profileHash:hash(profile),pool,campaign,hold,
  batchesHash:hash(batches),commit,run,at:now(),sourceRequests:0});
 const guarded=async()=>{await boundary();assert(hash((await store.get('state','campaign'))?.value)===profile.campaignHash
  &&hash((await store.get('state','global-hold'))?.value)===profile.holdHash,'COUNT_NETWORK_SCENE_CHANGED');};
 await guarded();await store.update('state',poolKey,v=>{assert(hash(v)===profile.poolHash,'COUNT_NETWORK_POOL_CHANGED');return {...v,enabled:false};});
 const frozen=(await store.get('state',poolKey)).value;
 const retired=await retireDemoPool({store,transport,gate,parser,plan,boundary:guarded,owner:run,
  expectedPoolHash:hash(frozen),commit:profile.sourceCommit,now});
 assert(retired.completePreserved===complete&&retired.abandonedAttempts===abandoned&&retired.sourceRequests===0
  &&retired.newBetAllowance===0&&(!profile.recordsHash||retired.recordsHash===profile.recordsHash),'COUNT_NETWORK_RETIREMENT');
 const after=(await store.get('state',poolKey)).value;
 assert(after.confirmed===complete&&checkLedger(after,plan,spec).reserved===0
  &&Object.values(after.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'COUNT_NETWORK_UNSETTLED');
 const result={schema:'sg-count-network-close-v1',profileHash:hash(profile),sourceRun:profile.sourceRun,
  sourceCommit:profile.sourceCommit,trialId:plan.trialId,activation:spec.activation,completePreserved:complete,
  abandonedAttempts:abandoned,unknownAttempts:unknown,retirement:after.retiredCount,retirementHash:hash(retired),
  sourceRequests:0,newBetAllowance:0,requiresNewSession:true,commit,run,at:now()};
 await save(key+':settled',result);await guarded();
 await store.update('state',poolKey,v=>{assert(hash(v)===hash(after),'COUNT_NETWORK_POOL_CHANGED');return {...v,enabled:true,countNetworkClosure:key};});
 await save(key+':complete',result);
 // Release only this exact hold, after full readback, immutable retirement and
 // unchanged activation. Any concurrent/new fault or partial stage stays held.
 await guarded();const current=await store.get('state','global-hold');
 const released={...current.value,active:false,reason:null,countNetworkClosure:key};
 assert(await store.cas('state','global-hold',current,released),'COUNT_NETWORK_HOLD_CAS');
 assert(hash((await store.get('state','global-hold'))?.value)===hash(released),'COUNT_NETWORK_HOLD_READBACK');
 return result;
}
