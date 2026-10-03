import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationReplayEvidence} from './preparation-replay-evidence.mjs';
import {reviewedPreparation} from './preparation-handlers.mjs';
import {preparationGates} from './preparation-inventory.mjs';
const revisionHash='a'.repeat(64),plan={gameId:1,trialId:'fixture',runtimeGameId:10,maxSteps:10};
const raw={fixtureOnly:false,steps:[{msgId:'BET'},{msgId:'FREE_GAME',requestPayload:'original-intent'}]};
const record={_id:'fixture',fixtureOnly:false,gameId:1,trialId:'fixture',runtimeGameId:10,raw,
 normalized:{money:{betRaw:20},classificationStatus:'pending'}};
function args(){
 const task={schema:'sg-preparation-replay-task-v1',gameId:1,plan,planHash:hash(plan),revisionHash,
  records:[record],readbacks:[structuredClone(record)],sourceAllowance:0};
 return {task,revisionHash,parser:{call:async q=>{
  assert.notEqual(q.op,'classify');
  if(q.op==='plan')return {validated:true};if(q.op==='verify'||q.op==='intent')return {verified:q.op==='verify',...(q.op==='intent'?{validated:true}:{})};
  return q.raw.steps.length===1?{MSGID:'FREE_GAME'}:null;
 }},runnerNext:r=>r.steps.length===1?{MSGID:'FREE_GAME'}:null,independentFields:()=>record.normalized};
}
test('full readback and two route/money implementations create three bounded gates without gameplay classification',async()=>{
 const a=args();a.parser.call=async q=>{assert.notEqual(q.op,'classify');return q.op==='next'?a.runnerNext(q.raw):q.op==='verify'?{verified:true}:{validated:true};};
 const r=await preparationReplayEvidence(a);
 assert.deepEqual(r.receipts.map(x=>x.gate),['route','settlement','persistence']);
 assert.equal(r.gameplayCoverageComplete,false);assert.equal(r.newBetAllowance,0);assert.equal(r.sourceRequests,0);
 for(const alter of [x=>x.task.readbacks[0].normalized.money.betRaw=99,
  x=>x.task.records=[{...record,fixtureOnly:true}],x=>x.independentFields=()=>({money:{betRaw:99}}),
  x=>x.runnerNext=()=>null,x=>x.task.revisionHash='b'.repeat(64)]){
  const b={...a,task:structuredClone(a.task)};alter(b);await assert.rejects(preparationReplayEvidence(b));
 }
});
test('a fault cannot be cleared by unrelated earlier gates or an unconfirmed terminal',async()=>{
 const failure='d'.repeat(64),receipts=preparationGates.map(gate=>({schema:'sg-preparation-gate-v1',gameId:1,gate,
  revisionHash,verified:true,sourceAllowance:0,supportingHashes:['c'.repeat(64)]}));
 assert.deepEqual(reviewedPreparation({gameId:1,revisionHash,receipts,failureEvidenceHash:failure}).missingGates,
  ['route','settlement','persistence']);
 for(const r of receipts.filter(r=>['route','settlement','persistence'].includes(r.gate)))r.failureEvidenceHash=failure;
 assert.equal(reviewedPreparation({gameId:1,revisionHash,receipts,failureEvidenceHash:failure}).status,'prepared');
 const a=args();a.task.failureEvidenceHash=failure;
 await assert.rejects(preparationReplayEvidence(a),/FAILURE_REQUIRED/);
});
