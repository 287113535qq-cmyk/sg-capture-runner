const test=require('node:test'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),path=require('node:path');
const {prepareNextgenRound}=require('../sg.ingest');
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_super_coin_review import super_coin_sample;from pyramids_fields import PyramidsFields;from test_pyramids_free_review import PLAN;raws=[super_coin_sample(x) for x in (-4,-3,-2)];print(json.dumps({'raws':raws,'fields':[PyramidsFields(PLAN).settled(v) for v in raws]}))"],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
const rewrite=(step,changes)=>{const p=new URLSearchParams(step.responsePayload);for(const [k,v] of Object.entries(changes))p.set(k,String(v));step.responsePayload=[...p].map(([k,v])=>k+'='+v).join('&');step.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';};
test('collector independently agrees on all three SFGT signed cash symbols',()=>{
 f.raws.forEach((raw,i)=>{const before=structuredClone(raw);assert.deepEqual(prepareNextgenRound(raw,f.fields[i]),f.fields[i]);assert.deepEqual(raw,before);assert.throws(()=>prepareNextgenRound(raw,{...f.fields[i],bonus:7}),/MAPPING_MISMATCH/);assert.throws(()=>prepareNextgenRound({...raw,steps:raw.steps.slice(0,8)},f.fields[i]),/INCOMPLETE_ROUND/);});
});
test('collector rejects unseen composed features and monetary/XML differences',()=>{
 for(const changes of [{FID:'0|1|'},{TFG:15,NFG:14},{GCT:1},{B:99981},{AB:99981},{GSD:'SFGT~1#SHNST~1'},{GSD:'SFGT~2#CL~0;0;-4;|'},{GSD:'SFGT~1#CL~0;0;-1;|'},{GSD:'SFGT~1#CL~3;0;-4;|'}]){const raw=structuredClone(f.raws[0]);rewrite(raw.steps[1],changes);assert.throws(()=>prepareNextgenRound(raw,f.fields[0]));}
 const raw=structuredClone(f.raws[0]);raw.steps[1].responseXml='<GDMRESPONSE/>';assert.throws(()=>prepareNextgenRound(raw,f.fields[0]));
});
