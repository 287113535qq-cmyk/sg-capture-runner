import {createHash} from 'node:crypto';
import {reviewPyramidsMajorRetirement} from './pyramids-major-retirement.mjs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {receiptKey} from './durable-queue.mjs';

// A new immutable authorization inherits every closed range and completed
// record. It cannot reset the target, reclaim discarded ranges or reuse sessions.
export async function activateFormalRepair({store,transport,parser,plans,profile,oldProfile,boundary,commit,run,now=Date.now}){
 const major=profile?.schema==='sg-formal-repair-pyramids-v3';
 const v2=profile?.schema==='sg-formal-repair-pyramids-v2',pyramids=major||v2||profile?.schema==='sg-formal-repair-pyramids-v1',gameId=pyramids?32721:32795;
 const stamp=now(),plan=applyFormalCount(plans,profile)[gameId],oldPlan=applyFormalCount(plans,oldProfile)[gameId];
 const continuation=v2&&profile.sourceRun==='36842835455:1';
 const awards=profile.schema==='sg-formal-repair-profile-v2',preserved=major?3211:continuation?2590:v2?2127:pyramids?1658:awards?2596:961,remaining=plan.target-preserved;
 assert(oldProfile.schema===(major||continuation?'sg-formal-repair-pyramids-v2':v2?'sg-formal-repair-pyramids-v1':pyramids?'sg-formal-count-pyramids-v1':awards?'sg-formal-repair-profile-v1':'sg-formal-count-profile-v1'),'FORMAL_REPAIR_PARENT_SCOPE');
 assert(['sg-formal-repair-pyramids-v3','sg-formal-repair-pyramids-v2','sg-formal-repair-pyramids-v1','sg-formal-repair-profile-v1','sg-formal-repair-profile-v2'].includes(profile.schema)&&profile.oldProfileHash===hash(oldProfile)
  &&profile.createdAt<=stamp&&stamp<profile.expiresAt&&profile.expiresAt-profile.createdAt<=7200000
  &&/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??'')&&profile.activation!==oldProfile.activation,'FORMAL_REPAIR_SCOPE');
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 assert(!(await store.get('journal',key))&&!(await store.get('journal',key+':before')),'FORMAL_REPAIR_ALREADY_STARTED');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const repair=(await store.get('state',profile.repairKey))?.value,retired=(await store.get('journal',profile.retirementKey))?.value;
 assert(pool&&campaign&&hash(pool)===profile.poolHash&&hash(campaign)===profile.campaignHash
  &&!pool.enabled&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.confirmed===preserved&&campaign.activeGame===null,'FORMAL_REPAIR_SCENE');
 assert(!pyramids||campaign.group==='secondary','FORMAL_REPAIR_GROUP');
 const entry=campaign.games.find(g=>g.game_id===gameId);
 assert(entry?.status==='parked-protocol'&&entry.repairKey===profile.repairKey&&repair
  &&hash(repair)===profile.repairHash&&repair.sourceAllowance===0&&repair.requiresNewSession===true,'FORMAL_REPAIR_QUEUE');
 if(major)await reviewPyramidsMajorRetirement({store,profile,pool,retired,oldProfile});
 else assert(retired?.schema==='sg-formal-stopped-retire-v1'&&hash(retired)===profile.retirementHash
  &&retired.completePreserved===preserved&&retired.recordsHash===profile.recordsHash&&retired.repairKey===profile.repairKey
  &&retired.sourceRequests===0&&retired.newBetAllowance===0&&retired.sourceCommit===profile.sourceCommit,'FORMAL_REPAIR_RETIREMENT');
 const oldSpec=await loadCountPermission({store,plan:oldPlan,pool,commit:profile.sourceCommit});
 assert(hash(oldSpec)===profile.oldSpecHash&&pool.countAllocation.reserved===0
  &&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=stamp),'FORMAL_REPAIR_UNSETTLED');
 const records=[],baseline=[];
 for(let start=1;start<pool.nextBatchId;start+=100){
  const rows=await store.getMany('state',Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${plan.trialId}:${start+i}`));
  assert(rows.every(Boolean),'FORMAL_REPAIR_BATCH_MISSING');
  for(const {value:b} of rows){
   const count=b.journaled-b.start+1,old=pool.countAllocation.batches[b.id];
   // Already admitted legacy baselines retain their original marker verbatim.
   // Only their immutable old-spec hash can prove that this is historical.
   const frozenLegacy=pyramids&&b.id<=oldSpec.baselineBatchCount&&old?.closed
    &&old.evidenceHash===hash(b)&&b.failure==='LEGACY_IMPORT_REQUIRES_RETIREMENT';
   assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&(!b.failure||frozenLegacy)
    &&b.leaseUntil<=stamp&&b.checkpoint===b.journaled,'FORMAL_REPAIR_PENDING');
   assert(old?.closed&&old.complete===count&&count>=0&&count<=100,'FORMAL_REPAIR_BATCH_COUNT');
   const rs=count?(await store.getMany('journal',Array.from({length:count},(_,i)=>receiptKey(plan.trialId,b.start+i)))).map(r=>r?.value):[];
   assert(rs.every(Boolean),'FORMAL_REPAIR_RECEIPT');
   const mongo=rs.length?await transport.request('rounds_read',{trialId:plan.trialId,ids:rs.map(r=>r._id)}):[];
   assert(hash(mongo.map(hash).sort())===hash(rs.map(hash).sort()),'FORMAL_REPAIR_MONGO');
   for(const r of rs)assert((await parser.call({op:'verify',plan,raw:r.raw,record:r})).verified,'FORMAL_REPAIR_PYTHON');
   records.push(...rs);baseline.push({id:b.id,worker:b.worker,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:count,evidenceHash:hash(b)});
  }
 }
 const recordsHash=major?createHash('sha256').update(records.map(r=>hash(r)+'\n').join('')).digest('hex'):hash(records);
 assert(records.length===preserved&&recordsHash===profile.recordsHash,'FORMAL_REPAIR_RECORDS');
 const spec={schema:'sg-complete-count-v1',activation:profile.activation,commit,planHash:hash(plan),trialId:plan.trialId,gameId,
  target:plan.target,maxSequence:600000,baselineBatchCount:baseline.length,baselineHash:hash(baseline),firstSequence:pool.nextSequence,
  sessionRotation:'closed-batches-v1',runAdmission:'unique-github-run-v1',profileHash:hash(profile),parentActivation:oldSpec.activation,
  parentSpecHash:hash(oldSpec),sourceRecordsHash:profile.recordsHash,repairKey:profile.repairKey};
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===profile.poolHash
  &&hash((await store.get('state','campaign'))?.value)===profile.campaignHash
  &&hash((await store.get('state',profile.repairKey))?.value)===profile.repairHash,'FORMAL_REPAIR_SCENE_CHANGED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'FORMAL_REPAIR_READBACK');};
 await save(key+':before',{schema:'sg-formal-repair-before-v1',pool,campaign,repair,profileHash:hash(profile),commit,run});await save(key,spec);
 await store.update('state','pool:'+plan.trialId,v=>{
  assert(hash(v)===profile.poolHash,'FORMAL_REPAIR_POOL_CHANGED');
  const next={...v,enabled:true,failure:null,planHash:hash(plan),workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))}};
  delete next.drainingProtocol;delete next.demoGeneration;checkLedger(next,plan,spec);return next;
 });
 await store.update('state',profile.repairKey,v=>{assert(hash(v)===profile.repairHash,'FORMAL_REPAIR_QUEUE_CHANGED');return {...v,status:'repaired-returned',sourceAllowance:0,requiresNewSession:true,returnedActivation:profile.activation,returnedCommit:commit,returnedRun:run,returnedAt:now()};});
 await store.update('state','campaign',v=>{
  assert(hash(v)===profile.campaignHash,'FORMAL_REPAIR_CAMPAIGN_CHANGED');const e=v.games.find(g=>g.game_id===gameId);e.status='active';
  v.activeGame=gameId;v.enabled=true;v.validationLimit=0;delete v.protocolValidation;
  v.formalCount={activation:profile.activation,trialId:plan.trialId,profileHash:hash(profile)};return v;
 });
 const out={schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit,run,
  completePreserved:preserved,remainingComplete:remaining,sourceRequests:0,profileHash:hash(profile),parentActivation:oldSpec.activation};
 await save(key+':complete',out);return out;
}
