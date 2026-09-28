import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {HUFF_SOURCE} from './huff-protocol.mjs';

const result=spawnSync(process.env.PYTHON || 'python',['-c',
  "import sys,json;sys.path[:0]=['service','service/tests'];from test_huff_fields import sample,raw,exchange,PLAN;from huff_fields import HuffFields;values=[sample(False),sample(True),raw([exchange('BET')]),raw([exchange('BET',1,'0|'),exchange('FREE_GAME',0,'0|','FEAT~MMANSION#MMBG~1#MMW~result',win=10000)])];print(json.dumps([{'raw':r,'fields':HuffFields(PLAN).settled(r)} for r in values]))"],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const cases=JSON.parse(result.stdout);

test('Hard Hat every prefix follows FREE_GAME and completed Mansion result is terminal',()=>{
  for(const {raw} of cases.slice(0,2)) {
    assert.deepEqual(nextRequest({...raw,steps:[]}),{MSGID:'BET'});
    for(let n=1;n<raw.steps.length;n++)assert.deepEqual(nextRequest({...raw,steps:raw.steps.slice(0,n)}),{MSGID:'FREE_GAME'});
    assert.equal(nextRequest(raw),null);
  }
});
test('Runner and storage independently derive the same types, exact stake, win and hashes',()=>{
  const require=createRequire(import.meta.url);
  require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
  const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
  for(const {raw,fields} of cases) {
    const mapping=roundMapping(raw,fields.typeMappingHash,fields.typeMappingHash);
    assert.deepEqual(prepareNextgenRound(raw,mapping),fields);
  }
});
test('unknown feature, missing counter, changed session and extra paid round stop before continuation',()=>{
  for(const kind of ['fid','counter','session','bet']) {
    const raw=structuredClone(cases[0].raw);
    if(kind==='fid')raw.steps[0].responsePayload=raw.steps[0].responsePayload.replace('FID=1|','FID=2|');
    if(kind==='counter')raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(/&NFG=\d+/,'');
    if(kind==='session')raw.steps[1].requestPayload=raw.steps[1].requestPayload.replace('gdmgcmhuff-fixture','gdmgcmother');
    if(kind==='bet')raw.steps[1]=raw.steps[0];
    assert.throws(()=>nextRequest(raw));
  }
});
test('Hard Hat extension cannot silently use the old free-game mapping',()=>{
  assert.throws(()=>roundMapping(cases[0].raw,'base',undefined));
  assert.deepEqual(roundMapping(cases[2].raw,'base','extension'),{buy:0,bonus:0,typeMappingHash:'base'});
  assert.deepEqual(roundMapping(cases[3].raw,'base','extension'),{buy:0,bonus:1,typeMappingHash:'base'});
  assert.equal(cases[0].raw.sourceKey,HUFF_SOURCE);
  const incomplete=structuredClone(cases[0].raw);
  incomplete.steps[0].responsePayload=incomplete.steps[0].responsePayload.replace('FID=1|','FID=1|0|');
  assert.throws(()=>roundMapping(incomplete,'base','extension'),/HUFF_MISSING_MANSION_REPLAY/);
  const reset=structuredClone(cases[0].raw);
  reset.steps.at(-1).responsePayload=reset.steps.at(-1).responsePayload.replace('FID=1|','FID=0|').replace('FEAT~HARDHAT','');
  assert.equal(roundMapping(reset,'base','extension').bonus,2);
});
