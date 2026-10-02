import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewVeryFruityActions} from './veryfruity-action-review.mjs';
import {reviewVeryFruityCash} from './veryfruity-cash-review.mjs';
const python=process.env.PYTHON||(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const fixture=spawnSync(python,['-c','import json;from service.tests.test_veryfruity_cash_review import sample,HEADER;print(json.dumps({"raw":sample(20),"header":HEADER}))'],{env:{...process.env,PYTHONPATH:'service',PYTHONUTF8:'1'},encoding:'utf8'});
assert.equal(fixture.status,0);const {raw,header}=JSON.parse(fixture.stdout);
const review=r=>reviewVeryFruityActions(r,{expectedHeader:header});
const independent=r=>{
 const result=spawnSync(python,['-c','import sys,json;from veryfruity_action_review import review_actions;x=json.load(sys.stdin);print(json.dumps(review_actions(x["raw"],expected_header=x["header"])))'],
  {env:{...process.env,PYTHONPATH:'service',PYTHONUTF8:'1'},encoding:'utf8',input:JSON.stringify({raw:r,header})});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
};
const edit=(s,from,to)=>{s.responsePayload=s.responseXml=s.responseXml.replace(from,to);};
test('unknown display data retains original XML and does not block a known action; money validation remains independent',()=>{
 const r=structuredClone(raw);edit(r.steps[0],'</GameResult>','<DisplayExtension effect="new"/></GameResult>');
 const before=JSON.stringify(r),route=review({...r,steps:r.steps.slice(0,1)});
 assert.equal(route.nextRequestHypothesis,'EndGame');assert.equal(review(r).endGameAcknowledged,true);
 assert.equal(review(r).complete,false);assert.equal(review(r).moneyVerified,false);assert.equal(JSON.stringify(r),before);
 assert.deepEqual(review(r),independent(r));
 assert.throws(()=>reviewVeryFruityCash(r,{expectedHeader:header,stakePerLine:'1',paylineCount:'20'}));
 edit(r.steps[1],'value="1000"','value="999"');assert.equal(review(r).complete,false);
});
function freeFrames(counters){
 return counters.map(([current,total],i)=>{
  const s=structuredClone(raw.steps[0]);s.requestPayload=s.requestPayload.replace('fixture-0','free-'+i);
  edit(s,'fixture-1','free-'+(i+1));edit(s,'</GameResult>',`<FSInfo freeSpinNumber="${current}" freeSpinsTotal="${total}" displayNew="preserved"/></GameResult>`);return s;
 });
}
test('fixed-client counter route follows a total increase without interpreting its award artwork',()=>{
 const r={steps:freeFrames([[0,2],[1,3],[2,3],[3,3]])};assert.equal(review(r).nextRequestHypothesis,'EndGame');
 const end=structuredClone(raw.steps[1]);end.requestPayload=end.requestPayload.replace('fixture-1','free-4');r.steps.push(end);
 assert.equal(review(r).endGameAcknowledged,true);assert.equal(review(r).captureAuthorization,false);
 assert.deepEqual(review(r),independent(r));
});
test('unknown action, ambiguity, counter regression, skipped frame and wrong session still stop routing',()=>{
 const mutations=[r=>r.steps[0].msgId='Pick',r=>edit(r.steps[0],'</GameResult>','<Pick/></GameResult>'),
  r=>edit(r.steps[0],'mysterySymbol="0"','mysterySymbol="2"'),r=>edit(r.steps[0],'isMaxWin="0"','isMaxWin="1"'),
  r=>edit(r.steps[0],'</GameResult>','<FSInfo freeSpinNumber="0" freeSpinsTotal="2"/><FSInfo freeSpinNumber="0" freeSpinsTotal="2"/></GameResult>'),
  r=>r.steps[1].requestPayload=r.steps[1].requestPayload.replace('fixture-1','wrong')];
 for(const mutation of mutations){const r=structuredClone(raw);mutation(r);assert.throws(()=>review(r));}
 for(const counters of [[[0,2],[2,2]],[[0,3],[1,2]],[[1,3]],[[0,2],[1,2],[2,2],[3,3]]])assert.throws(()=>review({steps:freeFrames(counters)}));
});
