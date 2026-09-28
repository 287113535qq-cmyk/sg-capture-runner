import assert from 'node:assert/strict';

export function reviewFrozenBatch(batch,migration){
  assert(Number.isInteger(batch.id) && Number.isInteger(batch.start) && batch.end>=batch.start);
  assert(batch.checkpoint>=batch.start-1 && batch.checkpoint<=batch.journaled && batch.journaled<=batch.end);
  assert(batch.leaseUntil===0 && batch.owner===null,'ACTIVE_FROZEN_BATCH');
  const pending=batch.pendingOriginal;
  if(pending){
    assert(typeof pending.awaiting==='string' && pending.awaiting.length>0,'NATURAL_FEATURE_MUST_NOT_BE_DISCARDED');
    assert(pending.sequence===batch.journaled+1,'PENDING_NOT_NEXT_SEQUENCE');
    assert(migration.pendingEvidence.some(x=>x.batchId===batch.id && x.worker===batch.worker && x.sequence===pending.sequence),'PENDING_NOT_IN_PROOF');
    assert(pending.raw?.fixtureOnly===false && Array.isArray(pending.raw.steps),'PENDING_RAW_REQUIRED');
  }
  return batch.journaled-batch.start+1;
}
