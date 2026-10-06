import assert from 'node:assert/strict';
import {queueHash} from './sg-queue-profile.mjs';
import {inspectParticipant} from './sg-federation.mjs';
import {waitForEndedLeases} from './sg-ended-leases.mjs';
import {isBusinessDriverFailure} from './sg-ag-once-mongo.mjs';

export const SOURCE_ENDING_RESERVE_MS=5*60000;
const reason=error=>[error?.message,error?.code].find(v=>/^[A-Z][A-Z0-9_]{1,119}$/.test(v??''))??'SG_AG_BUSINESS_REVIEW_REQUIRED';

// This deadline reserve belongs only to the source finalizer. Once it expires,
// no new business operation may pass RunnerState.writable(). Restoring the
// original deadline below authorizes only source ending metadata, never another
// reconciliation or replay of a business intent.
export async function withSourceEndingReserve({store,deadline,now=Date.now,reconcile}){
 const original=store.deadline;
 assert(Number.isFinite(original)&&Number.isFinite(deadline),'SG_AG_FINALIZER_DEADLINE');
 store.deadline=Math.min(original,deadline-SOURCE_ENDING_RESERVE_MS);
 try{
  assert(now()<store.deadline,'SG_AG_FINALIZER_BUSINESS_DEADLINE');
  return await reconcile();
 }finally{store.deadline=original;}
}

function endingGames(profile,results,failure){
 assert(Array.isArray(results),'SG_AG_FINALIZER_RESULTS');
 const ids=new Set(profile.payload.games.map(g=>g.gameId)),byId=new Map();
 for(const row of results){
  assert(row&&ids.has(row.gameId)&&!byId.has(row.gameId),'SG_AG_FINALIZER_RESULT_IDENTITY');
  const count=row.count??0,status=row.status??(count===300000?'complete':'retained');
  assert(Number.isSafeInteger(count)&&count>=0&&count<=300000&&typeof status==='string'
   &&/^[a-z][a-z-]{0,39}$/.test(status)&&(status!=='complete'||count===300000),'SG_AG_FINALIZER_RESULT_VALUE');
  byId.set(row.gameId,{gameId:row.gameId,status,count,...(row.reason?{reason:reason({message:row.reason})}:{})});
 }
 return profile.payload.games.map(({gameId})=>byId.get(gameId)??{
  gameId,status:'retained',count:0,countKnown:false,reason:failure??'SG_AG_BUSINESS_RESULT_UNKNOWN'});
}

// Closing an ended source window and completing business delivery are separate
// facts. Business faults preserve all per-game state and durable intents. They
// may release only this source fence, after fresh independent source evidence.
// Native metadata unknowns never authorize an ending or a retry of its CAS.
export async function finalizeEndedSource({profile,store,transport,run,commit,sourceJobsEnded,deadline,
 guard,confirmSourceEnded,reconcile,now=Date.now,sleep}){
 assert(sourceJobsEnded===true,'SG_AG_SOURCE_JOBS_ACTIVE');
 assert(typeof guard==='function'&&typeof confirmSourceEnded==='function'&&typeof reconcile==='function',
  'SG_AG_FINALIZER_PORTS');
 const healthy=()=>{
  const status=transport.status();
  assert(status&&status.closed===false&&status.poison===null,'SG_AG_SOURCE_METADATA_UNHEALTHY');
  assert(now()<deadline,'SG_AG_FINALIZER_DEADLINE');
 };
 const source=async()=>{
  healthy();await guard();healthy();
  const row=await store.get('state','rolling-source'),value=row?.value;
  assert(row?._id==='primary/rolling-source'&&Number.isSafeInteger(row.version)&&row.version>=0
   &&value?.owner===run&&value.status==='running'&&value.queueId===profile.payload.queueId
   &&value.activation===profile.activation&&value.commit===commit,'SG_AG_SOURCE_FENCE');
  const permit=(await store.get('journal','rolling-activation:'+profile.activation+':complete'))?.value;
  assert(permit?.schema==='sg-ag-rolling-permit-v1'&&permit.queueId===profile.payload.queueId
   &&permit.run===run&&permit.commit===commit&&permit.activation===profile.activation
   &&permit.profileHash===queueHash(profile)&&Number.isFinite(permit.startsAt)&&permit.startsAt<=now()
   &&Number.isFinite(permit.expiresAt),'SG_AG_SOURCE_PERMISSION');
  healthy();return row;
 };
 const ended=async()=>{
  healthy();const proof=await confirmSourceEnded();healthy();
  assert(proof?.sourceJobsEnded===true,'SG_AG_SOURCE_JOBS_ACTIVE');
  if(profile.federation)inspectParticipant({profile,receipt:proof.participant,coordinatorRun:run,commit});
  return proof;
 };
 const initialEnded=await ended(),before=await source();
 await waitForEndedLeases({profile,store,sourceJobsEnded:true,deadline,guard,now,sleep});
 let results=[],businessFailure;
 try{results=await withSourceEndingReserve({store,deadline,now,reconcile});}
 catch(error){
  healthy();
  if(error?.outcomeUnknown===true&&!isBusinessDriverFailure(error))throw error;
  businessFailure=reason(error);
 }
 // No business callback runs after its deadline is restored. Re-read GitHub,
 // the exact participant and every lease even if the business failure looked
 // deterministic; neither cached jobs nor a healthy Mongo client proves this.
 const finalEnded=await ended();
 if(profile.federation)assert(queueHash(initialEnded.participant)===queueHash(finalEnded.participant),'SG_AG_ENDED_PARTICIPANT_CHANGED');
 await waitForEndedLeases({profile,store,sourceJobsEnded:true,deadline,guard,now,sleep,waitForExpiry:false});
 const fresh=await source();
 assert(fresh.version===before.version&&queueHash(fresh.value)===queueHash(before.value),'SG_AG_SOURCE_FENCE_CHANGED');
 const games=endingGames(profile,results,businessFailure);
 const result={schema:'sg-ag-rolling-window-ended-v1',queueId:profile.payload.queueId,run,commit,
  activation:profile.activation,profileHash:queueHash(profile),
  complete:games.filter(r=>r.status==='complete'&&r.count===300000).length,
  retained:games.filter(r=>r.status!=='complete'||r.count!==300000).length,games,sourceRequests:0,
  sourceJobsEnded:true,leasesGone:true,...(businessFailure?{businessFailure}:{}),
  ...(profile.federation?{federationHash:queueHash(profile.federation),participant:finalEnded.participant}:{})};
 const key='rolling-ended:'+profile.payload.queueId+':'+run;
 healthy();await store.create('journal',key,result,{immutable:true});
 assert(queueHash((await store.get('journal',key))?.value)===queueHash(result),'SG_AG_ENDED_FULL_READBACK');
 const last=await source();
 assert(last.version===fresh.version&&queueHash(last.value)===queueHash(fresh.value),'SG_AG_SOURCE_FENCE_CHANGED');
 const idle={owner:null,queueId:null,status:'idle',lastRun:run,lastQueueId:profile.payload.queueId,endedProofHash:queueHash(result)};
 healthy();assert(await store.cas('state','rolling-source',last,idle),'SG_AG_SOURCE_FENCE');
 const saved=await store.get('state','rolling-source');healthy();
 assert(saved?._id==='primary/rolling-source'&&saved.version===last.version+1&&queueHash(saved.value)===queueHash(idle),'SG_AG_SOURCE_IDLE_FULL_READBACK');
 return result;
}
