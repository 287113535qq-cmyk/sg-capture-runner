import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
const py=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_quarterback_pick import pick_sample,PLAN;from quarterback_fields import QuarterbackFields;print(json.dumps([{'raw':r,'fields':QuarterbackFields(PLAN).settled(r)} for r in [pick_sample(),pick_sample(True),pick_sample(omit=True)]]))"],{encoding:'utf8'});
assert.equal(py.status,0,py.stderr);const cases=JSON.parse(py.stdout);
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
test('Pick A Ball independent mirrors and separate mapping agree, including END counter omission',()=>{
  for(const {raw,fields} of cases){
    const mapping=roundMapping(raw,'base',{foam:'old-foam',pickBall:fields.typeMappingHash});
    assert.equal(mapping.bonus,3);assert.equal(mapping.typeMappingHash,fields.typeMappingHash);
    assert.deepEqual(prepareNextgenRound(raw,mapping),fields);
    const expected=[{MSGID:'BET'},{MSGID:'FEATURE_START',CFG:'1'},{MSGID:'FEATURE_PICK',CFG:'1',FP:'0|1|1'},{MSGID:'FEATURE_END',CFG:'1'},null];
    for(let i=0;i<=4;i++)assert.deepEqual(nextRequest({...raw,steps:raw.steps.slice(0,i)}),expected[i]);
    assert.throws(()=>roundMapping(raw,'base','old-foam'));
  }
});
test('no prize-driven choice, other menu option, extra pick or replayed BET',()=>{
  for(const fp of ['0|1|0','0|1|2','0|1|3','0|2|1','1|1|1','0|1|800']){
    const raw=structuredClone(cases[0].raw);raw.steps[2].requestPayload=raw.steps[2].requestPayload.replace('0|1|1',fp);
    assert.throws(()=>nextRequest(raw));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:'x'}));
  }
  const raw=structuredClone(cases[0].raw);raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(/&GSD=.*/,'&GSD=featureData~99999');
  assert.equal(nextRequest({...raw,steps:raw.steps.slice(0,2)}).FP,'0|1|1');
});
test('Foam stack, subsequent free, other feature counters and partial END never settle',()=>{
  for(const suffix of ['&NFR_2=1','&NFG=1','&CFG=2']){
    const raw=structuredClone(cases[2].raw);raw.steps.at(-1).responsePayload+=suffix;
    assert.throws(()=>nextRequest(raw));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:'x'}));
  }
  for(const fid of ['1|2|','2|','0|1|']){
    const raw=structuredClone(cases[0].raw);raw.steps.at(-1).responsePayload=raw.steps.at(-1).responsePayload.replace('FID=1|','FID='+fid);
    assert.throws(()=>nextRequest(raw));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:'x'}));
  }
});
