import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {sourcePermit,readTasks} from './sg-queue-control.mjs';
import {participantKey,inspectParticipant} from './sg-federation.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {closureKey,inspectWindowRecovery,inspectEndedCaptureActors} from './sg-window-recovery-binding.mjs';
export async function checkWindowLeases({target,store,now=Date.now}){
 const keys=target.payload.games.flatMap(g=>[...['canary:1','canary:2'],...Array.from({length:20},(_,i)=>'worker:'+(i+1))]
  .map(t=>{const [kind,index]=t.split(':');return stagingLeaseKey(target.payload.queueId,g,kind,Number(index));}));
 assert(new Set(keys).size===22*target.payload.games.length,'SG_AG_WINDOW_LEASE_INVENTORY');
 for(let i=0;i<keys.length;i+=100){const chunk=keys.slice(i,i+100),rows=await store.getMany('state',chunk);
  assert(rows.length===chunk.length&&rows.every(r=>!r||Number.isFinite(r.value.expiresAt)&&r.value.expiresAt<=now()),
   'SG_AG_WINDOW_LIVE_OR_UNKNOWN_LEASE');}
}
async function preservedProofs({target,r,store}){
 for(const p of r.completedProofs){
  const game=target.payload.games.find(g=>g.gameId===p.gameId),key='rolling-merge:'+queueHash([target.payload.queueId,game.gameId,game.campaignId]);
  const state=(await store.get('state',key))?.value,receipt=(await store.get('journal',key+':complete'))?.value;
  assert(state?.status==='complete'&&queueHash(state.result)===p.receiptHash&&queueHash(receipt)===p.receiptHash
   &&receipt.schema==='sg-ag-rolling-complete-v1'&&receipt.queueId===target.payload.queueId&&receipt.gameId===game.gameId
   &&receipt.campaignId===game.campaignId&&receipt.count===300000&&receipt.fullReadback===true&&receipt.independentlyVerified===true
   &&receipt.recordsHash===p.recordsHash,'SG_AG_WINDOW_OWN_COMPLETED_PROOF_CHANGED');
 }
}
export async function closeEndedWindow({profile,target,store,transport,boundary,readEnded,readEndedJobs,readLinux,merge,run,commit,guard,now=Date.now}){
 const r=inspectWindowRecovery(profile,target),endKey=`rolling-ended:${target.payload.queueId}:${r.targetRun}`,key=closureKey(r);
 assert(/^[0-9]+:1$/.test(run??'')&&run!==r.targetRun&&/^[a-f0-9]{40}$/.test(commit??'')&&commit!==r.targetCommit
  &&typeof merge==='function'&&typeof guard==='function','SG_AG_WINDOW_ACTING_TARGET_IDENTITY');
 await boundary();const linux=await readLinux(profile.linuxRun),hello=await transport.request('hello');
 assert(linux?.id===Number(profile.linuxRun)&&linux.run_attempt===1&&linux.status==='completed'&&linux.conclusion==='success'
  &&linux.head_branch==='main'&&linux.head_sha===profile.codeCommit&&linux.path==='.github/workflows/preflight.yml'
  &&linux.repository?.full_name==='287113535qq-cmyk/sg-capture-runner','SG_AG_WINDOW_EXACT_LINUX_REQUIRED');
 assert(hello?.group==='primary'&&hello.database==='sg_capture_staging_v1'&&hello.rollingNamespace==='primary'
  &&hello.rollingJournalBatchEnabled===true&&hello.rollingCleanupEnabled===true
  &&hello.gatewaySha256===profile.nativeGatewayHash&&hello.accessManifestHash===profile.nativeManifestHash,
  'SG_AG_WINDOW_NATIVE_CHANGED');
 assert(!await store.get('journal',key)&&!await store.get('journal',key+':complete')&&!await store.get('journal',endKey),
  'SG_AG_WINDOW_ALREADY_STARTED_NO_RETRY');
 const permit=await sourcePermit({profile:target,store,run:r.targetRun,commit:r.targetCommit,sourceJobsEnded:true,now});
 assert(queueHash(permit)===r.permitHash,'SG_AG_WINDOW_PERMIT_CHANGED');
 const participant=(await store.get('journal',participantKey(target)))?.value;
 inspectParticipant({profile:target,receipt:participant,coordinatorRun:r.targetRun,commit:r.targetCommit});
 const actors=await inspectEndedCaptureActors({target,r,participant,readEnded,readEndedJobs});
 for(const game of target.payload.games)await readTasks({store,game,queueId:target.payload.queueId});
 await checkWindowLeases({target,store,now});await preservedProofs({target,r,store});await guard();
 assert(queueHash((await store.get('state','rolling-source'))?.value)===r.nativeSourceHash,'SG_AG_WINDOW_SOURCE_CHANGED');
 const intent={schema:'sg-ag-window-close-intent-v1',operation:profile.operation,run,commit,profileHash:queueHash(profile),
  targetRun:r.targetRun,targetCommit:r.targetCommit,targetSourceHash:r.nativeSourceHash,permitHash:r.permitHash,
  participantHash:r.participantHash,sourceRequests:0};
 await boundary();await store.create('journal',key,intent,{immutable:true});
 assert(queueHash((await store.get('journal',key))?.value)===queueHash(intent),'SG_AG_WINDOW_INTENT_READBACK');
 const recoverMerging=async previous=>{
  assert(previous.owner===r.targetRun+':ag-rolling-capture:controller','SG_MERGE_RECOVERY_OWNER');
  const rows=actors.primary.jobs.jobs.filter(j=>j.name==='AG rolling lane 20');
  assert(rows.length===1&&rows[0].status==='completed','SG_MERGE_CONTROLLER_ACTIVE');
  return {actorEnded:true,owner:previous.owner,run:r.targetRun,commit:r.targetCommit,jobId:rows[0].id,sourceRequests:0};
 };
 const results=[];
 for(const game of target.payload.games){await guard();
  try{const result=await merge(game,{recoverMerging,owner:run+':ag-rolling-window-close:controller'});
   assert(result?.gameId===game.gameId,'SG_AG_WINDOW_MERGE_GAME_CHANGED');results.push(result);
  }catch(error){if(error.outcomeUnknown===true||transport.status().poison)throw error;
   const code=error.code??error.message;results.push({gameId:game.gameId,status:'blocked',reason:/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_AG_MERGE_REVIEW_REQUIRED'});}
 }
 await boundary();await inspectEndedCaptureActors({target,r,participant,readEnded,readEndedJobs});
 await checkWindowLeases({target,store,now});await preservedProofs({target,r,store});await guard();
 const before=await store.get('state','rolling-source');
 assert(queueHash(before?.value)===r.nativeSourceHash,'SG_AG_WINDOW_SOURCE_CHANGED');
 assert(r.completedProofs.every(p=>results.some(v=>v.gameId===p.gameId&&v.count===300000)),
  'SG_AG_WINDOW_COMPLETED_GAME_RETAINED_AS_UNKNOWN');
 const receipt={schema:'sg-ag-rolling-window-ended-v1',queueId:target.payload.queueId,run:r.targetRun,commit:r.targetCommit,
  activation:target.activation,profileHash:queueHash(target),complete:results.filter(v=>v.count===300000).length,
  retained:results.filter(v=>v.count!==300000).length,games:results.map(v=>({gameId:v.gameId,status:v.status??'complete',count:v.count??0})),
  sourceRequests:0,federationHash:queueHash(target.federation),participant,
  closure:{schema:'sg-ag-window-closure-actor-v1',operation:profile.operation,run,commit,activation:profile.activation,
   profileHash:queueHash(profile),codeCommit:profile.codeCommit,linuxRun:profile.linuxRun,intentHash:queueHash(intent)}};
 await store.create('journal',endKey,receipt,{immutable:true});
 assert(queueHash((await store.get('journal',endKey))?.value)===queueHash(receipt),'SG_AG_WINDOW_END_READBACK');
 await store.create('journal',key+':complete',{schema:'sg-ag-window-close-complete-v1',run,commit,intentHash:queueHash(intent),
  receiptHash:queueHash(receipt),sourceRequests:0},{immutable:true});
 const value={owner:null,queueId:null,status:'idle',lastRun:r.targetRun,lastQueueId:target.payload.queueId,endedProofHash:queueHash(receipt)};
 await boundary();await guard();assert(queueHash((await store.get('state','rolling-source'))?.value)===r.nativeSourceHash,'SG_AG_WINDOW_SOURCE_CHANGED');
 assert(await store.cas('state','rolling-source',before,value),'SG_AG_WINDOW_SOURCE_CAS_CONFLICT');
 assert(queueHash((await store.get('state','rolling-source'))?.value)===queueHash(value),'SG_AG_WINDOW_IDLE_READBACK');
 return {operation:profile.operation,actingRun:run,targetRun:r.targetRun,endedProofHash:queueHash(receipt),
  complete:receipt.complete,retained:receipt.retained,sourceRequests:0};
}
