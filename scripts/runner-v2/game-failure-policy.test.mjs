import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdapterGap} from './game-failure-policy.mjs';
test('only explicit known adapter gaps permit game isolation',()=>{
  assert(isAdapterGap('UNSUPPORTED_BEAVER_NESTED_FEATURE'));
  for(const code of ['SOURCE_REJECTED','ACK_UNKNOWN','INVALID_SOURCE_MONEY','ANALYZER_TIMEOUT',
    'UNSUPPORTED_FUTURE_ERROR','UNKNOWN_SOURCE_OUTCOME',undefined])assert.equal(isAdapterGap(code),false);
});
