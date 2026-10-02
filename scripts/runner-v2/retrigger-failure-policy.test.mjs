import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewedAdapterFailure,isAdapterGap} from './game-failure-policy.mjs';
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_retrigger_review import retrigger_sample,negative_samples;print(json.dumps({'sample':retrigger_sample(),'negative':negative_samples()}))"],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
test('validated unfinished retrigger isolates only the affected game without modifying evidence',()=>{
 const prefix={...f.sample,steps:f.sample.steps.slice(0,3)},before=structuredClone(prefix);
 const code=reviewedAdapterFailure('PYRAMIDS_FREE_COUNTERS',prefix);
 assert.equal(code,'PYRAMIDS_RETRIGGER_NOT_ADAPTED');assert(isAdapterGap(code));
 assert.deepEqual(prefix,before);
 assert.equal(reviewedAdapterFailure('PYRAMIDS_FREE_COUNTERS',f.sample),'PYRAMIDS_FREE_COUNTERS');
 assert.equal(reviewedAdapterFailure('PYRAMIDS_MONEY',prefix),'PYRAMIDS_MONEY');
});
test('bad XML session counters and unreviewed features keep shared protection',()=>{
 for(const raw of f.negative)assert.equal(reviewedAdapterFailure('PYRAMIDS_FREE_COUNTERS',raw),'PYRAMIDS_FREE_COUNTERS');
 assert.equal(reviewedAdapterFailure('PYRAMIDS_FREE_COUNTERS',{steps:[]}),'PYRAMIDS_FREE_COUNTERS');
 assert(!isAdapterGap('PYRAMIDS_FREE_COUNTERS'));
});
