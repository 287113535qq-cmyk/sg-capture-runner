const test=require('node:test');const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');const path=require('node:path');
const {prepareNextgenRound}=require('../sg.ingest');
const cwd=path.resolve(__dirname,'../..');
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_retrigger_review import retrigger_sample,negative_samples;from pyramids_fields import PyramidsFields;from test_pyramids_free_review import PLAN;v=retrigger_sample();print(json.dumps({'raw':v,'fields':PyramidsFields(PLAN).settled(v),'negative':negative_samples()}))"],{cwd,encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
test('independent collector and Python agree on the complete retrigger money and mapping',()=>{
 const before=structuredClone(f.raw);assert.equal(f.fields.bonus,8);
 assert.deepEqual(prepareNextgenRound(f.raw,f.fields),f.fields);assert.deepEqual(f.raw,before);
 assert.throws(()=>prepareNextgenRound(f.raw,{...f.fields,bonus:2}),/MAPPING_MISMATCH/);
});
test('collector rejects prefix and every wrong counter XML session and unknown branch',()=>{
 assert.throws(()=>prepareNextgenRound({...f.raw,steps:f.raw.steps.slice(0,3)},f.fields),/INCOMPLETE_ROUND/);
 for(const raw of f.negative)assert.throws(()=>prepareNextgenRound(raw,f.fields));
});
