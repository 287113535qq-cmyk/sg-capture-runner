import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path,{delimiter} from 'node:path';
import {pyramidsMapping,pyramidsNextRequest} from './pyramids-protocol.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const python=process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const fixture=spawnSync(python,['-c',"import json; from test_pyramids_coin_review import coin_sample; from test_pyramids_free_review import PLAN; from pyramids_fields import PyramidsFields; from pyramids_coin_review import EXTENSION; from round_fields import type_profile; raws=[coin_sample(x) for x in (-4,-3,-2)]; print(json.dumps({'raws':raws,'normalized':[PyramidsFields(PLAN).settled(x) for x in raws],'coinHash':type_profile(EXTENSION)[1]}))"],{encoding:'utf8',env:{...process.env,PYTHONPATH:['service','service/tests'].join(delimiter),PYTHONUTF8:'1'}});
assert.equal(fixture.status,0,fixture.stderr);const {raws,normalized,coinHash}=JSON.parse(fixture.stdout);
test('Python Runner collector original XML normalization agrees with distinct coin mapping',()=>{
 raws.forEach((raw,i)=>{const before=structuredClone(raw),mapping=pyramidsMapping(raw,'a'.repeat(64),{coins:coinHash});assert.deepEqual(mapping,{buy:0,bonus:9,typeMappingHash:coinHash});assert.deepEqual(prepareNextgenRound(raw,mapping),normalized[i]);assert.equal(pyramidsNextRequest(raw),null);assert.deepEqual(raw,before);});
});
test('capture entry continues unfinished coin prefixes without replay or premature mapping',()=>{
 for(const raw of raws)for(const count of [1,3,15,20]){
  const prefix={...raw,steps:raw.steps.slice(0,count)};assert.deepEqual(pyramidsNextRequest(prefix),{MSGID:'FREE_GAME'});
  assert.throws(()=>pyramidsMapping(prefix,'a'.repeat(64),{coins:coinHash}),/INCOMPLETE/);
  assert.throws(()=>prepareNextgenRound(prefix,{buy:0,bonus:9,typeMappingHash:coinHash}),/INCOMPLETE|COIN_REQUIRED/);
 }
});
test('old mapping cannot absorb new coin scope and XML or account evidence cannot be replaced',()=>{
 for(const raw of raws){assert.throws(()=>pyramidsMapping(raw,'a'.repeat(64),{retrigger:coinHash,major:coinHash}),/MAPPING_REQUIRED/);assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:8,typeMappingHash:coinHash}),/MAPPING_MISMATCH/);}
 for(const mutate of [r=>{r.steps[1].responseXml=r.steps[0].responseXml;},r=>{r.steps[1].responseBalance=99999;},r=>{r.steps[1].requestPayload=r.steps[1].requestPayload.replace('gdmgcmoffline-pyramids-free','gdmgcmother');}]){
  const raw=structuredClone(raws[0]);mutate(raw);assert.throws(()=>pyramidsMapping(raw,'a'.repeat(64),{coins:coinHash}));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:9,typeMappingHash:coinHash}));
 }
});
