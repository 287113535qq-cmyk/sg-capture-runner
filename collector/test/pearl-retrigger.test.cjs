
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');const {pearlRetriggerFields}=require('../sg.pearl-retrigger');
const root=path.resolve(__dirname,'../..');
test('independent retrigger collector and Python agree; incomplete EndGame and counterfeit counters reject',async()=>{
 const {retriggerFixture}=await import('../../scripts/trial/pearl-retrigger-fixture.mjs');
 const {pearlRetriggerMapping,PEARL_SOURCE,PEARL_RETRIGGER_EXTENSION}=await import('../../scripts/trial/pearl-retrigger-protocol.mjs');
 const {protocolHash:hash}=await import('../../scripts/runner-v2/protocol-resume.mjs');
 const profiles=JSON.parse(fs.readFileSync(path.join(root,'service/round_types.json'),'utf8')).profiles;
 const raw=retriggerFixture(),mapping=pearlRetriggerMapping(raw,hash(profiles[PEARL_SOURCE]),hash(profiles[PEARL_RETRIGGER_EXTENSION]));
 const fields=pearlRetriggerFields(raw,mapping);
 const code="import sys,json;sys.path.insert(0,'service');from pearl_retrigger_fields import PearlRetriggerFields,SOURCE;print(json.dumps(PearlRetriggerFields({'gameId':32795,'runtimeGameId':33155,'sourceKey':SOURCE,'betRaw':200}).settled(json.load(sys.stdin))))";
 const result=spawnSync(process.env.PYTHON||'python3',['-B','-c',code],{cwd:root,input:JSON.stringify(raw),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),fields);
 const partial=structuredClone(raw);partial.steps.pop();assert.throws(()=>pearlRetriggerFields(partial,mapping));
 const wrong=structuredClone(raw);wrong.steps[7].responseXml=wrong.steps[7].responsePayload=wrong.steps[7].responsePayload.replace('freeSpinsTotal="16"','freeSpinsTotal="8"');assert.throws(()=>pearlRetriggerFields(wrong,mapping));
});
