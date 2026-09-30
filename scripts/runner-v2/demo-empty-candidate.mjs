import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const emptyCandidatePool=plan=>({schema:'sg-github-pool-v2',enabled:false,failure:null,planHash:hash(plan),nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
export const stagedEmptyCandidatePool=(plan,profile)=>({...emptyCandidatePool(plan),emptyCandidate:{key:`empty-demo-candidate:${plan.trialId}:${profile.generation}`,specHash:hash(profile.emptyCandidate)}});

// First admission of a never-collected candidate. Historical samples receive
// no credit here. Reuse retirement/rollover after an auditable empty baseline.
export async function prepareEmptyCandidate({store,transport,plan,profile,boundary,commit,run,now=Date.now}){
 const spec=profile.emptyCandidate,key=`empty-demo-candidate:${plan.trialId}:${profile.generation}`;
 assert(spec?.schema==='sg-empty-demo-candidate-v1'&&profile.schema==='sg-demo-next-game-v1'
  &&profile.gameId===plan.gameId&&profile.oldPlanHash===hash(plan)&&!profile.legacyImport
  &&profile.completePreserved===0&&profile.abandonedAttempts===0&&plan.target===300000
  &&profile.createdAt<=now()&&now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000
  &&/^[a-f0-9]{40}$/.test(commit)&&/^\d+:1$/.test(run),'EMPTY_CANDIDATE_SCOPE');
 await boundary();
 const campaign=(await store.get('state','campaign'))?.value,g=campaign?.games.find(g=>g.game_id===plan.gameId);
 assert(campaign&&hash(campaign)===spec.campaignHash&&campaign.activeGame===profile.fromGameId
  &&g?.status==='needs-adapter'&&g.baseline===0&&g.confirmed===0&&!g.pendingReview,'EMPTY_CANDIDATE_CAMPAIGN');
 const absent=async()=>{
  assert(!(await store.get('state','pool:'+plan.trialId))&&(await store.getMany('state',Array.from({length:100},(_,i)=>`batch:${plan.trialId}:${i+1}`))).every(r=>!r),'EMPTY_CANDIDATE_STATE_EXISTS');
  assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:0})).length===0,'EMPTY_CANDIDATE_RECORDS_EXIST');
  for(const prefix of ['receipt:','demo-generation:','retired-demo:','import-parked-demo:','next-demo-game:','abandoned-demo:'])
   assert((await transport.request('scan',{collection:'journal',key:prefix+plan.trialId+':'})).length===0,'EMPTY_CANDIDATE_HISTORY_EXISTS');
 };
 await absent();assert(!(await store.get('journal',key+':before')),'EMPTY_CANDIDATE_ALREADY_STARTED');
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===spec.campaignHash,'EMPTY_CANDIDATE_SCENE_CHANGED');
 const save=async(c,k,v)=>{await store.create(c,k,v,{immutable:true});assert(hash((await store.get(c,k))?.value)===hash(v),'EMPTY_CANDIDATE_READBACK');};
 await save('journal',key+':before',{schema:'sg-empty-demo-candidate-before-v1',campaign,plan,profileHash:hash(profile),commit,run,at:now()});
 await absent();await save('state','pool:'+plan.trialId,stagedEmptyCandidatePool(plan,profile));
 // Preserve the closed source's exact campaign proof until final rollover.
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===spec.campaignHash,'EMPTY_CANDIDATE_SCENE_CHANGED');
 const result={schema:'sg-empty-demo-candidate-complete-v1',profileHash:hash(profile),planHash:hash(plan),commit,run,sourceRequests:0,newBetAllowance:0,historicalCredit:0};
 await save('journal',key+':complete',result);return result;
}
