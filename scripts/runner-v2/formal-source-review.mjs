import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {loadCountPermission,auditCountBatch} from './complete-count.mjs';

// Read-only prerequisite for switching away from a fully audited or explicitly
// retired count pool. This check never issues a source or writes a state row.
export async function reviewFormalSource({store,plan,profile,scene,now=Date.now}){
 const ref=profile.sourceFormal;
 assert(ref?.schema==='sg-formal-source-boundary-v1'&&plan.countAllocation&&!plan.demoGeneration
  &&ref.planHash===hash(plan)&&/^[a-f0-9]{40}$/.test(ref.commit??'')
  &&['complete','retired'].includes(ref.kind),'FORMAL_SOURCE_SCOPE');
 const {campaign,fromPool:pool,sourceBatches:batches}=scene;
 assert(campaign.activeGame===null&&!campaign.audit&&!campaign.protocolValidation&&!campaign.validationLimit
  &&hash(campaign)===ref.campaignHash&&hash(pool)===ref.poolHash&&pool.planHash===hash(plan)
  &&pool.countAllocation?.reserved===0&&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=now()),'FORMAL_SOURCE_UNSETTLED');
 const spec=await loadCountPermission({store,plan,pool,commit:ref.commit});
 assert(hash(spec)===ref.specHash&&/^\d+:1$/.test(ref.run??''),'FORMAL_SOURCE_SPEC');
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${ref.run}`))?.value;
 assert(permit?.schema==='sg-count-run-v1'&&permit.run===ref.run&&permit.commit===ref.commit
  &&permit.activation===spec.activation&&permit.profileHash===spec.profileHash&&hash(permit)===ref.runPermitHash,'FORMAL_SOURCE_RUN_PERMISSION');
 const game=campaign.games.find(g=>g.game_id===plan.gameId),proof=(await store.get('journal',ref.proofKey))?.value;
 assert(proof&&hash(proof)===ref.proofHash,'FORMAL_SOURCE_PROOF');
 if(ref.kind==='complete'){
  assert(ref.proofKey===`game-audit:${plan.trialId}`&&game?.status==='complete'&&game.confirmed===plan.target
   &&game.baseline+plan.target===300000&&pool.confirmed===plan.target&&!pool.failure
   &&proof.trialId===plan.trialId&&proof.planHash===hash(plan)&&proof.fullReadback===plan.target
   &&/^[a-f0-9]{64}$/.test(proof.recordsHash??''),'FORMAL_SOURCE_INCOMPLETE');
 }else{
  const repair=(await store.get('state',proof.repairKey))?.value;
  assert(game?.status==='parked-protocol'&&game.repairKey===proof.repairKey&&!pool.enabled
   &&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&proof.schema==='sg-formal-stopped-retire-v1'
   &&proof.trialId===plan.trialId&&proof.sourceCommit===ref.commit&&proof.completePreserved===pool.confirmed
   &&proof.sourceRequests===0&&proof.newBetAllowance===0&&repair?.sourceAllowance===0
   &&repair.requiresNewSession===true&&hash(repair)===ref.repairHash,'FORMAL_SOURCE_RETIREMENT');
  const retired=(await store.get('journal',pool.retiredCount+':complete'))?.value;
  assert(retired?.schema==='sg-retired-count-result-v1'&&retired.completePreserved===pool.confirmed
   &&retired.sourceRequests===0&&retired.newBetAllowance===0,'FORMAL_SOURCE_RETIREMENT');
 }
 assert(Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&batches.length===pool.nextBatchId-1,'FORMAL_SOURCE_BATCHES');
 const cache=new Map();let count=0;
 for(let offset=0;offset<batches.length;offset+=100){
  const page=batches.slice(offset,offset+100);
  const current=await store.getMany('state',page.map(b=>`batch:${plan.trialId}:${b.id}`));
  assert(current.length===page.length&&current.every((r,i)=>r&&hash(r.value)===hash(page[i])),'FORMAL_SOURCE_BATCH_CHANGED');
  const settlementKeys=page.filter(b=>b.id>spec.baselineBatchCount&&spec.sessionRotation==='closed-batches-v1').map(b=>pool.countAllocation.batches[b.id]?.settlementKey);
  assert(settlementKeys.every(k=>typeof k==='string'),'FORMAL_SOURCE_SETTLEMENT_KEY');
  if(settlementKeys.length){
   const receipts=await store.getMany('journal',settlementKeys);
   assert(receipts.length===settlementKeys.length&&receipts.every(Boolean),'FORMAL_SOURCE_SETTLEMENT_MISSING');
   receipts.forEach((r,i)=>cache.set('journal/'+settlementKeys[i],r.value));
  }
  for(const [i,b]of page.entries()){ 
   assert(b.id===offset+i+1&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
    &&b.leaseUntil<=now()&&b.checkpoint===b.journaled&&pool.countAllocation.batches[b.id]?.closed,'FORMAL_SOURCE_BATCH_UNSETTLED');
   cache.set(`batch:${plan.trialId}:${b.id}`,b);
   await auditCountBatch({store,pool,plan,spec,record:{batchId:b.id},cache});
   count+=b.journaled-b.start+1;
  }
  cache.clear();
 }
 assert(count===pool.confirmed&&hash((await store.get('state','campaign'))?.value)===ref.campaignHash
  &&hash((await store.get('state','pool:'+plan.trialId))?.value)===ref.poolHash,'FORMAL_SOURCE_CHANGED');
 return {kind:ref.kind,completePreserved:count,sourceRequests:0,newBetAllowance:0,proofHash:ref.proofHash};
}

export async function readPoolBatches(store,plan,pool,{limit=600001}={}){
 assert(pool&&Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>=1&&pool.nextBatchId<=limit,'POOL_BATCH_BOUND');
 const result=[];
 for(let start=1;start<pool.nextBatchId;start+=100){
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-start)},(_,i)=>`batch:${plan.trialId}:${start+i}`);
  const rows=await store.getMany('state',keys);assert(rows.length===keys.length&&rows.every(Boolean),'POOL_BATCH_MISSING');
  result.push(...rows.map(r=>r.value));
 }
 return result;
}
