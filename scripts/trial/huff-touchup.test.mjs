import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {analyzer} from '../runner-v2/analyzer.mjs';
const py=process.env.PYTHON||'python3';
const p=spawnSync(py,['-c',`import sys,json
sys.path[:0]=['service','service/tests']
from test_huff_touchup_review import sample,PLAN
from huff_fields import HuffFields
r=sample();r.update(fixtureOnly=False,roundFieldsVersion='sg-round-fields-v1')
print(json.dumps(dict(raw=r,plan=PLAN,fields=HuffFields(PLAN).settled(r))))`],{encoding:'utf8'});
assert.equal(p.status,0,p.stderr);const {raw,plan,fields}=JSON.parse(p.stdout);
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const hashes={hardHat:'a'.repeat(64),touchup:fields.typeMappingHash};
test('real analyzer IPC and Runner follow all Touch Up prefixes; collector matches full normalized record',async()=>{
  const a=analyzer({python:py});try{
    for(let n=0;n<=8;n++){
      const prefix={...raw,steps:raw.steps.slice(0,n)},expected=n===0?{MSGID:'BET'}:n===8?null:{MSGID:'FREE_GAME'};
      assert.deepEqual(nextRequest(prefix),expected);assert.deepEqual(await a.call({op:'next',plan,raw:prefix}),expected);
    }
    assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,'b'.repeat(64),hashes)),fields);
    await assert.rejects(a.call({op:'record',plan,raw:{...raw,steps:raw.steps.slice(0,7)}}),/INCOMPLETE_ROUND/);
  }finally{a.close();}
});
test('unsafe feature exits are rejected by both Runner and collector before normalization',()=>{
  for(const change of [s=>s.replace('FID=2|','FID=2|1|'),s=>s.replace('FRAMEWINS~0|','FRAMEWINS~-100|'),
    s=>s.replace('FEAT~PAINT','FEAT~HOMEIMP'),s=>s.replace('CFGG=6','CFGG=0'),s=>s+'&GCT=1',s=>s+'&FRBAL=1']){
    const bad=structuredClone(raw);bad.steps.at(-1).responsePayload=change(bad.steps.at(-1).responsePayload);
    assert.throws(()=>nextRequest(bad));assert.throws(()=>prepareNextgenRound(bad,{buy:0,bonus:4,typeMappingHash:fields.typeMappingHash}));
  }
  assert.throws(()=>roundMapping(raw,'b'.repeat(64),hashes.hardHat),/HUFF_FEATURE_MAPPING_REQUIRED/);
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:fields.typeMappingHash}),/MAPPING_MISMATCH/);
});
