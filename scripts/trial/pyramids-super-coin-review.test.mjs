import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {delimiter} from 'node:path';
import {reviewPyramidsSuperCoins} from './pyramids-super-coin-review.mjs';
import {pyramidsSequence,pyramidsMapping} from './pyramids-protocol.mjs';
const python=process.env.SG_REVIEW_PYTHON??process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const generated=spawnSync(python,['-c','import json; from test_pyramids_super_coin_review import super_coin_sample; from test_pyramids_free_review import PLAN; from pyramids_fields import PyramidsFields; raws=[super_coin_sample(x) for x in (-4,-3,-2)]; print(json.dumps({"raws":raws,"mapped":[PyramidsFields(PLAN).settled(x) for x in raws]}))'],{encoding:'utf8',env:{...process.env,PYTHONPATH:['service','service/tests'].join(delimiter),PYTHONUTF8:'1'}});
assert.equal(generated.status,0,generated.stderr);const {raws,mapped}=JSON.parse(generated.stdout);
const rewrite=(step,changes)=>{const p=new URLSearchParams(step.responsePayload);for(const [k,v] of Object.entries(changes))p.set(k,String(v));step.responsePayload=[...p].map(([k,v])=>k+'='+v).join('&');step.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';};
test('independent SFGT signed coins preserve counters and use a distinct mapping',()=>{
 raws.forEach((raw,i)=>{const before=structuredClone(raw);assert.equal(reviewPyramidsSuperCoins(raw).next,null);assert.equal(pyramidsSequence(raw).superCoins,true);assert.deepEqual(pyramidsMapping(raw,'0'.repeat(64),{superCoins:mapped[i].typeMappingHash}),{buy:0,bonus:10,typeMappingHash:mapped[i].typeMappingHash});assert.deepEqual(raw,before);
 for(let n=1;n<=10;n++)assert.equal(pyramidsSequence({...raw,steps:raw.steps.slice(0,n)}).next,'FREE_GAME');});
});
test('unknown jackpots, retriggers, mixed routes and wrong wallet/XML remain faults',()=>{
 for(const changes of [{FID:'0|1|'},{TFG:15,NFG:14},{GCT:1},{B:99981},{AB:99981},{GSD:'SFGT~1#SHNST~1'},{GSD:'SFGT~2#CL~0;0;-4;|'},{GSD:'SFGT~1#CL~0;0;-1;|'},{GSD:'SFGT~1#CL~0;0;-5;|'},{GSD:'SFGT~1#CL~3;0;-4;|'}]){const raw=structuredClone(raws[0]);rewrite(raw.steps[1],changes);assert.throws(()=>reviewPyramidsSuperCoins(raw));}
 const raw=structuredClone(raws[0]);raw.steps[1].responseXml='<GDMRESPONSE/>';assert.throws(()=>reviewPyramidsSuperCoins(raw));
});
