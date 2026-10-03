import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {retireDemoPool} from './retire-demo-pool.mjs';
import fs from 'node:fs';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';

export function isPreparedCountParking(plan){
 const registry=JSON.parse(fs.readFileSync('config/prepared-count-authorizations.json','utf8'));
 return Object.hasOwn(registry.profiles,`formal-prepared-count-${plan.gameId}-${plan.countAllocation}.json`);
}

// Finalizer only: the source run has relinquished every lease. Reuse the
// retirement controller for full record readback and closing unused ranges.
// This neither resumes the failed session nor releases a global protection.
export async function closePreparedCountParking({store,transport,gate,parser,control,plan,group,
 campaign,pool,runKey,commit,now=Date.now,retire=retireDemoPool,
 authorization=preparedCountAuthorization(`formal-prepared-count-${plan.gameId}-${plan.countAllocation}.json`)}){
 assert(group==='primary'&&plan.countAllocation&&/^capture-run:\d+:1$/.test(runKey),'PREPARED_PARK_SCOPE');
 const run=runKey.slice('capture-run:'.length),bound=(await store.get('state',runKey))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit});
 assert(authorization.gameId===plan.gameId&&authorization.trialId===plan.trialId
  &&authorization.group===group&&authorization.activation===spec.activation
  &&authorization.profileHash===spec.profileHash,'PREPARED_PARK_AUTHORIZATION');
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${run}`))?.value;
 assert(bound?.gameId===plan.gameId&&permit?.schema==='sg-count-run-v1'
  &&permit.run===run&&permit.commit===commit&&permit.activation===spec.activation
  &&permit.profileHash===spec.profileHash,'PREPARED_PARK_SOURCE_PERMISSION');
 assert(campaign.enabled&&campaign.activeGame===plan.gameId&&!campaign.validationLimit&&!campaign.protocolValidation
  &&campaign.games.find(g=>g.game_id===plan.gameId)?.status==='parking-protocol'
  &&pool.enabled===false&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&pool.drainingProtocol===true
  &&Object.values(pool.workers).every(w=>w.leaseUntil<=now()),'PREPARED_PARK_NOT_IDLE');
 const prefix=`count-prepared-close:${plan.trialId}:${run}`;
 assert(!await store.get('journal',prefix+':before'),'PREPARED_PARK_ALREADY_STARTED');
 // Check all ranges before the first mutation; never truncate to 100 batches.
 for(let first=1;first<pool.nextBatchId;first+=100){
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>`batch:${plan.trialId}:${first+i}`);
  const rows=await store.getMany('state',keys);
  assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===first+i
   &&r.value.leaseUntil<=now()&&!r.value.pending&&!r.value.pendingOriginal&&!r.value.bootstrapAwaiting
   &&r.value.checkpoint===r.value.journaled),'PREPARED_PARK_UNCONFIRMED');
 }
 const boundary=async()=>{
  await control.allowed({newRound:true});await store.writable();
  assert(hash((await store.get('state','campaign'))?.value)===hash(campaign),'PREPARED_PARK_CAMPAIGN_CHANGED');
 };
 const save=async(key,value)=>{
  await store.create('journal',key,value,{immutable:true});
  assert(hash((await store.get('journal',key))?.value)===hash(value),'PREPARED_PARK_READBACK');
 };
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'PREPARED_PARK_POOL_CHANGED');
 await save(prefix+':before',{schema:'sg-count-prepared-before-v1',pool,campaign,permitHash:hash(permit),commit,run,sourceRequests:0});
 const retired=await retire({store,transport,gate,parser,plan,boundary,owner:run,expectedPoolHash:hash(pool),commit,group,now});
 const after=(await store.get('state','pool:'+plan.trialId))?.value;
 assert(retired.schema==='sg-retired-count-result-v1'&&retired.completePreserved===after.confirmed
  &&retired.sourceRequests===0&&retired.newBetAllowance===0&&checkLedger(after,plan,spec).reserved===0
  &&Object.values(after.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'PREPARED_PARK_RETIREMENT');
 const repairKey=`game-repair:${plan.trialId}:${hash(after)}`;
 const closed={schema:'sg-count-prepared-close-v1',trialId:plan.trialId,activation:spec.activation,
  sourceRun:run,sourceCommit:commit,completePreserved:after.confirmed,unknownAttempts:0,
  retirement:after.retiredCount,retirementHash:hash(retired),recordsHash:retired.recordsHash,repairKey,
  sourceRequests:0,newBetAllowance:0,requiresNewSession:true,group};
 await store.create('state',repairKey,{schema:'sg-game-repair-v1',gameId:plan.gameId,trialId:plan.trialId,
  status:'pending-adapter',archiveKey:prefix+':before',evidence:[{key:after.retiredCount+':complete',hash:hash(retired)}],
  sourceAllowance:0,requiresNewSession:true});
 await boundary();
 await store.update('state','campaign',v=>{
  assert(hash(v)===hash(campaign),'PREPARED_PARK_CAMPAIGN_CHANGED');
  const game=v.games.find(g=>g.game_id===plan.gameId);game.status='parked-protocol';game.repairKey=repairKey;v.activeGame=null;return v;
 });
 await save(prefix+':complete',closed);
 return {action:'wait',preparedCountClosed:true,completePreserved:after.confirmed,sourceRequests:0};
}
