const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
const {veryFruityActionFields}=require('../sg.veryfruity-action');
const python=process.env.PYTHON||(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const root=path.resolve(__dirname,'../..');
const invoke=(code,input)=>spawnSync(python,['-c',code],{cwd:root,env:{...process.env,PYTHONPATH:'service;service/tests'.replaceAll(';',path.delimiter),PYTHONUTF8:'1'},encoding:'utf8',input:JSON.stringify(input)});
const f=invoke('import json;from test_veryfruity_action_fields import fixture;p,r=fixture();print(json.dumps({"plan":p,"raw":r}))');
assert.equal(f.status,0,f.stderr);const {plan,raw}=JSON.parse(f.stdout);
const read=r=>invoke('import sys,json;from veryfruity_action_fields import VeryFruityActionFields;x=json.load(sys.stdin);print(json.dumps(VeryFruityActionFields(x["plan"]).settled(x["raw"])))',{plan,raw:r});
test('collector independently matches Python money and preserves unknown display XML without invented gameplay',()=>{
 const r=structuredClone(raw);r.steps[0].responseXml=r.steps[0].responsePayload=r.steps[0].responseXml.replace('</GameResult>','<DisplayExtension value="kept"/></GameResult>');
 const before=JSON.stringify(r),p=read(r);assert.equal(p.status,0,p.stderr);
 assert.deepEqual(veryFruityActionFields(r,plan),JSON.parse(p.stdout));assert.equal(JSON.stringify(r),before);
 assert.throws(()=>veryFruityActionFields({...r,steps:r.steps.slice(0,1)},plan));
});
test('collector and Python refuse money corruption, duplicate balance, foreign identity and an unproved exit',()=>{
 const mutations=[r=>r.steps[1].responseXml=r.steps[1].responseXml.replace('value="1000"','value="999"'),
  r=>r.steps[0].responseXml=r.steps[0].responseXml.replace('totalWagerWin="20"','totalWagerWin="21"'),
  r=>r.steps[0].responseXml=r.steps[0].responseXml.replace('gameID="20206"','gameID="20327"'),
  r=>r.steps[0].responseXml=r.steps[0].responseXml.replace('</Balances>','<Balance name="CASH_BALANCE" value="1000"/></Balances>'),
  r=>r.steps[1].responseXml=r.steps[1].responseXml.replace('</GameResponse>','<GameResult/></GameResponse>')];
 for(const mutate of mutations){const r=structuredClone(raw);mutate(r);for(const s of r.steps)s.responsePayload=s.responseXml;
  assert.throws(()=>veryFruityActionFields(r,plan));assert.notEqual(read(r).status,0);}
});
