import test from 'node:test';import assert from 'node:assert/strict';import {failureCode} from './failure-code.mjs';
test('domain assertion codes survive without exporting raw assertion messages',()=>{
 assert.equal(failureCode({code:'ERR_ASSERTION',message:'DEMO_FRESH_BATCH_MISSING'}),'DEMO_FRESH_BATCH_MISSING');
 for(const message of ['secret payload','https://private.invalid/?token=value','SESSION=secret','A'.repeat(81)])assert.equal(failureCode({code:'ERR_ASSERTION',message}),'ERR_ASSERTION');
 assert.equal(failureCode({message:'private'}),'TRIAL_RUN_FAILED');assert.equal(failureCode({code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'}),'SOURCE_NETWORK_OUTCOME_UNKNOWN');
});
