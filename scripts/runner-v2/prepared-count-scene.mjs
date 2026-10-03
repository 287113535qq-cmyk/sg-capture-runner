import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';

// Read-only, bounded review of an already closed pilot. Classifications and
// natural feature frequencies are not admission gates; flow/settlement are.
export async function reviewPreparedCountScene({store,transport,parser,base,publication,plans,group,readEvidence,now=Date.now}){
 const until=now()+180000;
 const row=publication.inventory.tasks.find(t=>t.gameId===base.gameId&&t.status==='prepared');
 const selector=publishedPreparedSelector({publication,plans,readEvidence});
 assert(row?.failureEvidenceHash&&await selector({group,readyGameIds:[base.gameId]})===base.gameId,
  'PREPARED_COUNT_PROOF_REQUIRED');
 const get=async(c,k)=>(await store.get(c,k))?.value;
 const campaign=await get('state','campaign'),pool=await get('state','pool:'+base.trialId);
 assert(campaign&&(campaign.activeGame==null||campaign.activeGame===base.gameId),
  'PREPARED_COUNT_FOREIGN_ACTIVE_GAME');
 const game=campaign?.games.find(g=>g.game_id===base.gameId),marker=pool?.demoPilotClosed;
 assert(game?.status==='parked-protocol'&&game.repairKey===marker?.repairKey
  &&pool.enabled===false&&pool.failure==='PROTOCOL_VALIDATION_FAILED'&&!pool.countAllocation
  &&Number.isSafeInteger(pool.nextBatchId)&&pool.nextBatchId>1&&pool.nextBatchId<=1001
  &&Object.values(pool.workers??{}).every(w=>w.leaseUntil<=now()),'PREPARED_COUNT_UNSETTLED');
 assert(marker.key.startsWith('closed-demo-pilot:'+base.trialId+':'),'PREPARED_COUNT_CLOSURE_KEY');
 const closed=await get('journal',marker.key+':complete'),repair=await get('state',game.repairKey);
 assert(closed?.sourceRequests===0&&closed.newBetAllowance===0&&closed.trialId===base.trialId
  &&closed.profileHash===marker.profileHash&&closed.repairKey===game.repairKey
  &&repair?.schema==='sg-game-repair-v1'&&repair.gameId===base.gameId&&repair.trialId===base.trialId
  &&repair.sourceAllowance===0&&repair.requiresNewSession===true,'PREPARED_COUNT_CLOSURE');
 const archive=await get('journal',repair.archiveKey);
 assert(archive&&row.failureEvidenceHash===hash({repairKey:game.repairKey,repair,archiveHash:hash(archive)}),
  'PREPARED_COUNT_REPAIR_CHANGED');
 assert((await parser.call({op:'plan',plan:base})).validated===true,'PREPARED_COUNT_PLAN');
 const batches=[],records=[];
 for(let first=1;first<pool.nextBatchId;first+=100){
  const keys=Array.from({length:Math.min(100,pool.nextBatchId-first)},(_,i)=>`batch:${base.trialId}:${first+i}`);
  const rows=await store.getMany('state',keys);
  assert(rows.length===keys.length&&rows.every((r,i)=>r?.value.id===first+i),'PREPARED_COUNT_BATCH_MISSING');
  for(const {value:b} of rows){
   assert(now()<until,'PREPARED_COUNT_REVIEW_DEADLINE');
   assert(!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting&&b.leaseUntil<=now()
    &&b.checkpoint===b.journaled,'PREPARED_COUNT_BATCH_UNSETTLED');
   const count=b.journaled-b.start+1;
   assert(Number.isSafeInteger(count)&&count>=0&&count<=1000,'PREPARED_COUNT_BATCH_COUNT');
   for(let offset=0;offset<count;offset+=100){
    assert(records.length+Math.min(100,count-offset)<=1000&&now()<until,'PREPARED_COUNT_REVIEW_BOUND');
    const receipts=await store.getMany('journal',Array.from({length:Math.min(100,count-offset)},(_,i)=>receiptKey(base.trialId,b.start+offset+i)));
    assert(receipts.length===Math.min(100,count-offset)&&receipts.every((r,i)=>
     r?.value?.gameId===base.gameId&&r.value.trialId===base.trialId
     &&r.value.sequence===b.start+offset+i&&r.value.batchId===b.id&&r.value.shardId===b.worker
     &&r.value.sourceSessionHash===b.sessionHash&&r.value.buy===0
     &&r.value.fixtureOnly===false&&r.value.raw?.fixtureOnly===false),'PREPARED_COUNT_RECORD_MISSING');
    const values=receipts.map(r=>r.value),readbacks=await transport.request('rounds_read',{trialId:base.trialId,ids:values.map(r=>r._id)});
    assert(readbacks.length===values.length&&new Set(readbacks.map(r=>r._id)).size===values.length
     &&values.every(r=>readbacks.some(m=>m._id===r._id&&stable(m)===stable(r))),'PREPARED_COUNT_FULL_READBACK');
    for(const r of values)assert((await parser.call({op:'verify',plan:base,raw:r.raw,record:r})).verified===true,'PREPARED_COUNT_RECORD_INVALID');
    records.push(...values);
   }
   batches.push(b);
  }
 }
 assert(records.length===closed.completePreserved&&records.length<300000
  &&new Set(records.map(r=>r._id)).size===records.length&&hash(records)===closed.recordsHash,'PREPARED_COUNT_BASELINE');
 for(const [worker,w] of Object.entries(pool.workers??{}))if(w.activeBatch){
  const b=batches.find(b=>b.id===w.activeBatch.id);
  assert(b&&b.worker===Number(worker)&&b.start===w.activeBatch.start&&b.end===w.activeBatch.end
   &&b.leaseUntil<=now()&&!b.pending&&!b.pendingOriginal&&!b.bootstrapAwaiting
   &&b.checkpoint===b.journaled,'PREPARED_COUNT_RETIRED_POINTER');
 }
 return {campaign,pool,repair,closed,batches,recordsHash:hash(records),completePreserved:records.length,
  preparationProofHash:row.proofHash,failureEvidenceHash:row.failureEvidenceHash,sourceRequests:0,newBetAllowance:0};
}
