import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {replayFaultPlan} from './preparation-replay-evidence.mjs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/huff-action-contract.mjs';
function fixture(){
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32714'];
 const raw=JSON.parse(fs.readFileSync('scripts/trial/fixtures/huff-hardhat-mansion-prefix.json','utf8')).raw;
 const plan={...base,target:300000,countAllocation:'a'.repeat(64),featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH};
 const evidence={plan,raw,receipt:{gameId:32714,planHash:hash(plan),rawHash:hash(raw)}};
 return {task:{gameId:32714,plan:base,captureLink:{captureEvidence:evidence,failureEvidenceHash:hash(evidence)}},fault:{raw}};
}
test('mixed historical repair uses the action fault captured plan and preserves the original raw',()=>{
 const {task,fault}=fixture(),before=JSON.stringify(fault.raw);
 assert.deepEqual(replayFaultPlan(task,fault),task.captureLink.captureEvidence.plan);
 assert.equal(JSON.stringify(fault.raw),before);
 assert.equal(replayFaultPlan(task,{raw:{}}),task.plan);
});
test('an action fault cannot borrow a changed or unrelated captured plan binding',()=>{
 for(const mode of ['absent','receipt','raw','plan','link','game']){
  const {task,fault}=fixture();
  if(mode==='absent')delete task.captureLink;
  if(mode==='receipt')task.captureLink.captureEvidence.receipt.planHash='b'.repeat(64);
  if(mode==='raw')fault.raw={...fault.raw,startBalanceRaw:1};
  if(mode==='plan')task.captureLink.captureEvidence.plan.betRaw=1000;
  if(mode==='link')task.captureLink.failureEvidenceHash='b'.repeat(64);
  if(mode==='game')task.gameId=32721;
  assert.throws(()=>replayFaultPlan(task,fault),undefined,mode);
 }
});

test('several historical action faults retain distinct source plans and cannot borrow the latest allocation',()=>{
 for(const allocation of ['c','d']){
  const {task,fault}=fixture(),plan={...task.captureLink.captureEvidence.plan,countAllocation:allocation.repeat(64)};
  const receipt={schema:'sg-capture-fault-receipt-v1',gameId:32714,trialId:task.plan.trialId,
   batchId:143,planHash:hash(plan),rawHash:hash(fault.raw),sourceAllowance:0,requiresNewSession:true,
   archiveKey:'abandoned-original',archiveHash:'f'.repeat(64)};
  fault.evidence={raw:fault.raw,abandonedKey:receipt.archiveKey,abandonedHash:receipt.archiveHash,
   captureEvidence:{plan,raw:fault.raw,receipt,receiptKey:`capture-fault:${task.plan.trialId}:143:${hash(receipt)}`}};
  fault.evidenceHash=hash(fault.evidence);
  assert.deepEqual(replayFaultPlan(task,fault),plan);
  assert.notEqual(hash(plan),hash(task.captureLink.captureEvidence.plan));
  for(const field of ['archiveHash','rawHash','planHash','sourceAllowance']){
   const changed=structuredClone(fault);changed.evidence.captureEvidence.receipt[field]=field==='sourceAllowance'?1:'0'.repeat(64);
   changed.evidenceHash=hash(changed.evidence);
   assert.throws(()=>replayFaultPlan(task,changed));
  }
 }
});
