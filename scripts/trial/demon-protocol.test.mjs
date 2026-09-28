import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';

const output=spawnSync(process.env.PYTHON || 'python',['-c',
  "import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample,raw,exchange,PLAN;from demon_fields import DemonFields;values=[sample(),sample(True),raw([exchange('BET')]),raw([exchange('BET',1),exchange('FREE_GAME',0,win=100)])];print(json.dumps([{'raw':r,'fields':DemonFields(PLAN).settled(r)} for r in values]))"],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const cases=JSON.parse(output.stdout);

test('Demon every prefix continues once; FID1 retrigger/reset does not add a paid round',()=>{
  for(const {raw} of cases){
    assert.deepEqual(nextRequest({...raw,steps:[]}),{MSGID:'BET'});
    for(let n=1;n<raw.steps.length;n++)assert.deepEqual(nextRequest({...raw,steps:raw.steps.slice(0,n)}),{MSGID:'FREE_GAME'});
    assert.equal(nextRequest(raw),null);
  }
});
test('independent TypeScript settlement and Python derive identical FID1 and old FID0 fields',()=>{
  const require=createRequire(import.meta.url);
  require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
  const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
  for(const {raw,fields} of cases)assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fields.typeMappingHash,fields.typeMappingHash)),fields);
  assert.throws(()=>roundMapping(cases[0].raw,'base',undefined));
  assert.equal(roundMapping(cases[2].raw,'base','extension').typeMappingHash,'base');
  assert.equal(roundMapping(cases[3].raw,'base','extension').bonus,1);
});
test('unreviewed FID stack, lost free counter, new BET, changed session, and extra spin fail closed',()=>{
  for(const kind of ['fid','counter','bet','session','extra']){
    const raw=structuredClone(cases[0].raw);
    if(kind==='fid')raw.steps[8].responsePayload=raw.steps[8].responsePayload.replace('FID=1|0|','FID=0|1|0|');
    if(kind==='counter')raw.steps.at(-1).responsePayload=raw.steps.at(-1).responsePayload.replace(/&NFG=\d+/,'');
    if(kind==='bet')raw.steps[9]=raw.steps[0];
    if(kind==='session')raw.steps[9].requestPayload=raw.steps[9].requestPayload.replace('gdmgcmdemon-fixture','gdmgcmother');
    if(kind==='extra')raw.steps.push(raw.steps.at(-1));
    assert.throws(()=>nextRequest(raw));
  }
});
test('FID1 newly appearing on an alleged terminal frame cannot count as a replay',()=>{
  const raw=structuredClone(cases[3].raw);
  raw.steps.at(-1).responsePayload=raw.steps.at(-1).responsePayload.replace('FID=0|','FID=1|0|');
  assert.throws(()=>roundMapping(raw,'base','extension'),/DEMON_EMPTY_FREE_TRIGGER/);
});
