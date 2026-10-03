import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';

export async function admitPreparedCountRun({store,base,plan,profile,publication,plans,readEvidence,
 boundary,commit,run,now=Date.now}){
 await boundary();
 const pool=(await store.get('state','pool:'+plan.trialId))?.value;
 const campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
 const row=publication.inventory.tasks.find(t=>t.gameId===plan.gameId);
 const selector=publishedPreparedSelector({publication,plans,readEvidence});
 assert(row?.proofHash===profile.preparationProofHash&&row.failureEvidenceHash===profile.failureEvidenceHash
  &&await selector({group:profile.group,readyGameIds:[base.gameId]})===base.gameId,'PREPARED_COUNT_PROOF_REQUIRED');
 assert(pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target
  &&Object.values(pool.workers??{}).every(w=>!w.activeBatch&&w.leaseUntil<=now())
  &&campaign.enabled&&!campaign.validationLimit&&!campaign.protocolValidation
  &&campaign.formalCount?.activation===profile.activation
  &&(campaign.activeGame==null||campaign.activeGame===base.gameId)
  &&campaign.games.find(g=>g.game_id===base.gameId)?.status==='ready','PREPARED_COUNT_NOT_READY');
 const key=`count-run:${plan.trialId}:${run}`;
 assert(!(await store.get('journal',key)),'PREPARED_COUNT_RUN_ALREADY_ADMITTED');
 const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,
  poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,
  preparationProofHash:profile.preparationProofHash,createdAt:now(),expiresAt:now()+270*60000};
 // Selection alone grants no source permission; the exact run permit is last.
 await store.update('state','campaign',value=>{
  assert(hash(value)===hash(campaign),'PREPARED_COUNT_CAMPAIGN_CHANGED');return {...value,activeGame:base.gameId};
 });
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'PREPARED_COUNT_POOL_CHANGED');
 await store.create('journal',key,permit,{immutable:true});
 assert(hash((await store.get('journal',key))?.value)===hash(permit),'PREPARED_COUNT_RUN_READBACK');
 return {admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0};
}
