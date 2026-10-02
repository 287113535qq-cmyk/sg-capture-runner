import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {readPoolBatches} from './formal-source-review.mjs';
import {reviewParkedPilot} from './parked-pilot-proof.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';

// AG already parked this generation and saved its interrupted attempt. Reuse
// that evidence, settle its existing allocations, and leave repair independent.
export async function closeParkedCount({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run,now=Date.now}){
 const superCoin=profile?.schema==='sg-count-parked-super-coin-close-profile-v1';
 const coin=profile?.schema==='sg-count-parked-coin-close-profile-v1';
 const binding=superCoin?{sourceRun:'36961087858:1',sourceCommit:'dd058f848725f776ae7d8eb1e37b31a2000d9b20',
  profileHash:'8f387e5caf6a563cb10cab7fc62f657ed4af3eaae280844f3cf1a8297ff90f0d',complete:8391,frames:8}:
  coin?{sourceRun:'36955443358:1',sourceCommit:'3a4efb77f104cb23306b635ccfdddbd1daa5340d',
  profileHash:'9b5be7e5e018d9be4c7c09adda0dcac84bbae82c75e3d3c4d5c1fcc1b4982a34',complete:7503,frames:15}:
  {sourceRun:'36946815410:1',sourceCommit:'72b02e1a85d9bcfa92e246dd3dbedffefa38568e',
   profileHash:'140025dee8b6f121c08e3f8b71d50c326db627c556529049ba850e64d249294f',complete:5713,frames:1};
 assert((superCoin||coin||profile?.schema==='sg-count-parked-close-profile-v1')&&profile.group==='secondary'
  &&plan.gameId===32721&&plan.trialId==='sg_r1_20260928_32721'&&plan.target===299850
  &&profile.planHash===hash(plan)&&profile.sourceRun===binding.sourceRun
  &&profile.sourceCommit===binding.sourceCommit&&profile.sourceProfileHash===binding.profileHash
  &&profile.completePreserved===binding.complete&&profile.abandonedAlready===1&&profile.sourceAllowance===0
  &&Number.isSafeInteger(profile.createdAt)&&profile.createdAt<=now()&&now()<profile.expiresAt
  &&profile.expiresAt-profile.createdAt<=7200000&&/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??''),'PARKED_COUNT_CLOSE_SCOPE');
 assert(ended?.repository?.full_name==='287113535qq-cmyk/sg-capture-runner'
  &&ended.status==='completed'&&ended.conclusion==='failure'&&ended.event==='workflow_dispatch'
  &&ended.path==='.github/workflows/trial-300k.yml'&&`${ended.id}:${ended.run_attempt}`===profile.sourceRun
  &&ended.head_sha===profile.sourceCommit,'PARKED_COUNT_CLOSE_SOURCE');
 assert(hash(jobs)===profile.jobsHash&&jobs.total_count===jobs.jobs.length&&jobs.total_count<100
  &&jobs.jobs.every(j=>j.status==='completed')&&Array.from({length:20},(_,i)=>'capture-'+i)
   .every(n=>jobs.jobs.filter(j=>j.name===n).length===1)
  &&jobs.jobs.some(j=>j.name==='pyramids-formal-admit'&&j.conclusion==='success'),'PARKED_COUNT_CLOSE_JOBS');
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 assert(hash(pool)===profile.poolHash&&hash(campaign)===profile.campaignHash&&!pool.enabled
  &&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.drainingProtocol===true,'PARKED_COUNT_CLOSE_SCENE');
 const batches=await readPoolBatches(store,plan,pool);
 assert(hash(batches)===profile.batchesHash&&batches.every(b=>!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
  &&b.checkpoint===b.journaled&&b.leaseUntil<=now())&&Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'PARKED_COUNT_CLOSE_PENDING');
 const repair=await reviewParkedPilot({store,plan,scene:{campaign,pool,batches},binding:profile.parkedRepair});
 const spec=await loadCountPermission({store,plan,pool,commit:profile.sourceCommit});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${profile.sourceRun}`))?.value;
 assert(spec.profileHash===profile.sourceProfileHash&&permit?.activation===spec.activation
  &&permit.profileHash===spec.profileHash&&permit.commit===profile.sourceCommit&&hash(permit)===profile.permitHash,'PARKED_COUNT_CLOSE_PERMISSION');
 const abandoned=(await store.get('journal',profile.abandonedKey))?.value;
 assert(abandoned&&hash(abandoned)===profile.abandonedHash&&abandoned.disposition==='interrupted-abandoned-without-replay'
  &&abandoned.pending?.awaiting===null&&abandoned.pending.raw.steps.length===binding.frames
  &&abandoned.pending.raw.steps[0].msgId==='BET'&&abandoned.pending.raw.steps[0].responseXml?.length>0,'PARKED_COUNT_CLOSE_ABANDONED');
 if(coin)assert(abandoned.pending.raw.steps.slice(1).every(s=>s.msgId==='FREE_GAME'&&s.responseXml?.length>0)
  &&batches.some(b=>b.abandonedDemo===profile.abandonedKey&&b.adapterFailureCode==='PYRAMIDS_FREE_UNREVIEWED_COIN'),
  'PARKED_COUNT_CLOSE_COIN_ARCHIVE');
 if(superCoin){
  const frames=abandoned.pending.raw.steps;
  assert(frames.every((s,i)=>{
   const p=new URLSearchParams(s.responsePayload),g=new Map((p.get('GSD')??'').split('#').filter(x=>x.includes('~')).map(x=>x.split(/~(.*)/s).slice(0,2)));
   return s.responseXml?.length>0&&s.msgId===(i?'FREE_GAME':'BET')&&p.get('FID')==='1|'
    &&p.get('NFG')===String(10-i)&&p.get('TFG')==='10'&&p.get('CFGG')===String(i)&&g.get('SFGT')==='1';
  })&&new URLSearchParams(frames.at(-1).responsePayload).get('GSD').split('#').some(x=>x.startsWith('CL~')&&x.slice(3).split('|').some(r=>r.split(';')[2]==='-4'))
   &&batches.some(b=>b.abandonedDemo===profile.abandonedKey&&b.adapterFailureCode==='PYRAMIDS_FREE_UNREVIEWED_GSD'),
   'PARKED_COUNT_CLOSE_SUPER_COIN_ARCHIVE');
 }
 const key=`count-parked-close:${plan.trialId}:${profile.sourceRun}`;
 assert(!await store.get('journal',key+':before'),'PARKED_COUNT_CLOSE_ALREADY_STARTED');
 const save=async(k,v)=>{await store.create('journal',k,v,{immutable:true});assert(hash((await store.get('journal',k))?.value)===hash(v),'PARKED_COUNT_CLOSE_READBACK');};
 await save(key+':before',{schema:'sg-count-parked-before-v1',profileHash:hash(profile),pool,campaign,repair,
  batchesHash:hash(batches),abandonedHash:hash(abandoned),commit,run,at:now(),sourceRequests:0});
 const guarded=async()=>{await boundary();assert(hash((await store.get('state','campaign'))?.value)===profile.campaignHash
  &&hash((await store.get('state',profile.parkedRepair.key))?.value)===profile.parkedRepair.hash,'PARKED_COUNT_CLOSE_SCENE_CHANGED');};
 const retired=await retireDemoPool({store,transport,gate,parser,plan,boundary:guarded,owner:run,expectedPoolHash:profile.poolHash,
  commit:profile.sourceCommit,group:'secondary',closedBatchDecorations:profile.closedBatchDecorations??[],now});
 const after=(await store.get('state','pool:'+plan.trialId)).value;
 assert(retired.completePreserved===binding.complete&&retired.recordsHash===profile.recordsHash&&retired.abandonedAttempts===0
  &&after.confirmed===binding.complete&&checkLedger(after,plan,spec).reserved===0
  &&Object.values(after.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'PARKED_COUNT_CLOSE_RESULT');
 const out={schema:'sg-count-parked-close-v1',profileHash:hash(profile),sourceRun:profile.sourceRun,sourceCommit:profile.sourceCommit,
  trialId:plan.trialId,activation:spec.activation,completePreserved:binding.complete,abandonedAlready:1,newAbandoned:0,
  recordsHash:retired.recordsHash,retirement:after.retiredCount,retirementHash:hash(retired),repairKey:profile.parkedRepair.key,
  sourceRequests:0,newBetAllowance:0,requiresNewSession:true,commit,run,at:now()};
 await guarded();await save(key+':complete',out);return out;
}
