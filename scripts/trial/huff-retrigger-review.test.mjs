import assert from 'node:assert/strict';import test from 'node:test';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
import {huffNextRequest,huffMapping} from './huff-protocol.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const p=spawnSync(process.env.PYTHON||'python3',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_huff_retrigger import sample;from test_huff_fields import PLAN;from huff_fields import HuffFields;r=sample();print(json.dumps({'raw':r,'fields':HuffFields(PLAN).settled(r)}))"],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);const {raw,fields}=JSON.parse(p.stdout);
test('Hard Hat retrigger keeps prefix incomplete and gives three-way identical settlement',()=>{
 for(let i=1;i<raw.steps.length;i++)assert.deepEqual(huffNextRequest({...raw,steps:raw.steps.slice(0,i)}),{MSGID:'FREE_GAME'});
 assert.equal(huffNextRequest(raw),null);const m=huffMapping(raw,'a'.repeat(64),{retrigger:fields.typeMappingHash});assert.deepEqual(prepareNextgenRound(raw,m),fields);
 assert.throws(()=>huffMapping(raw,'a'.repeat(64),{hardHat:fields.typeMappingHash}));
});
test('Hard Hat retrigger independently rejects mismatched slots, counters, mixed features and replay',()=>{
 for(const [from,to]of [['PCFID~1|1|','PCFID~1|0|'],['CFFGT~1','CFFGT~0'],['FID=1|','FID=1|2|'],['RID=1','RID=0'],['NFG=5','NFG=0']]){
 const r=structuredClone(raw);for(const k of ['responsePayload','responseXml'])r.steps[2][k]=r.steps[2][k].replace(from,to);
 assert.throws(()=>huffNextRequest(r));assert.throws(()=>prepareNextgenRound(r,{buy:0,bonus:2,typeMappingHash:fields.typeMappingHash}));
 }
});
