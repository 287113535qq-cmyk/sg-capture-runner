import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {loadCountPermission,auditCountBatch,checkLedger} from './complete-count.mjs';
import {sessionLayout} from './session-layout.mjs';

// A natural, healthy run boundary only. No cancellation, request replay, quota
// reset or mutation of old batches/receipts is part of changing session layout.
export async function activateSessionLayout({store,plans,profile,parent,ended,jobs,commit,run,boundary,now=Date.now}){
 const stamp=now(),oldPlan=applyFormalCount(plans,parent)[profile.gameId],plan=applyFormalCount(plans,profile)[profile.gameId];
 assert(profile.parentProfileHash===hash(parent)&&profile.parentActivation===parent.activation
  &&profile.previousLanesPerHost===(sessionLayout(oldPlan)?.lanesPerHost??1)
  &&Number.isSafeInteger(profile.createdAt)&&Number.isSafeInteger(profile.expiresAt)
  &&profile.createdAt<=stamp&&stamp<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'SESSION_ACTIVATION_SCOPE');
 assert(`${ended.id}:${ended.run_attempt}`===profile.sourceRun&&ended.status==='completed'
  &&ended.conclusion==='success'&&ended.head_sha===profile.sourceCommit
  &&ended.repository.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml','SESSION_SOURCE_BOUNDARY');
 assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100
  &&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
  &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1),
 'SESSION_SOURCE_JOBS');
 if(profile.previousLanesPerHost===2){
  const comparison=(await store.get('journal',`session-comparison:${plan.trialId}:${profile.comparisonHash}`))?.value;
  assert(comparison?.schema==='sg-session-comparison-v1'&&hash(comparison)===profile.comparisonHash
   &&comparison.trialId===plan.trialId&&comparison.profileHash===hash(parent)
   &&comparison.activation===parent.activation&&comparison.run===profile.sourceRun
   &&comparison.commit===profile.sourceCommit&&comparison.fullReadback===true,'SESSION_COMPARISON_EVIDENCE');
  const a=comparison.baseline,b=comparison.candidate;
  assert(a?.lanesPerHost===1&&b?.lanesPerHost===2&&a.durationMs===b.durationMs
   &&Number.isSafeInteger(a.durationMs)&&a.durationMs>=60000
   &&[a,b].every(w=>Number.isSafeInteger(w.complete)&&w.complete>0&&w.errors===0&&w.unknown===0
    &&w.resourceHolds===0&&/^[a-f0-9]{64}$/.test(w.recordsHash??'')
    &&Number.isFinite(w.requestP95Ms)&&w.requestP95Ms>0)
   &&b.complete>a.complete&&b.requestP95Ms<=a.requestP95Ms,'SESSION_COMPARISON_NOT_IMPROVED');
 }
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 assert(!(await store.get('journal',key))&&!(await store.get('journal',key+':before')),'SESSION_ACTIVATION_ALREADY_STARTED');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===profile.poolHash&&hash(campaign)===profile.campaignHash,'SESSION_SCENE_CHANGED');
 const oldSpec=await loadCountPermission({store,plan:oldPlan,pool,commit:profile.sourceCommit});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${profile.sourceRun}`))?.value;
 assert(hash(oldSpec)===profile.sourceSpecHash&&oldSpec.profileHash===hash(parent)
  &&permit?.schema==='sg-count-run-v1'&&permit.activation===oldSpec.activation&&permit.commit===profile.sourceCommit
  &&permit.profileHash===hash(parent)&&permit.run===profile.sourceRun&&hash(permit)===profile.sourcePermitHash,
 'SESSION_PARENT_PERMISSION');
 assert(pool.enabled&&!pool.failure&&pool.confirmed===profile.completePreserved&&pool.confirmed>=permit.completeBefore
  &&checkLedger(pool,oldPlan,oldSpec).reserved===0
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=stamp)
  &&campaign.enabled&&campaign.activeGame===plan.gameId&&!campaign.audit&&!campaign.protocolValidation&&!campaign.validationLimit
  &&campaign.formalCount?.activation===oldSpec.activation,'SESSION_NOT_IDLE');
 const baseline=[];let preserved=0;
 for(let start=1;start<pool.nextBatchId;start+=100){
  const ids=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>start+i);
  const rows=await store.getMany('state',ids.map(id=>`batch:${plan.trialId}:${id}`));
  assert(rows.length===ids.length&&rows.every(Boolean),'SESSION_BATCH_MISSING');
  const cache=new Map(),keys=ids.filter(id=>id>oldSpec.baselineBatchCount).map(id=>pool.countAllocation.batches[id].settlementKey);
  assert(keys.every(k=>typeof k==='string'),'SESSION_SETTLEMENT_MISSING');
  if(keys.length){const proofs=await store.getMany('journal',keys);assert(proofs.length===keys.length&&proofs.every(Boolean),'SESSION_PROOF_MISSING');
   proofs.forEach((r,i)=>cache.set('journal/'+keys[i],r.value));}
  for(const [i,row]of rows.entries()){
   const b=row.value,id=ids[i],count=b.journaled-b.start+1;
   assert(b.id===id&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&(profile.schema==='sg-session-layout-rhino-v1'&&b.id<=oldSpec.baselineBatchCount||!b.failure)
    &&b.leaseUntil<=stamp&&b.checkpoint===b.journaled&&pool.countAllocation.batches[id].closed,'SESSION_BATCH_NOT_CLOSED');
   cache.set(`batch:${plan.trialId}:${id}`,b);
   await auditCountBatch({store,pool,plan:oldPlan,spec:oldSpec,record:{batchId:id},cache});
   preserved+=count;baseline.push({id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:count,evidenceHash:hash(b)});
  }
 }
 assert(preserved===profile.completePreserved,'SESSION_COUNT_CHANGED');
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),trialId:plan.trialId,
  gameId:plan.gameId,target:plan.target,maxSequence:600000,baselineBatchCount:baseline.length,baselineHash:hash(baseline),
  firstSequence:pool.nextSequence,sessionRotation:'closed-batches-v1',runAdmission:'unique-github-run-v1',
  profileHash:hash(profile),parentActivation:oldSpec.activation,parentSpecHash:hash(oldSpec),sessionLayout:profile.sessionLayout};
 const nextPool={...pool,planHash:hash(plan),workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
 checkLedger(nextPool,plan,spec);
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===profile.poolHash
  &&hash((await store.get('state','campaign'))?.value)===profile.campaignHash,'SESSION_SCENE_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'SESSION_READBACK');};
 await save(key+':before',{schema:'sg-session-layout-before-v1',pool,campaign,profileHash:hash(profile),commit,run});
 await save(key,spec);
 await store.update('state','pool:'+plan.trialId,v=>{assert(hash(v)===profile.poolHash,'SESSION_POOL_CAS');return nextPool;});
 await store.update('state','campaign',v=>{assert(hash(v)===profile.campaignHash,'SESSION_CAMPAIGN_CAS');
  return {...v,formalCount:{activation:profile.activation,trialId:plan.trialId,profileHash:hash(profile)}};});
 const result={schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit,run,
  completePreserved:preserved,remainingComplete:plan.target-preserved,sourceRequests:0,newBetAllowance:0,
  profileHash:hash(profile),parentActivation:oldSpec.activation};
 await save(key+':complete',result);return result;
}
