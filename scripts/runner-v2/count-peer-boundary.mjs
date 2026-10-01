import {joblessFencedRead,joblessKey} from './count-jobless-fence.mjs';
import assert from 'node:assert/strict';
import {original} from './expired-run-review.mjs';
import {stalled,revokedMarker} from './demo-run-fence.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

const repositories={primary:'zyzuoyang/sg-capture-runner',secondary:'287113535qq-cmyk/sg-capture-runner'};
const scopes={primary:{gameId:32799,trialId:'sg_r1_20261001_32799',op:'parallel_rhino_count_boundary'},
 secondary:{gameId:32721,trialId:'sg_r1_20260928_32721',op:'parallel_pyramids_count_boundary'}};
// The immutable caller profile pins the peer. A run-list entry cannot nominate itself.
export function checkCountPeerDescriptor(peer,selfGroup){
 assert(peer?.schema==='sg-count-peer-v1'&&['primary','secondary'].includes(selfGroup)
  &&peer.group!==selfGroup&&Object.hasOwn(scopes,peer.group),'COUNT_PEER_GROUP');
 const fixed=scopes[peer.group];
 assert(peer.repository===repositories[peer.group]&&peer.gameId===fixed.gameId&&peer.trialId===fixed.trialId
  &&/^[1-9][0-9]{0,14}:1$/.test(peer.run)&&/^[a-f0-9]{40}$/.test(peer.commit??'')
  &&/^[a-f0-9]{64}$/.test(peer.profileHash??'')&&/^[a-f0-9]{64}$/.test(peer.activation??'')
  &&(peer.group==='primary'?[1,2,4]:[1]).includes(peer.lanesPerHost),'COUNT_PEER_SCOPE');
 return fixed;
}
export function checkCountPeerEvidence(evidence,peer,status,now=Date.now()){
 const fixed=checkCountPeerDescriptor(peer,peer.group==='primary'?'secondary':'primary');
 assert(['in_progress','completed'].includes(status)&&evidence?.state?.length===3&&evidence?.journal?.length===3,'COUNT_PEER_EVIDENCE');
 const ids=[`${peer.group}/campaign`,`${peer.group}/pool:${peer.trialId}`,`${peer.group}/capture-run:${peer.run}`];
 assert(new Set(evidence.state.map(d=>d._id)).size===3&&evidence.state.every(d=>ids.includes(d._id)),'COUNT_PEER_DOCUMENT_SCOPE');
 const [campaign,pool,bound]=ids.map(id=>evidence.state.find(d=>d._id===id).value);
 const keys=[`${peer.group}/count-run:${peer.trialId}:${peer.run}`,`${peer.group}/complete-count:${peer.trialId}:${peer.activation}`];keys.push(keys[1]+':complete');
 assert(new Set(evidence.journal.map(d=>d._id)).size===3&&evidence.journal.every(d=>keys.includes(d._id)),'COUNT_PEER_JOURNAL_SCOPE');
 const [permit,spec,complete]=keys.map(key=>evidence.journal.find(d=>d._id===key).value);
 const finished=status==='completed'&&campaign.activeGame===null;
 if(finished){
  const entry=campaign.games?.find(g=>g.game_id===fixed.gameId),target=peer.group==='primary'?300000:299850;
  assert(entry?.status==='complete'&&entry.confirmed===target&&Number.isFinite(entry.completed)
   &&pool.confirmed===target,'COUNT_PEER_FINISHED_PROOF');
 }
 assert(permit.schema==='sg-count-run-v1'
  &&permit.run===peer.run&&permit.commit===peer.commit&&permit.activation===peer.activation&&permit.profileHash===peer.profileHash
  &&Number.isSafeInteger(permit.completeBefore)&&permit.completeBefore>=0&&Number.isSafeInteger(permit.remainingComplete)
  &&permit.completeBefore+permit.remainingComplete===(peer.group==='primary'?300000:299850),'COUNT_PEER_PERMISSION');
 assert(campaign.group===peer.group&&campaign.enabled&&(finished||campaign.activeGame===fixed.gameId)&&!campaign.protocolValidation
  &&campaign.validationLimit===0&&campaign.formalCount?.activation===peer.activation&&campaign.formalCount.profileHash===peer.profileHash
  &&campaign.formalCount.trialId===peer.trialId&&bound.gameId===fixed.gameId&&pool.enabled&&!pool.failure
  &&pool.countAllocation?.specHash===hash(spec)&&spec.schema==='sg-complete-count-v1'
  &&spec.trialId===peer.trialId&&spec.activation===peer.activation&&spec.profileHash===peer.profileHash
  &&spec.gameId===peer.gameId&&spec.target===(peer.group==='primary'?300000:299850)
  &&complete.schema==='sg-complete-count-activation-v1'&&complete.specHash===hash(spec)&&complete.planHash===spec.planHash
  &&complete.trialId===peer.trialId&&complete.commit===spec.commit
  &&(spec.sessionLayout?.lanesPerHost??1)===peer.lanesPerHost
  &&Number.isSafeInteger(pool.confirmed)&&pool.confirmed>=permit.completeBefore,
  'COUNT_PEER_STATE');
 if(peer.group==='primary')assert(hash(campaign.demoRunRevoked)===hash(revokedMarker),'COUNT_PEER_REVOKED_MARKER');
 const allowed=peer.group==='secondary'?Array.from({length:20},(_,i)=>i+20):
  Array.from({length:peer.lanesPerHost},(_,lane)=>Array.from({length:20},(_,i)=>lane*40+i)).flat();
 assert(Object.keys(pool.workers).length<=allowed.length&&Object.entries(pool.workers).every(([w,v])=>allowed.includes(Number(w))
  &&String(Number(w))===w&&Number.isFinite(v.leaseUntil)
  &&(v.leaseUntil<=now||v.owner?.startsWith(peer.run+':formal-capture:'))),'COUNT_PEER_OWNER');
 if(status==='completed')assert(pool.countAllocation.reserved===0&&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now),
  'COUNT_PEER_ENDED_UNSETTLED');
 return permit;
}
export function checkCountPeerHolds(holds,selfGroup,maintenanceHoldHash){
 assert(holds?.length===2&&new Set(holds.map(r=>r._id)).size===2
  &&['primary/global-hold','secondary/global-hold'].every(id=>holds.some(r=>r._id===id)),'GLOBAL_HOLD');
 if(maintenanceHoldHash){
  const own=holds.find(r=>r._id===selfGroup+'/global-hold')?.value;
  assert(selfGroup==='secondary'&&hash(own)===maintenanceHoldHash&&own.active
   &&own.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'&&['PYRAMIDS_FREE_COUNTERS','PYRAMIDS_SUPER_HOLD_PREFIX_ONLY'].includes(own.details?.code)
   &&own.details.category==='source_protocol'&&own.details.trialId==='sg_r1_20260928_32721'
   &&own.details.cooldownUntil===0&&holds.find(r=>r._id==='primary/global-hold')?.value.active===false,'GLOBAL_HOLD');
 }else assert(holds.every(r=>r?.value?.active===false),'GLOBAL_HOLD');
}
export function countPeerBoundary({read,transport,peer,selfGroup,run,commit,workflowPath,maintenanceHoldHash,now=Date.now}){
 const fixed=checkCountPeerDescriptor(peer,selfGroup),selfRepo=repositories[selfGroup];
 assert(!maintenanceHoldHash||workflowPath==='.github/workflows/demo-maintenance.yml'
  &&selfGroup==='secondary'&&/^[a-f0-9]{64}$/.test(maintenanceHoldHash),'COUNT_PEER_MAINTENANCE_HOLD_SCOPE');
 assert(/^[1-9][0-9]{0,14}:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit)
  &&['.github/workflows/demo-maintenance.yml','.github/workflows/trial-300k.yml'].includes(workflowPath),'COUNT_PEER_SELF');
 const selfId=Number(run.split(':')[0]),peerId=Number(peer.run.split(':')[0]);
 return async()=>{
  let fenceRows;
  const fencedRead=joblessFencedRead({read,store:{get:async(collection,key)=>{
   assert(collection==='journal'&&[joblessKey,'count-jobless-revocation:sg_r1_20261001_32799:36854881370:1:complete'].includes(key),'COUNT_PEER_FENCE_SCOPE');
   if(selfGroup==='primary')return transport.request('read',{collection,key});
   if(!fenceRows)fenceRows=await transport.request('parallel_rhino_jobless_fence');
   assert(Array.isArray(fenceRows)&&fenceRows.length===2&&new Set(fenceRows.map(r=>r._id)).size===2,'COUNT_PEER_FENCE_MISSING');
   return fenceRows.find(r=>r._id==='primary/'+key);
  }}});
  const start=now(),queries=Object.values(repositories).flatMap(repository=>['in_progress','queued','pending','waiting','requested'].map(status=>({repository,status})));
  for(let i=0;i<queries.length;i+=5){
   const wave=queries.slice(i,i+5),results=await Promise.allSettled(wave.map(q=>fencedRead(`repos/${q.repository}/actions/runs?status=${q.status}&per_page=100`)));
   for(let n=0;n<results.length;n++){
    assert(results[n].status==='fulfilled','COUNT_PEER_LIST_READ');const result=results[n].value,q=wave[n];
    assert(Number.isInteger(result.total_count)&&result.total_count<100&&result.workflow_runs?.length===result.total_count,'COUNT_PEER_LIST_TRUNCATED');
    for(const r of result.workflow_runs){
     const legacy=q.repository===repositories.primary?[original,stalled].find(x=>x.id===r.id):null;
     const self=q.repository===selfRepo&&r.id===selfId,other=q.repository===peer.repository&&r.id===peerId;
     assert((self||other||legacy)&&r.run_attempt===1&&r.head_sha===(self?commit:other?peer.commit:legacy.commit)
      &&q.status===(legacy?'queued':'in_progress')&&r.path===(self?workflowPath:'.github/workflows/trial-300k.yml'),'OTHER_RUN_ACTIVE');
    }
   }
  }
  for(const old of [original,stalled]){
   const prefix=`repos/${old.repository}/actions/runs/${old.id}`,r=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
   assert(r.id===old.id&&r.head_sha===old.commit&&r.run_attempt===1&&r.repository?.full_name===old.repository
    &&r.event==='workflow_dispatch'&&r.path==='.github/workflows/trial-300k.yml'&&r.status==='queued'&&r.conclusion===null
    &&jobs.total_count===0&&jobs.jobs?.length===0,'COUNT_PEER_OLD_RUN');
  }
  const self=await read(`repos/${selfRepo}/actions/runs/${selfId}`);
  assert(self.id===selfId&&self.run_attempt===1&&self.head_sha===commit&&self.repository?.full_name===selfRepo
   &&self.event==='workflow_dispatch'&&self.path===workflowPath&&self.status==='in_progress'&&self.conclusion===null,'COUNT_PEER_SELF_IDENTITY');
  const prefix=`repos/${peer.repository}/actions/runs/${peerId}`,r=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
  assert(r.id===peerId&&r.run_attempt===1&&r.head_sha===peer.commit&&r.repository?.full_name===peer.repository
   &&r.event==='workflow_dispatch'&&r.path==='.github/workflows/trial-300k.yml'
   &&(r.status==='in_progress'&&r.conclusion===null||r.status==='completed'&&r.conclusion==='success'),'COUNT_PEER_IDENTITY');
  assert(Number.isInteger(jobs.total_count)&&jobs.total_count<100&&jobs.jobs?.length===jobs.total_count,'COUNT_PEER_JOBS_TRUNCATED');
  const captures=jobs.jobs.filter(j=>/^capture-(?:[0-9]|1[0-9])$/.test(j.name));
  assert(captures.length===20&&new Set(captures.map(j=>j.name)).size===20
   &&captures.every(j=>j.status==='in_progress'&&r.status==='in_progress'||j.status==='completed'&&j.conclusion==='success')
   &&jobs.jobs.some(j=>j.name===(peer.group==='primary'?'formal-admit':'pyramids-formal-admit')&&j.status==='completed'&&j.conclusion==='success')
   &&jobs.jobs.filter(j=>!captures.includes(j)).every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion)),
   'COUNT_PEER_JOBS');
  const evidence=await transport.request(fixed.op,{run:peer.run,activation:peer.activation});
  if(r.status==='completed'&&evidence.state?.find(d=>d._id===peer.group+'/campaign')?.value.activeGame===null)
   assert(jobs.jobs.filter(j=>j.name==='verify'&&j.status==='completed'&&j.conclusion==='success').length===1,'COUNT_PEER_FINISHED_AUDIT');
  checkCountPeerEvidence(evidence,peer,r.status,now());
  const holds=await transport.request('global_holds');checkCountPeerHolds(holds,selfGroup,maintenanceHoldHash);
  assert(now()-start<=30000,'GITHUB_EVIDENCE_STALE');
 };
}
