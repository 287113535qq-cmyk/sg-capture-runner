import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {preparedSettledHistory} from './prepared-settled-history.mjs';
import {bindPreparedCountPlan} from './prepared-count-plan-binding.mjs';

// The retired count ledger and its immutable full readbacks are inherited.
// Gameplay classification and the old interrupted session are never replayed.
export async function reviewPreparedCountRepairScene({store,base,publication,plans,group,readEvidence,parent,now=Date.now}){
 assert(parent&&/^[a-f0-9]{64}$/.test(parent.activation??'')&&/^[a-f0-9]{40}$/.test(parent.sourceCommit??'')
  &&/^\d+:1$/.test(parent.sourceRun??'')&&/^[a-f0-9]{64}$/.test(parent.specHash??'')
  &&['shared','parked','prepared'].some(kind=>parent.closureKey===`count-${kind}-close:${base.trialId}:${parent.sourceRun}:complete`),
  'PREPARED_REPAIR_PARENT');
 const row=publication.inventory.tasks.find(t=>t.gameId===base.gameId&&t.status==='prepared');
 const selector=publishedPreparedSelector({publication,plans,readEvidence});
 assert(row?.failureEvidenceHash&&await selector({group,readyGameIds:[base.gameId]})===base.gameId,
  'PREPARED_COUNT_PROOF_REQUIRED');
 const get=async(c,k)=>(await store.get(c,k))?.value;
 const campaign=await get('state','campaign'),pool=await get('state','pool:'+base.trialId);
 const game=campaign?.games.find(g=>g.game_id===base.gameId);
 assert(campaign?.enabled&&campaign.activeGame==null&&game?.status==='parked-protocol'
  &&pool?.enabled===false&&pool.failure==='PROTOCOL_VALIDATION_FAILED','PREPARED_REPAIR_SCENE');
 const originalSpec=await get('journal',`complete-count:${base.trialId}:${parent.activation}`);
 const oldPlan=bindPreparedCountPlan({base,activation:parent.activation,spec:originalSpec,read:readEvidence});
 const spec=await loadCountPermission({store,plan:oldPlan,pool,commit:parent.sourceCommit});
 assert(hash(spec)===parent.specHash&&spec.maxSequence===600000,'PREPARED_REPAIR_SPEC');
 const permit=await get('journal',`count-run:${base.trialId}:${parent.sourceRun}`);
 assert(permit?.schema==='sg-count-run-v1'&&permit.activation===spec.activation&&permit.profileHash===spec.profileHash
  &&permit.commit===parent.sourceCommit&&permit.run===parent.sourceRun,'PREPARED_REPAIR_SOURCE_PERMIT');
 const closed=await get('journal',parent.closureKey),repair=await get('state',game.repairKey);
 assert(['sg-count-shared-close-v1','sg-count-parked-close-v1','sg-count-prepared-close-v1'].includes(closed?.schema)
  &&closed.activation===parent.activation&&closed.sourceCommit===parent.sourceCommit&&closed.sourceRun===parent.sourceRun
  &&closed.trialId===base.trialId&&closed.completePreserved===pool.confirmed&&closed.completePreserved<300000
  &&closed.sourceRequests===0&&closed.newBetAllowance===0&&closed.requiresNewSession===true
  &&closed.repairKey===game.repairKey&&closed.retirement===pool.retiredCount
  &&(closed.unknownAttempts??0)===0&&repair?.schema==='sg-game-repair-v1'
  &&repair.gameId===base.gameId&&repair.trialId===base.trialId&&repair.sourceAllowance===0
  &&repair.requiresNewSession===true,'PREPARED_REPAIR_CLOSURE');
 const native=await get('journal',closed.retirement+':complete'),archive=await get('journal',repair.archiveKey);
 assert(native?.schema==='sg-retired-count-result-v1'&&hash(native)===closed.retirementHash
  &&native.completePreserved===pool.confirmed&&native.recordsHash===closed.recordsHash
  &&native.sourceRequests===0&&native.newBetAllowance===0&&archive
  &&row.failureEvidenceHash===hash({repairKey:game.repairKey,repair,archiveHash:hash(archive)}),
  'PREPARED_REPAIR_READBACK');
 const history=await preparedSettledHistory({store,plan:oldPlan,pool,spec,now});
 const batches=[];
 for(let first=1;first<pool.nextBatchId;first+=100){
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>`batch:${base.trialId}:${first+i}`);
  const rows=await store.getMany('state',keys);
  assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===first+i),'PREPARED_REPAIR_BATCH_MISSING');
  batches.push(...rows.map(r=>r.value));
 }
 assert(hash(pool)===hash(await get('state','pool:'+base.trialId))
  &&hash(campaign)===hash(await get('state','campaign')),'PREPARED_REPAIR_SCENE_CHANGED');
 const again=await preparedSettledHistory({store,plan:oldPlan,pool,spec,now});
 assert(hash(again)===hash(history),'PREPARED_REPAIR_HISTORY_CHANGED');
 return {campaign,pool,repair,closed,batches,recordsHash:closed.recordsHash,completePreserved:pool.confirmed,
  preparationProofHash:row.proofHash,failureEvidenceHash:row.failureEvidenceHash,
  parentActivation:spec.activation,parentSpecHash:hash(spec),history,
  sourceRequests:0,newBetAllowance:0};
}
