import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import path from 'node:path';
import {reviewAdapterStopDiagnosis} from './adapter-stop-diagnosis.mjs';
import {veryFruityActionNext} from '../trial/veryfruity-action-protocol.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const py=process.env.PYTHON??(process.platform==='win32'?'C:/Users/xxx/AppData/Local/Programs/Python/Python314/python.exe':'python3');
function fixture(){
 const result=spawnSync(py,['-B','-c','import json;from test_veryfruity_action_fields import fixture;p,r=fixture();print(json.dumps({"plan":p,"raw":r}))'],
  {encoding:'utf8',env:{...process.env,PYTHONUTF8:'1',PYTHONPATH:['service','service/tests'].join(path.delimiter)}});
 assert.equal(result.status,0,result.stderr);const {plan,raw}=JSON.parse(result.stdout);
 Object.assign(plan,{trialId:'sg_r1_20261003_32812',runnerGroup:'secondary'});raw.steps=raw.steps.slice(0,1);
 return {plan,basePlan:plan,pending:{raw},profile:{schema:'sg-ag-shared-stop-close-v2',group:'secondary',
  sourceRunKey:'capture-run:37053154321:1',sourceCommit:'54e5fa3c63bf7766d02a443e5bdd07c10a290412',
  code:'VERYFRUITY_ACTION_UNREVIEWED_EXIT',reviewedNextHash:hash({MSGID:'EndGame'})},
  parser:{call:async q=>veryFruityActionNext(q.plan,q.raw)}};
}
test('reviewed incomplete paid prefix permits only zero-source retirement diagnosis',async()=>{
 const f=fixture(),before=hash(f.pending);await reviewAdapterStopDiagnosis(f);
 assert.equal(hash(f.pending),before);assert.equal(f.pending.raw.steps.length,1);
});
test('wrong source, group, reviewed route, money and terminal never reuse historical display fault',async()=>{
 for(const cause of ['run','commit','group','hash','money','terminal']){
  const f=fixture();if(cause==='run')f.profile.sourceRunKey='capture-run:1:1';
  if(cause==='commit')f.profile.sourceCommit='a'.repeat(40);
  if(cause==='group')f.profile.group='primary';if(cause==='hash')f.profile.reviewedNextHash=hash(null);
  if(cause==='money')f.pending.raw.startBalanceRaw++;
  if(cause==='terminal')f.parser.call=async()=>null;
  await assert.rejects(reviewAdapterStopDiagnosis(f));
 }
});
