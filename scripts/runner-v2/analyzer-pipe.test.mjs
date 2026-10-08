import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {analyzer} from './analyzer.mjs';
import {rhinoFixture} from '../trial/rhino-fixture.mjs';

for(const auditWorkers of [1,2])test(`real Python pipes (${auditWorkers}) verify every page and reject corrupt tail without losing the next request`,async()=>{
 const parser=analyzer({python:process.env.PYTHON||'python3',auditWorkers});
 try{
  const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json'))['32799'],raw=rhinoFixture(0),records=[];
  // Derive fields with Python, including its original numeric representation.
  const derived=spawnSync(process.env.PYTHON||'python3',['-c',
   "import sys,json;sys.path.insert(0,'service');from rhino_fields import RhinoFields;x=json.load(sys.stdin);print(json.dumps(RhinoFields(x['plan']).settled(x['raw'])))"],
   {input:JSON.stringify({plan,raw}),encoding:'utf8'});
  assert.equal(derived.status,0);const normalized=JSON.parse(derived.stdout);
  for(let sequence=1;sequence<=3;sequence++)records.push(await parser.call({op:'record',plan,raw,normalized,
   sequence,attempt:'synthetic-pipe',sessionHash:'a'.repeat(64),worker:0,batchId:1}));
  assert.deepEqual(await parser.verifyPage(plan,records),{verified:true,count:3});
  const bad=structuredClone(records);bad[2].contentHash='0'.repeat(64);
  await assert.rejects(parser.verifyPage(plan,bad));
  assert.deepEqual(await parser.verifyPage(plan,records),{verified:true,count:3});
 }finally{assert.deepEqual(await parser.closeAndWait(),{childClosed:true,auditChildClosed:true});}
});

test('two real parsers are independent and each reports actual close before its slot is reusable',async()=>{
 const a=analyzer({python:process.env.PYTHON||'python3'}),b=analyzer({python:process.env.PYTHON||'python3'});
 try{
  const rejected=await Promise.allSettled([a.call({op:'unknown-own-operation'}),b.call({op:'unknown-own-operation'})]);
  assert(rejected.every(r=>r.status==='rejected'));
  assert.deepEqual(await a.closeAndWait(),{childClosed:true,auditChildClosed:true});
  await assert.rejects(b.call({op:'unknown-own-operation'}),e=>e.code!=='ANALYZER_CLOSED');
  const first=b.closeAndWait(),second=b.closeAndWait();assert.equal(first,second);await first;
 }finally{await Promise.allSettled([a.closeAndWait(),b.closeAndWait()]);}
});
