import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {readPoolBatches} from './formal-source-review.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';
import {nextRequest} from '../trial/squid-protocol.mjs';
import {pyramidsFreeSequence} from '../trial/pyramids-free-review.mjs';
import {reviewFifteenSequence} from '../trial/pyramids-fifteen-review.mjs';

// Reviewed, ended shared stop only. No SG transport or new count permission.
// Close the faulty game first; the peer hold continues to protect both groups.
export async function closeCountShared({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run,now=Date.now}){
 const group=profile?.group,root=group==='secondary';
 const counter=profile?.schema==='sg-count-counter-close-profile-v1';
 if(counter)assert(root&&plan.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'
  &&plan.target===299850&&profile.sourceRun==='36937673870:1'
  &&profile.sourceCommit==='a66e2c7ac642c87ecedbbe9ddde5194bcae4de36'
  &&profile.sourceProfileHash==='f32e340466c2c02d725b93e87a92a493f013157275f6ea7ff699d47712ee8892'
  &&profile.completePreserved===5024&&profile.abandonedAttempts===1,'COUNTER_CLOSE_FIXED_SCOPE');
 assert(['primary','secondary'].includes(group)&&(counter||profile.schema==='sg-count-shared-close-profile-v1')
  &&profile.gameId===plan.gameId&&profile.trialId===plan.trialId&&profile.planHash===hash(plan)
  &&profile.sourceAllowance===0&&profile.createdAt<=now()&&now()<profile.expiresAt
  &&profile.expiresAt-profile.createdAt<=7200000&&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'SHARED_CLOSE_PROFILE');
 assert(ended.repository.full_name===(root?'287113535qq-cmyk/sg-capture-runner':'zyzuoyang/sg-capture-runner')
  &&ended.status==='completed'&&ended.conclusion==='failure'&&ended.path==='.github/workflows/trial-300k.yml'
  &&`${ended.id}:${ended.run_attempt}`===profile.sourceRun&&ended.head_sha===profile.sourceCommit,'SHARED_CLOSE_SOURCE');
 assert(hash(jobs)===profile.jobsHash&&jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100
  &&jobs.jobs.every(j=>j.status==='completed')&&Array.from({length:20},(_,i)=>'capture-'+i)
   .every(name=>jobs.jobs.filter(j=>j.name===name).length===1)
  &&jobs.jobs.some(j=>j.name===(root?'pyramids-formal-admit':'formal-admit')&&j.conclusion==='success'),'SHARED_CLOSE_JOBS');
 await boundary();
 const poolKey='pool:'+plan.trialId,campaign=(await store.get('state','campaign'))?.value,
  pool=(await store.get('state',poolKey))?.value,hold=(await store.get('state','global-hold'))?.value;
 assert(hash(campaign)===profile.campaignHash&&campaign.enabled&&campaign.activeGame===plan.gameId
  &&!campaign.protocolValidation&&!campaign.validationLimit&&!campaign.audit&&campaign.formalCount?.activation===plan.countAllocation
  &&(counter?pool&&!pool.enabled&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.drainingProtocol===true:pool?.enabled&&!pool.failure)
  &&hash(pool)===profile.poolHash,'SHARED_CLOSE_SCENE');
 assert(hash(hold)===profile.holdHash&&hold.active&&hold.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
  &&hold.details?.code===(counter?'PYRAMIDS_FREE_COUNTERS':root?'PYRAMIDS_FREE_COIN':'GLOBAL_SOURCE_STOPPED')
  &&(!counter||hold.details.category==='source_protocol'&&hold.details.cooldownUntil===0),'SHARED_CLOSE_HOLD');
 const spec=await loadCountPermission({store,plan,pool,commit:profile.sourceCommit}),batches=await readPoolBatches(store,plan,pool);
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${profile.sourceRun}`))?.value;
 assert(!counter||spec.profileHash===profile.sourceProfileHash,'COUNTER_CLOSE_SOURCE_PROFILE');
 assert(permit?.schema==='sg-count-run-v1'&&permit.commit===profile.sourceCommit&&permit.run===profile.sourceRun
  &&permit.activation===spec.activation&&permit.profileHash===spec.profileHash&&hash(permit)===profile.permitHash,'SHARED_CLOSE_PERMISSION');
 assert(hash(batches)===profile.batchesHash&&Object.values(pool.workers).every(w=>w.leaseUntil<=now())
  &&batches.every(b=>b.leaseUntil<=now()&&!b.pendingOriginal&&!b.bootstrapAwaiting&&!b.pending?.awaiting),'SHARED_CLOSE_BATCHES');
 const complete=batches.reduce((n,b)=>n+b.journaled-b.start+1,0),abandoned=batches.filter(b=>b.pending).length;
 assert(complete===profile.completePreserved&&abandoned===profile.abandonedAttempts
  &&complete>=pool.confirmed&&complete<=plan.target,'SHARED_CLOSE_COUNTS');
 if(root){
  const fault=batches.find(b=>b.id===hold.details.batchId);
  assert(hold.details.trialId===plan.trialId&&fault?.pending&&hash(fault.pending)===profile.faultPendingHash,'SHARED_CLOSE_FAULT');
  if(counter){
   assert(fault.pending.raw.steps.length===1&&fault.pending.raw.steps[0].msgId==='BET','COUNTER_CLOSE_PREFIX');
   assert.throws(()=>pyramidsFreeSequence(fault.pending.raw),/^Error: PYRAMIDS_FREE_COUNTERS$/,'COUNTER_CLOSE_OLD_SCOPE');
   const reviewed=reviewFifteenSequence(fault.pending.raw);
   assert(reviewed.complete===false&&reviewed.next==='FREE_GAME','COUNTER_CLOSE_DIAGNOSIS');
  }else assert.throws(()=>nextRequest(fault.pending.raw),/^Error: PYRAMIDS_FREE_UNREVIEWED_COIN$/,'SHARED_CLOSE_NOT_ADAPTER');
 }else assert(batches.every(b=>pool.countAllocation.batches[b.id]?.closed||!b.failure||b.failure==='GLOBAL_SOURCE_STOPPED'),'SHARED_CLOSE_PEER_FAILURE');
 const key=`count-shared-close:${plan.trialId}:${profile.sourceRun}`;
 assert(!await store.get('journal',key+':before'),'SHARED_CLOSE_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'SHARED_CLOSE_READBACK');};
 await save(key+':before',{schema:'sg-count-shared-before-v1',profileHash:hash(profile),pool,campaign,hold,batchesHash:hash(batches),commit,run,at:now(),sourceRequests:0});
 const guarded=async()=>{await boundary();assert(hash((await store.get('state','campaign'))?.value)===profile.campaignHash
  &&hash((await store.get('state','global-hold'))?.value)===profile.holdHash,'SHARED_CLOSE_SCENE_CHANGED');};
 await guarded();await store.update('state',poolKey,v=>{assert(hash(v)===profile.poolHash,'SHARED_CLOSE_POOL_CHANGED');return {...v,enabled:false};});
 const frozen=(await store.get('state',poolKey)).value;
 const retired=await retireDemoPool({store,transport,gate,parser,plan,boundary:guarded,owner:run,
  expectedPoolHash:hash(frozen),commit:profile.sourceCommit,group,closedBatchDecorations:profile.closedBatchDecorations??[],now});
 assert(retired.completePreserved===complete&&retired.abandonedAttempts===abandoned&&retired.sourceRequests===0
  &&retired.newBetAllowance===0,'SHARED_CLOSE_RETIREMENT');
 const after=(await store.get('state',poolKey)).value;
 assert(after.confirmed===complete&&checkLedger(after,plan,spec).reserved===0
  &&Object.values(after.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'SHARED_CLOSE_UNSETTLED');
 const repairKey=root?`game-repair:${plan.trialId}:${hash(after)}`:null;
 const result={schema:'sg-count-shared-close-v1',profileHash:hash(profile),sourceRun:profile.sourceRun,sourceCommit:profile.sourceCommit,
  trialId:plan.trialId,activation:spec.activation,completePreserved:complete,abandonedAttempts:abandoned,unknownAttempts:0,
  retirement:after.retiredCount,retirementHash:hash(retired),recordsHash:retired.recordsHash,repairKey,
  sourceRequests:0,newBetAllowance:0,requiresNewSession:true,group,commit,run,at:now()};
 await save(key+':settled',result);await guarded();
 if(root){
  await store.create('state',repairKey,{schema:'sg-game-repair-v1',gameId:plan.gameId,trialId:plan.trialId,status:'pending-adapter',
   archiveKey:key+':before',evidence:[{key:after.retiredCount+':complete',hash:hash(retired)}],sourceAllowance:0,requiresNewSession:true});
  await store.update('state',poolKey,v=>{assert(hash(v)===hash(after),'SHARED_CLOSE_POOL_CHANGED');return {...v,failure:'PROTOCOL_VALIDATION_FAILED',countSharedClosure:key};});
  await store.update('state','campaign',v=>{assert(hash(v)===profile.campaignHash,'SHARED_CLOSE_CAMPAIGN_CHANGED');
   const entry=v.games.find(g=>g.game_id===plan.gameId);assert(entry,'SHARED_CLOSE_GAME');entry.status='parked-protocol';entry.repairKey=repairKey;v.activeGame=null;return v;});
 }else await store.update('state',poolKey,v=>{assert(hash(v)===hash(after),'SHARED_CLOSE_POOL_CHANGED');return {...v,enabled:true,countSharedClosure:key};});
 await save(key+':complete',result);
 // Boundary rechecks both groups; secondary releases only while the peer hold
 // remains active. Primary releases only after the faulty pool was retired.
 await boundary();const current=await store.get('state','global-hold');
 assert(hash(current.value)===profile.holdHash,'SHARED_CLOSE_HOLD_CHANGED');
 const released={...current.value,active:false,reason:null,countSharedClosure:key};
 assert(await store.cas('state','global-hold',current,released),'SHARED_CLOSE_HOLD_CAS');
 assert(hash((await store.get('state','global-hold'))?.value)===hash(released),'SHARED_CLOSE_HOLD_READBACK');
 return result;
}
