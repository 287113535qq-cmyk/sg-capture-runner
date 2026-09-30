import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Explicit retirement-only evidence for the already observed null decoration.
// This never overwrites either the old settlement receipt or the stored batch.
export function reviewClosedBatchDecoration(batch,receipt,proof){
 const old=receipt?.batch;
 assert(proof?.schema==='sg-closed-batch-null-decoration-v1'&&proof.batchId===batch.id
  &&proof.currentHash===hash(batch)&&proof.settledHash===hash(old)
  &&receipt.fullReadback===true&&old.pending===null&&old.leaseUntil===0
  &&old.checkpoint===old.journaled&&!old.pendingOriginal&&!old.protocolResume
  &&!Object.hasOwn(old,'pendingOriginal')&&!Object.hasOwn(old,'protocolResume')
  &&batch.pendingOriginal===null&&batch.protocolResume===null,'COUNT_NULL_DECORATION_SCOPE');
 const restored={...batch};delete restored.pendingOriginal;delete restored.protocolResume;
 assert(hash(restored)===hash(old),'COUNT_NULL_DECORATION_CHANGED');
 return old;
}
