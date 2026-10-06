import assert from 'node:assert/strict';
import {createOriginalAgFullControl} from './ag-original-full-control.mjs';
import {cohortRepos,cohortView,participantKey,inspectParticipant} from './sg-federation.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {readTasks} from './sg-queue-control.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

// Admission already verified the immutable current ending, both complete
// inventories, the new revision and its own Linux proof. AG's original resume
// now performs the ready-only recovery. Its dispatch is the existing admission
// handoff; capture jobs still depend on the complete native permit.
export async function prepareExistingAgResume({profile,previous,prior,ended,store,guard,prepareGame,now=Date.now}){
 assert(profile.fullAgControl&&profile.resume&&ended?.status==='completed'&&ended.sourceJobsEnded===true
  &&ended.run===prior.run&&ended.proofHash===profile.resume.endedProofHash
  &&previous.payload.queueId===profile.payload.queueId,'SG_AG_RESUME_VERIFIED_CURRENT_ENDING');
 const queueId=profile.payload.queueId,participant=(await store.get('journal',participantKey(previous)))?.value;
 if(previous.federation)inspectParticipant({profile:previous,receipt:participant,coordinatorRun:prior.run,commit:prior.commit});
 const handoffs=[];
 for(const [repository,oldRun] of [[cohortRepos.primary,prior.run],...(participant?[[cohortRepos.secondary,participant.run]]:[])]){
  const view=cohortView(previous,repository),key='rolling-ag-control:'+queueHash([queueId,oldRun,prior.commit]);
  const saved=(await store.get('state',key))?.value;
  if(saved)assert(saved.cohortRun===oldRun&&saved.commit===prior.commit&&saved.state?.version===1
   &&saved.state.queueId===queueId&&saved.state.runId===Number(oldRun.split(':')[0])
   &&saved.state.games.length===view.payload.games.length
   &&saved.state.games.every((g,i)=>g.gameId===view.payload.games[i].gameId&&g.campaignId===view.payload.games[i].campaignId),'SG_AG_RESUME_OWN_SAVED_STATE');
  const state={version:1,queueId,runId:Number(oldRun.split(':')[0]),phase:'running',games:view.payload.games.map((g,i)=>({
   ...structuredClone(g),phase:saved?.state.games[i].phase??'ready',
   ...(saved?.state.games[i].sgOutcomeUnknownRetained?{sgOutcomeUnknownRetained:true}:{} )}))};
  // Unknown operations and independently blocked games remain isolated. They
  // cannot become a new ready task merely because another window starts.
  for(const g of state.games)if(g.sgOutcomeUnknownRetained||g.phase==='merging'||g.phase==='merged')g.phase='blocked';
  let dispatched=false;
  const boundary=async()=>{
   await guard();const receipt=(await store.get('journal',`rolling-ended:${queueId}:${prior.run}`))?.value;
   assert(queueHash(receipt)===ended.proofHash,'SG_AG_RESUME_CURRENT_ENDING_CHANGED');
  };
  const client={db:name=>{const game=state.games.find(g=>g.dbName===name);assert(game,'SG_AG_RESUME_OWN_GAME');return {game,
   collection:name=>{assert(name==='capture_queue','SG_AG_RESUME_TASK_COLLECTION');return {
    async updateMany(query){assert(query.queueId===queueId&&query.campaignId===game.campaignId
     &&queueHash(query.status.$in)===queueHash(['running','failed','blocked']),'SG_AG_RESUME_ORIGINAL_QUERY');
     await boundary();const current=profile.payload.games.find(g=>g.gameId===game.gameId);
     assert(current&&queueHash(current)===queueHash(view.payload.games.find(g=>g.gameId===game.gameId)),'SG_AG_RESUME_GAME_CHANGED');
     await prepareGame({game:current,queueId,ended,previous,guard});return {acknowledged:true};}
   };}
  };},close:async()=>{}};
  const resume=createOriginalAgFullControl({
   fs:{existsSync:()=>false},credentialPath:'existing-admission-memory',read:()=>({}),mongo:async()=>client,load:()=>state,
   statePath:'unused',save:()=>{throw Error('SG_AG_RESUME_UNEXPECTED_SAVE');},path:{join:(...p)=>p.join('/')},directory:'existing-admission',repository,secret:'preserved',
   githubClient:()=>({get:async()=>{await boundary();return {data:{status:'completed'}};}}),assertNoRuns:boundary,
   liveLeases:async db=>{const rows=await readTasks({store,game:db.game,queueId});const keys=rows.map(r=>{const [kind,index]=r._id.split(':');return stagingLeaseKey(queueId,db.game,kind,Number(index));});
    return (await store.getMany('state',keys)).filter(r=>r?.value.expiresAt>now()).length;},
   dispatch:async(s)=>{await boundary();assert(!dispatched,'SG_AG_RESUME_DISPATCH_ONCE');dispatched=true;
    const handoff={schema:'sg-ag-existing-admission-resume-v1',queueId,previousRun:oldRun,previousCommit:prior.commit,
     activation:profile.activation,endingHash:ended.proofHash,remaining:s.games.filter(g=>g.phase==='ready').map(g=>g.gameId),sourceRequests:0};
    const handoffKey='rolling-ag-resume:'+queueHash([profile.activation,oldRun]);assert(!await store.get('journal',handoffKey),'SG_AG_RESUME_EXISTING_HANDOFF_NO_REPLAY');
    await store.create('journal',handoffKey,handoff,{immutable:true});assert(queueHash((await store.get('journal',handoffKey))?.value)===queueHash(handoff),'SG_AG_RESUME_HANDOFF_FULL_READBACK');handoffs.push(handoff);
   }});
  await resume.resume();
 }
 return handoffs;
}
