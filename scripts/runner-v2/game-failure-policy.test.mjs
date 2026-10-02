import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdapterGap} from './game-failure-policy.mjs';
test('only explicit known adapter gaps permit game isolation',()=>{
  assert(isAdapterGap('UNSUPPORTED_BEAVER_NESTED_FEATURE'));
  assert(isAdapterGap('HUFF_UNREVIEWED_FEATURE_SLOTS'));
  assert(isAdapterGap('PYRAMIDS_FREE_COIN_PREFIX_ONLY'));
  assert(isAdapterGap('PYRAMIDS_FREE_UNREVIEWED_COIN'));
  assert(isAdapterGap('PYRAMIDS_SUPER_HOLD_PREFIX_ONLY'));
  assert(isAdapterGap('PYRAMIDS_SUPER_HOLD_SCOPE'));
  assert.equal(isAdapterGap('PYRAMIDS_FREE_COIN'),false);
  for(const code of ['HUFF_UNKNOWN_TOUCHUP_FIELD','HUFF_FRAME_EXIT_NOT_ADAPTED',
    'HUFF_COMBINED_EXIT_NOT_ADAPTED','HUFF_TOUCHUP_PROGRESS_NOT_ADAPTED','HARDHAT_FEATURE','HARDHAT_UNREVIEWED',
    'HARDHAT_UNKNOWN_FIELD','HARDHAT_COMBINED_EXIT','HARDHAT_PREVIOUS_SLOTS'])assert(isAdapterGap(code));
  for(const code of ['SOURCE_REJECTED','ACK_UNKNOWN','INVALID_SOURCE_MONEY','ANALYZER_TIMEOUT',
    'UNSUPPORTED_FUTURE_ERROR','PYRAMIDS_SUPER_HOLD_FLAG','PYRAMIDS_SUPER_HOLD_MONEY','UNKNOWN_SOURCE_OUTCOME','HUFF_SETTLEMENT_MISMATCH',
    'HUFF_INVALID_FRAME_AWARDS','SESSION_CHANGED_MID_ROUND','HARDHAT_MONEY','HARDHAT_BALANCE','HARDHAT_COUNTER',
    'HARDHAT_XML','HARDHAT_SESSION','HARDHAT_TIMING','HARDHAT_FRAME_EXIT',undefined])assert.equal(isAdapterGap(code),false);
});
