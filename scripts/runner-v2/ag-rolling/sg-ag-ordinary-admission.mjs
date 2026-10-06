import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {digest} from './sg-business-delivery.mjs';
import {sourcePermit} from './sg-queue-control.mjs';
import {cohortRepos,participantKey,inspectParticipant,verifyEndedFederation} from './sg-federation.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
export function assertOrdinaryPrivileges(status,{profile,plans,binding}){
 const auth=status?.authInfo;assert(stable(auth?.authenticatedUsers)===stable([{user:'sg_simulate_delivery_v1',db:'admin'}]),'SG_AG_ORIGINAL_WRITER_AUTH');
 const expected=profile.payload.games.map(g=>({resource:{db:'sg_'+plans[g.gameId].runtimeSlug,collection:'simulate'},actions:['find','insert','update']}));
 assert(expected.length===81&&new Set(expected.map(v=>v.resource.db)).size===81&&expected.some(v=>v.resource.db===binding.database),'SG_AG_ORIGINAL_81_SIMULATE_SCOPE');
 for(const [collection,actions] of Object.entries({capture_state_v2:['find'],capture_journal_v2:['find'],official_rounds:['find'],business_delivery_v1:['find','insert']}))expected.push({resource:{db:'sg_capture_staging_v1',collection},actions});
 const canonical=rows=>rows.map(v=>{assert(Object.keys(v).sort().join(',')==='actions,resource'&&Object.keys(v.resource).sort().join(',')==='collection,db','SG_AG_BROAD_PRIVILEGE_DENIED');return {...v,actions:[...v.actions].sort()};}).sort((a,b)=>stable(a.resource).localeCompare(stable(b.resource)));
 assert(Array.isArray(auth.authenticatedUserPrivileges)&&auth.authenticatedUserPrivileges.length===85&&stable(canonical(auth.authenticatedUserPrivileges))===stable(canonical(expected)),'SG_AG_EXACT_ORIGINAL_85_PRIVILEGES');return true;
}
export function assertOrdinaryProtectedGrant(document,descriptor,identity){
 const value=document?.value,expected=descriptor.expectedGrant;
 assert(document?._id===descriptor.grantKey&&document.immutable===true&&digest(document)===descriptor.grantDocumentHash
  &&stable(value)===stable(expected)&&value?.schema==='sg-ag-ordinary-protected-entry-v1','SG_AG_ORDINARY_ACTUAL_PROTECTED_GRANT');
 assert(value.actorRun===identity.actorRun&&value.actorCommit===identity.actorCommit&&value.actorRepository===cohortRepos.primary
  &&value.actorBranch==='sg-ag-strict-control-20261006'&&value.actorJob==='ag-rolling-strict-control'&&value.workflow==='.github/workflows/trial-300k.yml'
  &&stable(value.games)===stable(['32529'])&&value.sourceAllowance===0&&value.resumeAllowance===0&&value.nativeControllerScope==='original-primary-controller'
  &&value.mongoUsername==='sg_simulate_delivery_v1'&&value.originalPrivilegeCount===85&&value.rtpAccount==='sgdelivery'&&value.rtpGame==='32529','SG_AG_ORDINARY_GRANT_OWN_ACTOR_SCOPE');
 assert(value.actorRun!==value.cohortRun&&value.cohortRun===value.coordinatorRun&&/^\d+:1$/.test(value.coordinatorRun??'')&&/^[a-f0-9]{40}$/.test(value.captureCommit??'')
  &&value.captureCommit!==value.actorCommit,'SG_AG_ORDINARY_DISTINCT_CAPTURE_AND_ACTOR');
 assert(value.runtimeHash===descriptor.runtimeHash&&value.linuxEvidenceHash===digest(descriptor.linux)&&value.captureEvidenceHash===digest(descriptor.captureEvidence)
  &&value.originalDocumentsHash===digest(descriptor.originalDocuments)&&value.originalCount===100&&descriptor.originalDocuments?.length===100
  &&stable(value.ssh)===stable(descriptor.ssh)&&stable(value.evidenceDirectory)===stable(identity.directory)
  &&value.evidenceKeyFingerprint===descriptor.evidenceKeyFingerprint&&value.uid===identity.uid&&value.entrySha256===descriptor.entrySha256,'SG_AG_ORDINARY_GRANT_PRIVATE_FULL_BINDING');
 assert(/^[a-f0-9]{64}$/.test(value.publicationBoundaryProofHash??'')&&value.publicationCommit===identity.actorCommit,'SG_AG_ORDINARY_LEGAL_PUBLICATION_PROOF_REQUIRED');
 return value;
}
export function verifyOrdinaryCaptureInventory({actor,jobs,repository,run,commit,cohort}){
 assert(actor.id===Number(run.split(':')[0])&&actor.run_attempt===1&&actor.head_sha===commit&&actor.head_branch==='main'&&actor.repository?.full_name===repository
  &&actor.event==='workflow_dispatch'&&actor.path==='.github/workflows/trial-300k.yml'&&actor.status==='in_progress','SG_AG_ORDINARY_CURRENT_CAPTURE_IDENTITY');
 const lanes=jobs.jobs?.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name)),control=cohort==='primary'?'ag-rolling-admit':'ag-rolling-join';
 assert(jobs.total_count===jobs.jobs?.length&&jobs.total_count<100&&lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20
  &&jobs.jobs.every(j=>j.run_id===actor.id)&&jobs.jobs.filter(j=>j.name===control).length===1
  &&jobs.jobs.find(j=>j.name===control).status==='completed'&&jobs.jobs.find(j=>j.name===control).conclusion==='success'
  &&jobs.jobs.filter(j=>j.conclusion!=='skipped').every(j=>j.name===control||(cohort==='primary'&&j.name==='ag-rolling-finalize')||lanes.includes(j)),
  'SG_AG_ORDINARY_CAPTURE_FULL_CONTROL_AND_20_JOBS');
 return true;
}
// The actor identity is independent of the capture owner. The two capture
// actors may be excluded from the canonical inventory only after their actual
// permit, participant and complete exact run/job identities are verified.
export function createOrdinaryAdmission({descriptor,identity,profile,plans,binding,store,transport,client,read,oldProfile,privateEvidence,privateControlPersist,now=Date.now}){
 const expected=structuredClone(descriptor.expectedGrant),capture=descriptor.captureEvidence;let boundaryAt=-Infinity,captureAt=-Infinity,ended=null;
 const rawGrant=()=>client.db('sg_capture_staging_v1').collection('capture_journal_v2').findOne({_id:descriptor.grantKey},{hint:'_id_',maxTimeMS:15000});
 const assertActor=async()=>{
  const self=await read(`repos/${cohortRepos.primary}/actions/runs/${identity.actorRun.split(':')[0]}`);
  assert(self.id===Number(identity.actorRun.split(':')[0])&&self.run_attempt===1&&self.head_sha===identity.actorCommit&&self.head_branch===expected.actorBranch
   &&self.repository?.full_name===cohortRepos.primary&&self.event==='workflow_dispatch'&&self.path===expected.workflow&&self.status==='in_progress','SG_AG_ORDINARY_FRESH_ACTOR_IDENTITY');
  const jobs=await read(`repos/${cohortRepos.primary}/actions/runs/${self.id}/jobs?filter=all&per_page=100`);
  assert(jobs.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.filter(j=>j.name===expected.actorJob&&j.status==='in_progress'&&j.runner_id>0).length===1
   &&jobs.jobs.filter(j=>j.conclusion!=='skipped').every(j=>j.name===expected.actorJob),'SG_AG_ORDINARY_EXCLUSIVE_OWN_CONTROL_JOB');
 };
 const verifyCapture=async()=>{
  const start=now(),source=(await store.get('state','rolling-source'))?.value;
  assert(digest(profile)===expected.profileHash&&profile.payload.queueId===expected.queueId,'SG_AG_ORDINARY_CAPTURE_PROFILE');
  const part=(await store.get('journal',participantKey(profile)))?.value;inspectParticipant({profile,receipt:part,coordinatorRun:expected.coordinatorRun,commit:expected.captureCommit,run:capture.secondaryRun});
  if(source?.status==='running'){
   await sourcePermit({profile,store,run:expected.coordinatorRun,commit:expected.captureCommit});ended=null;
   for(const [cohort,run] of [['primary',expected.coordinatorRun],['secondary',part.run]]){
    const repo=cohortRepos[cohort],actor=await read(`repos/${repo}/actions/runs/${run.split(':')[0]}`),jobs=await read(`repos/${repo}/actions/runs/${run.split(':')[0]}/jobs?filter=all&per_page=100`);
    verifyOrdinaryCaptureInventory({actor,jobs,repository:repo,run,commit:expected.captureCommit,cohort});
   }
  }else{
   assert(source?.status==='idle'&&source.owner===null&&source.queueId===null&&source.lastRun===expected.coordinatorRun&&source.lastQueueId===expected.queueId,'SG_AG_ORDINARY_CURRENT_CAPTURE_ENDING');
   const receipt=(await store.get('journal','rolling-ended:'+expected.queueId+':'+expected.coordinatorRun))?.value;
   assert(receipt&&digest(receipt)===source.endedProofHash&&digest(receipt)===capture.endedProofHash,'SG_AG_ORDINARY_SAVED_CURRENT_ENDING');
   const prior=(await store.get('journal','rolling-activation:'+profile.activation+':complete'))?.value;
   const find=(run,repo)=>capture.actors.find(a=>String(a.run.id)===String(run).split(':')[0]&&a.run.repository?.full_name===repo);
   await verifyEndedFederation({previous:profile,prior,receipt,store,readEnded:async(id,repo)=>find(id,repo)?.run,readEndedJobs:async(id,repo)=>find(id,repo)?.jobs});
   const keys=profile.payload.games.flatMap(g=>['canary:1','canary:2',...Array.from({length:20},(_,i)=>'worker:'+(i+1))].map(t=>{const [kind,index]=t.split(':');return stagingLeaseKey(profile.payload.queueId,g,kind,Number(index));}));
   assert(keys.length===1782);for(let n=0;n<keys.length;n+=100)assert((await store.getMany('state',keys.slice(n,n+100))).every(d=>!d||d.value.expiresAt<=now()),'SG_AG_ORDINARY_ENDED_LIVE_LEASE');ended=receipt;
  }
  assert(now()-start<=30000,'SG_AG_ORDINARY_NATIVE_CAPTURE_STALE');captureAt=start;
 };
 const canonical=maintenanceBoundary({read:async path=>{
  const result=await read(path);if(!path.includes('/actions/runs?')||ended)return result;
  assert(result.total_count===result.workflow_runs?.length&&result.total_count<100,'SG_AG_ORDINARY_UNFILTERED_INVENTORY');
  assert(now()-captureAt<=30000,'SG_AG_ORDINARY_CAPTURE_IDENTITY_EXPIRED');
  const repo=path.split('/').slice(1,3).join('/'),run=repo===cohortRepos.primary?expected.coordinatorRun:capture.secondaryRun;
  const remove=result.workflow_runs.filter(r=>String(r.id)===run.split(':')[0]);assert(remove.length<=1&&remove.every(r=>r.run_attempt===1&&r.head_sha===expected.captureCommit&&r.path===expected.workflow),'SG_AG_ORDINARY_CAPTURE_LIST_CHANGED');
  return {...result,total_count:result.total_count-remove.length,workflow_runs:result.workflow_runs.filter(r=>!remove.includes(r))};
 },store,oldProfile,run:identity.actorRun,commit:identity.actorCommit,workflowPath:'.github/workflows/trial-300k.yml',now});
 const guard=async()=>{
  assertOrdinaryProtectedGrant(await rawGrant(),descriptor,identity);
  assertOrdinaryPrivileges(await client.db('admin').command({connectionStatus:1,showPrivileges:true}),{profile,plans,binding});
  await store.writable();if(now()-captureAt>=15000)await verifyCapture();
  if(now()-boundaryAt>=15000){await assertActor();await canonical();boundaryAt=now();}
 };
 return {guard,async assertCapturedEnding({source}={}){if(now()-captureAt>=15000)await verifyCapture();assert(ended&&source?.status==='idle'&&source.endedProofHash===digest(ended),'SG_AG_ORDINARY_CURRENT_ENDING_NOT_VERIFIED');},
  assertActualEntry(){assert(now()-captureAt<=30000&&now()-boundaryAt<=30000,'SG_AG_ORDINARY_ACTUAL_ENTRY_NOT_ADMITTED');return {actualValidatedEntry:true,entrySha256:descriptor.entrySha256};},
  captureRead:async path=>{if(!ended)return read(path);const found=capture.actors.find(a=>path.startsWith(`repos/${a.run.repository.full_name}/actions/runs/${a.run.id}`));assert(found,'SG_AG_ORDINARY_ARCHIVED_CAPTURE_SCOPE');return structuredClone(path.includes('/jobs?')?found.jobs:found.run);},
  originalCount:g=>{assert(g.gameId==='32529');return 100;},originalDocuments:g=>{assert(g.gameId==='32529');return structuredClone(descriptor.originalDocuments);},
  assertResumeBoundary:async()=>{throw Error('SG_AG_STRICT_NEW_CONTINUATION_FROZEN');},dispatchRemaining:async()=>{throw Error('SG_AG_STRICT_NEW_CONTINUATION_FROZEN');},
  finishCohort:async state=>{assert(state.games.every(g=>g.phase==='complete')&&privateEvidence.finalAckReceived,'SG_AG_ORDINARY_FINAL_PRIVATE_ACK_REQUIRED');return privateControlPersist('own-control-state',{state,sourceOrProfileContinuation:false,originalUsersAndEvidencePreserved:true});}
 };
}
