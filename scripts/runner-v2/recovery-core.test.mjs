import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFrozenBatch} from './recovery-core.mjs';
test('only the frozen unknown attempt is abandonable; natural continuation stays held',()=>{
  const b={id:5,worker:37,start:401,end:500,checkpoint:409,journaled:411,leaseUntil:0,owner:null,
    pendingOriginal:{sequence:412,awaiting:'MSGID=BET',raw:{fixtureOnly:false,steps:[]}}};
  const proof={pendingEvidence:[{batchId:5,worker:37,sequence:412}]};
  assert.equal(reviewFrozenBatch(b,proof),11);
  assert.throws(()=>reviewFrozenBatch({...b,pendingOriginal:{...b.pendingOriginal,awaiting:null}},proof),/NATURAL_FEATURE_MUST_NOT_BE_DISCARDED/);
  assert.throws(()=>reviewFrozenBatch(b,{pendingEvidence:[]}),/PENDING_NOT_IN_PROOF/);
  assert.throws(()=>reviewFrozenBatch({...b,owner:'other'},proof),/ACTIVE_FROZEN_BATCH/);
  assert.throws(()=>reviewFrozenBatch({...b,pendingOriginal:{...b.pendingOriginal,sequence:413}},proof),/PENDING_NOT_NEXT_SEQUENCE/);
});
