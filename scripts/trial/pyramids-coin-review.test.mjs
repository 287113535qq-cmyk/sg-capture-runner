import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {delimiter} from 'node:path';
import {reviewPyramidsCoins} from './pyramids-coin-review.mjs';
import {reviewPyramidsRetrigger} from './pyramids-retrigger-review.mjs';
const python=process.env.SG_REVIEW_PYTHON??process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const env={...process.env,PYTHONPATH:['service','service/tests'].join(delimiter),PYTHONUTF8:'1'};
const generated=spawnSync(python,['-c','import json; from test_pyramids_coin_review import coin_sample; from test_pyramids_free_review import PLAN; from pyramids_coin_review import PyramidsCoinSequence; a=PyramidsCoinSequence(PLAN); raws=[coin_sample(x) for x in (-4,-3,-2)]; print(json.dumps({"raws":raws,"reviews":[a.review(x) for x in raws]}))'],{encoding:'utf8',env});
assert.equal(generated.status,0,generated.stderr);
const {raws,reviews}=JSON.parse(generated.stdout);
const rewrite=(step,changes)=>{const p=new URLSearchParams(step.responsePayload);for(const [k,v] of Object.entries(changes))p.set(k,String(v));step.responsePayload=[...p].map(([k,v])=>k+'='+v).join('&');step.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+step.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';};
test('three signed coin meanings agree with independent Python money validation',()=>{
 raws.forEach((raw,i)=>{
  const before=structuredClone(raw);assert.deepEqual(reviewPyramidsCoins(raw),reviews[i]);assert.deepEqual(raw,before);
  for(const length of [1,3,15,20]){const prefix={...raw,steps:raw.steps.slice(0,length)};assert.equal(reviewPyramidsCoins(prefix).nextRequestHypothesis.MSGID,'FREE_GAME');}
  assert.throws(()=>reviewPyramidsRetrigger(raw),/UNREVIEWED_COIN/);
 });
});
test('bad geometry, aliases, base negatives and unknown signed values remain faults',()=>{
 for(const gsd of ['CL~3;0;-4;|','CL~0;5;-4;|','CL~0;0;-4;|0;0;20;|','CL~0;0;-4;|3;0;-2;|','CL~0;0;-1;|','CL~0;0;-5;|','BGCL~0;0;-4;|','CL~0;0;-4;|#CLBN~0;0;20;|']){
  const raw=structuredClone(raws[0]);rewrite(raw.steps[1],{GSD:gsd});assert.throws(()=>reviewPyramidsCoins(raw));
 }
 const raw=structuredClone(raws[0]);rewrite(raw.steps[0],{GSD:'CL~0;0;-4;|'});assert.throws(()=>reviewPyramidsCoins(raw));
});
test('wallet stages, original XML, retrigger and feature exits cannot be bypassed',()=>{
 for(const [i,changes] of [[1,{B:99999}],[1,{AB:99999}],[1,{TW:1}],[20,{AB:99900}],[1,{FID:'0|1|'}],[1,{GCT:1}],[2,{NFG:19}],[2,{GSD:'SFGT~1#CL~0;0;-4;|'}]]){
  const raw=structuredClone(raws[0]);rewrite(raw.steps[i],changes);assert.throws(()=>reviewPyramidsCoins(raw));
 }
 const raw=structuredClone(raws[0]);raw.steps[1].responseXml=raw.steps[0].responseXml;assert.throws(()=>reviewPyramidsCoins(raw));
});
