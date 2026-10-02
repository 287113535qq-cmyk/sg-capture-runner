import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {reviewPyramidsRetrigger} from './pyramids-retrigger-review.mjs';
import {pyramidsFreeReview} from './pyramids-free-review.mjs';
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_retrigger_review import retrigger_sample,negative_samples;print(json.dumps({'sample':retrigger_sample(),'negative':negative_samples()}))"],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
test('independent retrigger scope advances all prefixes and synthetic cash terminal without mutation',()=>{
 const before=structuredClone(f.sample);for(let n=1;n<f.sample.steps.length;n++){const p={...f.sample,steps:f.sample.steps.slice(0,n)};assert.equal(reviewPyramidsRetrigger(p).next,'FREE_GAME');assert.equal(reviewPyramidsRetrigger(p).complete,false);}
 assert.equal(reviewPyramidsRetrigger(f.sample).complete,true);assert.deepEqual(f.sample,before);assert.throws(()=>pyramidsFreeReview(f.sample));
});
test('counter jump skipped progress session XML and unknown branches stay rejected',()=>{for(const raw of f.negative)assert.throws(()=>reviewPyramidsRetrigger(raw));});
