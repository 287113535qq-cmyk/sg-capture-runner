const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{pearlAwardFields}=require('../sg.pearl-award');
test('independent collector and Python retain old mappings and settle varying awarded counts',async()=>{
 const {awardFixture}=await import('../../scripts/trial/pearl-award-fixture.mjs');
 const {pearlAwardMapping,PEARL_SOURCE,PEARL_AWARD_EXTENSION}=await import('../../scripts/trial/pearl-award-protocol.mjs');
 const {PEARL_RETRIGGER_EXTENSION}=await import('../../scripts/trial/pearl-retrigger-protocol.mjs');
 const {protocolHash:hash}=await import('../../scripts/runner-v2/protocol-resume.mjs'),root=path.resolve(__dirname,'../..');
 const profiles=JSON.parse(fs.readFileSync(path.join(root,'service/round_types.json'),'utf8')).profiles,base=hash(profiles[PEARL_SOURCE]),ext={retrigger:hash(profiles[PEARL_RETRIGGER_EXTENSION]),awards:hash(profiles[PEARL_AWARD_EXTENSION])};
 const raws=[awardFixture(8),awardFixture(8,{7:8}),awardFixture(15),awardFixture(15,{4:8,14:15})];
 const expected=raws.map(raw=>pearlAwardFields(raw,pearlAwardMapping(raw,base,ext)));
 const code="import sys,json;sys.path.insert(0,'service');from round_fields import derive;print(json.dumps([derive(r) for r in json.load(sys.stdin)]))";
 const result=spawnSync(process.env.PYTHON||'python3',['-B','-c',code],{cwd:root,input:JSON.stringify(raws),encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),expected);
 for(const raw of raws){raw.steps.pop();assert.throws(()=>pearlAwardFields(raw,{buy:0,bonus:1,typeMappingHash:ext.awards}));}
});
