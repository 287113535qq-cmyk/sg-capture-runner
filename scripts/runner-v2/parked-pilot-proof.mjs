import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Bind an already parked finite pilot to the exact immutable AG archive.
// This is evidence reuse; it neither creates another repair item nor restores
// the campaign's active pointer or source allowance.
export async function reviewParkedPilot({store,plan,scene,binding,allowProgress=false}){
 const {campaign,pool,batches}=scene,generation=hash(pool),key=`game-repair:${plan.trialId}:${generation}`;
 const archiveKey=`parked-v2:${plan.trialId}:${generation}`,game=campaign.games.find(g=>g.game_id===plan.gameId);
 const repair=(await store.get('state',key))?.value,archive=(await store.get('journal',archiveKey))?.value;
 assert(binding?.key===key&&binding.archiveKey===archiveKey&&campaign.activeGame===null
  &&game?.status==='parked-protocol'&&game.repairKey===key
  &&repair?.schema==='sg-game-repair-v1'&&repair.gameId===plan.gameId&&repair.trialId===plan.trialId
  &&repair.archiveKey===archiveKey&&repair.sourceAllowance===0&&repair.requiresNewSession===true
  &&(allowProgress||repair.status==='pending-adapter')&&archive&&hash(archive)===binding.archiveHash
  &&hash(archive.pool)===hash(pool),'AG_CLOSE_PARKED_BINDING');
 const proof={...repair,status:'pending-adapter'};
 assert(hash(allowProgress?proof:repair)===binding.hash,'AG_CLOSE_PARKED_REPAIR_CHANGED');
 const evidence=[];
 for(const worker of Object.values(pool.workers)){
  if(!worker.activeBatch)continue;
  const b=batches.find(x=>x.id===worker.activeBatch.id),k=`${archiveKey}:batch:${worker.activeBatch.id}`;
  assert(b&&hash((await store.get('journal',k))?.value)===hash({batch:b,poolPlanHash:pool.planHash}),'AG_CLOSE_PARKED_BATCH_CHANGED');
  evidence.push({key:k,hash:hash(b)});
 }
 assert(hash(evidence)===hash(archive.evidence)&&hash(evidence)===hash(repair.evidence),'AG_CLOSE_PARKED_EVIDENCE');
 return proof;
}
