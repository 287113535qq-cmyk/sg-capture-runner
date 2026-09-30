import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdapterGap} from './game-failure-policy.mjs';
test('only explicit known adapter gaps permit game isolation',()=>{
  assert(isAdapterGap('UNSUPPORTED_BEAVER_NESTED_FEATURE'));
  for(const code of ['HUFF_UNKNOWN_TOUCHUP_FIELD','HUFF_FRAME_EXIT_NOT_ADAPTED',
    'HUFF_COMBINED_EXIT_NOT_ADAPTED','HUFF_TOUCHUP_PROGRESS_NOT_ADAPTED'])assert(isAdapterGap(code));
  for(const code of ['SOURCE_REJECTED','ACK_UNKNOWN','INVALID_SOURCE_MONEY','ANALYZER_TIMEOUT',
    'UNSUPPORTED_FUTURE_ERROR','UNKNOWN_SOURCE_OUTCOME','HUFF_SETTLEMENT_MISMATCH',
    'HUFF_INVALID_FRAME_AWARDS','SESSION_CHANGED_MID_ROUND',undefined])assert.equal(isAdapterGap(code),false);
});
