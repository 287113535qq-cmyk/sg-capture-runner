import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {reviewVeryFruitySettlement} from './veryfruity-settlement-review.mjs';
const python=process.env.PYTHON||(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
const run=(code,input)=>spawnSync(python,['-c',code],{env:{...process.env,PYTHONPATH:'service',PYTHONUTF8:'1'},encoding:'utf8',input:JSON.stringify(input)});
const fixture=run('import json;from service.tests.test_veryfruity_cash_review import sample,HEADER;print(json.dumps({"raw":sample(20),"header":HEADER}))');
assert.equal(fixture.status,0,fixture.stderr);const {raw,header}=JSON.parse(fixture.stdout);
header.gameCodeRGI='veryfruity';header.gameID='20206';header.versionID='1_0';
for(const s of raw.steps){s.requestPayload=s.requestPayload.replaceAll('FIXTURE','veryfruity').replace('gameID="veryfruity"','gameID="20206"').replace('versionID="veryfruity"','versionID="1_0"');s.responseXml=s.responseXml.replace('gameID="FIXTURE"','gameID="20206"').replace('versionID="FIXTURE"','versionID="1_0"');s.responsePayload=s.responseXml;}
const options={expectedHeader:header,stakePerLine:'1',paylineCount:'20'};
const code='import sys,json;from veryfruity_settlement_review import review_settlement;x=json.load(sys.stdin);print(json.dumps(review_settlement(x["raw"],expected_header=x["header"],stake_per_line="1",payline_count="20")))';
const independent=r=>run(code,{raw:r,header});
const edit=(s,from,to)=>{s.responseXml=s.responsePayload=s.responseXml.replace(from,to);};
function free(){
 const counters=[[0,2],[1,3],[2,3],[3,3]],wins=[20,5,0,7];let total=0;
 const steps=counters.map(([current,max],i)=>{
  total+=wins[i];const s=structuredClone(raw.steps[0]);
  s.requestPayload=s.requestPayload.replace('fixture-0','free-'+i);edit(s,'fixture-1','free-'+(i+1));
  edit(s,'totalWin="20"',`totalWin="${wins[i]}"`);edit(s,'totalWagerWin="20"',`totalWagerWin="${total}"`);
  edit(s,'value="1000"',`value="${980+total}"`);
  edit(s,'</GameResult>',`<FSInfo freeSpinNumber="${current}" freeSpinsTotal="${max}"/><NewDisplay fields="untouched"/></GameResult>`);return s;
 });
 const end=structuredClone(raw.steps[1]);end.requestPayload=end.requestPayload.replace('fixture-1','free-4');edit(end,'value="1000"','value="1012"');steps.push(end);return {startBalanceRaw:1000,steps};
}
test('ordinary and growing free action chains reconcile raw cumulative wallet independently without classifying display fields',()=>{
 for(const r of [raw,free()]){
  const before=JSON.stringify(r),result=reviewVeryFruitySettlement(r,options),p=independent(r);
  assert.equal(p.status,0,p.stderr);assert.deepEqual(result,JSON.parse(p.stdout));assert.equal(JSON.stringify(r),before);
  assert.equal(result.endGameAcknowledged,true);assert.equal(result.moneyEvidenceVerified,true);
  assert.equal(result.complete,false);assert.equal(result.captureAuthorization,false);assert.equal(result.bonus,null);
 }
 assert.equal(reviewVeryFruitySettlement(free(),options).winRaw,32);
 const prefix=free();prefix.steps.pop();assert.equal(reviewVeryFruitySettlement(prefix,options).endGameAcknowledged,false);
});
test('wrong cumulative cash, hidden extra debit, malformed request currency, ambiguous balance and forged terminal fail both independent readers',()=>{
 const mutations=[r=>edit(r.steps[2],'totalWagerWin="25"','totalWagerWin="26"'),
  r=>edit(r.steps[1],'value="1005"','value="985"'),r=>edit(r.steps.at(-1),'value="1012"','value="1011"'),
  r=>r.steps[1].requestPayload=r.steps[1].requestPayload.replace('total="20"','total="40"'),
  r=>r.steps[1].requestPayload=r.steps[1].requestPayload.replace('<CurrencyMultiplier>1</CurrencyMultiplier>','<CurrencyMultiplier>2</CurrencyMultiplier>'),
  r=>edit(r.steps.at(-1),'</Balances>','<Balance name="CASH_BALANCE" value="1012"/></Balances>'),
  r=>edit(r.steps[0],'totalWin="20"','totalWin="20tail"'),
  r=>edit(r.steps.at(-1),'</GameResponse>','<GameResult/></GameResponse>')];
 for(const mutate of mutations){const r=free();mutate(r);assert.throws(()=>reviewVeryFruitySettlement(r,options));assert.notEqual(independent(r).status,0);}
});
