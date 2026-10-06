import test from 'node:test';
import assert from 'node:assert/strict';
import {safeControlError} from './sg-ag-full-control-adapter.mjs';

test('control preserves a safe assertion reason and rejects raw diagnostics',()=>{
 let caught;try{assert(false,'SG_AG_COMPLETED_ORIGINAL_PREFIX_HASH_CHANGED');}catch(error){caught=error;}
 assert.equal(safeControlError(caught),'SG_AG_COMPLETED_ORIGINAL_PREFIX_HASH_CHANGED');
 assert.equal(safeControlError({code:'SG_AG_GAME_BUDGET_EXCEEDED',message:'secret'}),'SG_AG_GAME_BUDGET_EXCEEDED');
 for(const error of [{code:'ERR_ASSERTION',message:'mongodb://private'},Error('SG_SAFE\nsecret'),null])
  assert.equal(safeControlError(error),'SG_AG_OWN_GAME_REVIEW_REQUIRED');
});
