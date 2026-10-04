import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {validateSgPayload} from './sg-contract.mjs';
// Revisions extend AG's ordered game list; they never replace its campaigns
// or reset a task namespace. Adapter hash changes are checked separately by
// the reviewed repair manifest and the independent saved-prefix audit.
export function inspectQueueRevision({profile,previous,prior}){
 if(!profile.resume){
  assert(!profile.append,'SG_QUEUE_APPEND_REQUIRES_RESUME');
  return {existing:[],added:profile.payload.games};
 }
 assert(previous&&prior&&previous.activation===profile.resume.previousActivation
  &&queueHash(previous)===prior.profileHash&&previous.payload.queueId===profile.payload.queueId,
  'SG_QUEUE_PREVIOUS_PROFILE_BINDING');
 for(const key of ['schema','group','target','lanes','sessionsPerLane','canaries','canaryRounds','stagingOveragePerLane'])
  assert(profile[key]===previous[key],'SG_QUEUE_AG_CONTRACT_CHANGED');
 validateSgPayload(previous.payload,previous.manifest);validateSgPayload(profile.payload,profile.manifest);
 const old=previous.payload.games,next=profile.payload.games;
 const {games:oldGames,...oldHeader}=previous.payload,{games:newGames,...newHeader}=profile.payload;
 assert(queueHash(oldHeader)===queueHash(newHeader)&&next.length>=old.length
  &&old.every((game,i)=>queueHash(game)===queueHash(next[i])),'SG_QUEUE_PREVIOUS_GAMES_CHANGED');
 assert(previous.manifest.length===old.length&&profile.manifest.length===next.length,'SG_QUEUE_MANIFEST_INVENTORY');
 for(const game of old){
  const before=previous.manifest.find(e=>e.gameId===game.gameId),after=profile.manifest.find(e=>e.gameId===game.gameId);
  const {planHash:p,adapterProofHash:h,...oldEntry}=before,{planHash:q,adapterProofHash:k,...newEntry}=after;
  assert(queueHash(oldEntry)===queueHash(newEntry),'SG_QUEUE_PREVIOUS_NAMESPACE_CHANGED');
 }
 const added=next.slice(old.length);
 if(added.length){
  const append=profile.append;
  assert(append?.schema==='sg-ag-rolling-append-v1'&&append.previousPayloadHash===queueHash(previous.payload)
   &&append.previousManifestHash===queueHash(previous.manifest)
   &&/^[a-f0-9]{64}$/.test(append.emptyEvidenceHash??'')
   &&queueHash(append.gameBindings)===queueHash(added.map(game=>{
    const entry=profile.manifest.find(e=>e.gameId===game.gameId);
    return {gameId:game.gameId,planHash:entry.planHash,adapterProofHash:entry.adapterProofHash};
   })),'SG_QUEUE_APPEND_BINDING');
 }else assert(!profile.append,'SG_QUEUE_APPEND_WITHOUT_NEW_GAMES');
 return {existing:old,added};
}

export function appendQueueGames({previous,manifest,plans,evidence,resume,now=Date.now}){
 assert(evidence?.schema==='sg-ag-rolling-new-game-empty-v1'&&Number.isSafeInteger(evidence.at)
  &&now()/1000-evidence.at>=0&&now()/1000-evidence.at<300,'SG_APPEND_EVIDENCE_STALE');
 assert(evidence.queueId===previous.payload.queueId&&evidence.profileHash===queueHash(previous)
  &&evidence.previousActivation===previous.activation&&queueHash(resume)===queueHash({
   previousActivation:evidence.previousActivation,previousRun:evidence.previousRun,endedProofHash:evidence.endedProofHash})
  &&evidence.planRegistryHash===queueHash(plans),'SG_APPEND_EVIDENCE_BINDING');
 assert(evidence.source?.status==='idle'&&evidence.source.owner===null&&evidence.source.lastRun===resume.previousRun
  &&evidence.source.lastQueueId===previous.payload.queueId&&evidence.source.endedProofHash===resume.endedProofHash
  &&queueHash(evidence.holds)===queueHash([false,false]),'SG_APPEND_SOURCE_NOT_ENDED');
 assert(Array.isArray(evidence.games)&&evidence.games.length>0&&evidence.games.length<=178
  &&new Set(evidence.games.map(g=>g.gameId)).size===evidence.games.length,'SG_APPEND_CANDIDATE_INVENTORY');
 const oldIds=new Set(previous.payload.games.map(g=>g.gameId)),added=[],excluded=[];
 for(const facts of [...evidence.games].sort((a,b)=>Number(a.gameId)-Number(b.gameId))){
  const id=facts.gameId,plan=plans.plans[id],proof=plans.proofs[id];
  assert(typeof id==='string'&&/^[0-9]{5}$/.test(id)&&!oldIds.has(id)&&plan&&proof
   &&plan.gameId===Number(id)&&facts.trialId===plan.trialId&&!plans.alreadyComplete.includes(plan.gameId)
   &&proof.planHash===queueHash(plan)&&proof.acceptedBaseRounds>=10
   &&proof.formalAdmission==='requires-two-AG-live-canaries','SG_APPEND_ADAPTER_PROOF');
  assert(Number.isSafeInteger(facts.officialCount)&&facts.officialCount>=0
   &&Array.isArray(facts.history)&&facts.history.length===1&&facts.history[0].game_id===Number(id)
   &&['primary','secondary'].includes(facts.history[0].group)
   &&Number.isSafeInteger(facts.history[0].baseline)&&facts.history[0].baseline>=0
   &&Number.isSafeInteger(facts.history[0].confirmed)&&facts.history[0].confirmed>=0,'SG_APPEND_NATIVE_HISTORY_REQUIRED');
  if(facts.officialCount!==0||facts.history[0].baseline!==0||facts.history[0].confirmed!==0||facts.history[0].status==='complete'){
   excluded.push({gameId:id,reason:'historical-baseline-or-native-prefix'});continue;
  }
  added.push({gameId:id,dbName:'sg_'+id,campaignId:'sg_'+id+'-'+previous.payload.queueId,baseline:0,
   mongoUri:'sg-native://primary/sg_'+id});
 }
 const payload={...structuredClone(previous.payload),games:[...structuredClone(previous.payload.games),...added]};
 const nextManifest=[...structuredClone(manifest),...added.map(game=>({...game,phase:'ready',
  planHash:queueHash(plans.plans[game.gameId]),adapterProofHash:queueHash(plans.proofs[game.gameId])}))];
 const append=added.length?{schema:'sg-ag-rolling-append-v1',previousPayloadHash:queueHash(previous.payload),
  previousManifestHash:queueHash(previous.manifest),emptyEvidenceHash:queueHash(evidence),
  gameBindings:added.map(game=>{const entry=nextManifest.find(e=>e.gameId===game.gameId);
   return {gameId:game.gameId,planHash:entry.planHash,adapterProofHash:entry.adapterProofHash};})}:undefined;
 validateSgPayload(payload,nextManifest);
 return {payload,manifest:nextManifest,...(append?{append}:{}),excluded};
}
