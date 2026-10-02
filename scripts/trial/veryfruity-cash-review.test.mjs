import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewVeryFruityCash} from './veryfruity-cash-review.mjs';
// Independent validators consume the same original XML; all identities synthetic.
const python=process.env.SG_REVIEW_PYTHON??process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const fixture=spawnSync(python,['-c','import json; from service.tests.test_veryfruity_cash_review import sample,HEADER; print(json.dumps({"header":HEADER,"raws":[sample(x) for x in (0,20,125)]}))'],{env:{...process.env,PYTHONPATH:'service',PYTHONUTF8:'1'},encoding:'utf8'});
assert.equal(fixture.status,0,fixture.stderr);
const {header,raws}=JSON.parse(fixture.stdout);
const verify=raw=>reviewVeryFruityCash(raw,{expectedHeader:header,stakePerLine:'1',paylineCount:'20'});
test('three original synthetic cash chains and EndGame prefixes agree with Python',()=>{
 for(const raw of raws){
  const result=verify(raw),p=spawnSync(python,['-c','import sys,json; from service.tests.test_veryfruity_cash_review import verify; print(json.dumps(verify(json.load(sys.stdin))))'],{env:{...process.env,PYTHONPATH:'service'},input:JSON.stringify(raw),encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);assert.deepEqual(result,JSON.parse(p.stdout));assert.equal(result.captureAuthorization,false);
  assert.equal(verify({...raw,steps:raw.steps.slice(0,1)}).nextRequestHypothesis,'EndGame');
 }
});
test('money, identity, feature and XML ambiguity never become a cash exit',()=>{
 const mutations=[['value="1000"','value="999"'],['totalWin="20"','totalWin="21"'],['isMaxWin="0"','isMaxWin="1"'],['mysterySymbol="0"','mysterySymbol="3"'],['gameID="FIXTURE"','gameID="wrong"'],['winVal="20"','winVal="20tail"'],['</GameResult>','<FSInfo/></GameResult>'],['</GameResult>','<BonusWin/></GameResult>'],['totalWin="20"',''],['</Balances>','</Balances><Balances/>'],['<GameResponse','<!DOCTYPE x><GameResponse']];
 for(const [from,to] of mutations){const raw=structuredClone(raws[1]);assert(raw.steps[0].responseXml.includes(from));raw.steps[0].responsePayload=raw.steps[0].responseXml=raw.steps[0].responseXml.replace(from,to);assert.throws(()=>verify(raw),e=>typeof e.code==='string');}
});
test('rotated response session is required for EndGame and missing acknowledgement remains pending',()=>{
 const raw=structuredClone(raws[1]);raw.steps[1].requestPayload=raw.steps[1].requestPayload.replace('fixture-1','fixture-old');assert.throws(()=>verify(raw),/VERYFRUITY_SESSION/);
 const prefix=verify({...raw,steps:raw.steps.slice(0,1)});assert.equal(prefix.endGameAcknowledged,false);assert.equal(prefix.captureAuthorization,false);
});
test('duplicate or out-of-board paylines remain invalid before any monetary exit',()=>{
 for(const positions of ['0|0|2','0|15','0|1|2|3|4|5','']){
  const raw=structuredClone(raws[1]);raw.steps[0].responsePayload=raw.steps[0].responseXml=raw.steps[0].responseXml.replace('>0|1|2<',`>${positions}<`);
  assert.throws(()=>verify(raw),e=>typeof e.code==='string');
 }
});
