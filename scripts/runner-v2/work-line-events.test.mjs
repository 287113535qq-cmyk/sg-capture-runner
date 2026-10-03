import test from 'node:test';import assert from 'node:assert/strict';
import {newInventory,claimPreparation,finishPreparation,preparationGates} from './preparation-inventory.mjs';
import {applyWorkLineEvent,preparedCampaignSelector} from './work-line-events.mjs';
const games=[{gameId:1,name:'broken'},{gameId:2,name:'next'}];
const proof=(id,rev='a')=>({schema:'sg-reusable-preparation-v1',gameId:id,sourceAllowance:0,revisionHash:rev.repeat(64),
 gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))});
const prepare=(q,id,rev='a')=>{const c=claimPreparation(q,{owner:'test',now:id*10,lane:q.tasks.find(t=>t.gameId===id).lane});assert.equal(c.gameId,id);finishPreparation(q,c,{status:'prepared',proof:proof(id,rev)},id*10+1);};

test('fresh native repair binding reaches both queued admission mirrors and blocked repair tasks without granting readiness',()=>{
 const event={schema:'sg-work-line-event-v1',kind:'native-repair-observed',gameId:1,sourceAllowance:0,
  evidenceHash:'c'.repeat(64),repairKey:'game-repair:fixture:'+'a'.repeat(64)};
 for(const [lane,status] of [['admission','queued'],['repair','blocked']]){
  const q=newInventory(games),task=q.tasks[0];Object.assign(task,{lane:'repair',status});
  assert(applyWorkLineEvent(q,event,lane,50));assert.equal(task.status,status);
  assert.equal(task.failureEvidenceHash,event.evidenceHash);assert.equal(task.proof,null);
  assert.equal(applyWorkLineEvent(q,event,lane,51),false);
 }
 for(const change of [t=>t.lane='admission',t=>t.status='prepared',t=>t.claim={token:'busy'},
  t=>t.failureEvidenceHash='d'.repeat(64)]){
  const q=newInventory(games);Object.assign(q.tasks[0],{lane:'repair',status:'queued'});change(q.tasks[0]);
  assert.throws(()=>applyWorkLineEvent(q,event,'admission',50));
 }
});

test('formal retirement replaces only the matching current capture fault and revokes its interim proof',()=>{
 const event={schema:'sg-work-line-event-v1',kind:'native-repair-settled',gameId:1,sourceAllowance:0,
  evidenceHash:'d'.repeat(64),captureFailureEvidenceHash:'c'.repeat(64),rejectedProofHash:'b'.repeat(64),
  repairKey:'game-repair:fixture:'+'e'.repeat(64)};
 for(const lane of ['admission','repair']){
  const q=newInventory(games);Object.assign(q.tasks[0],{status:'prepared',lane:lane==='repair'?'repair':'admission',
   proof:proof(1),proofHash:'a'.repeat(64),failureEvidenceHash:event.captureFailureEvidenceHash,rejectedProofHash:event.rejectedProofHash});
  assert(applyWorkLineEvent(q,event,lane,50));assert.equal(q.tasks[0].proof,null);
  assert.equal(q.tasks[0].failureEvidenceHash,event.evidenceHash);
  assert.equal(q.tasks[0].status,lane==='repair'?'queued':'blocked');
  assert.equal(applyWorkLineEvent(q,event,lane,51),false);
 }
 for(const field of ['captureFailureEvidenceHash','rejectedProofHash']){
  const q=newInventory(games);Object.assign(q.tasks[0],{failureEvidenceHash:'c'.repeat(64),rejectedProofHash:'b'.repeat(64)});
  assert.throws(()=>applyWorkLineEvent(q,{...event,[field]:'f'.repeat(64)},'repair',50));
 }
});
test('capture failure independently creates repair work, next game remains selectable, repair returns without semantic completion',async()=>{
 const admission=newInventory(games),repair=newInventory(games);prepare(admission,1);prepare(admission,2);
 const failure={schema:'sg-work-line-event-v1',kind:'capture-failed',gameId:1,sourceAllowance:0,
  proofHash:admission.tasks[0].proofHash,evidenceHash:'c'.repeat(64),reason:'ROUTE_REVIEW_REQUIRED'};
 assert(applyWorkLineEvent(admission,failure,'admission',50));assert(applyWorkLineEvent(repair,failure,'repair',50));
 assert.equal(applyWorkLineEvent(repair,failure,'repair',51),false);
 assert.equal(claimPreparation(repair,{owner:'repair',now:51,lane:'repair'}).gameId,1);
 assert.equal(await preparedCampaignSelector(admission,{verifyProof:async()=>true})({readyGameIds:[1,2],group:'primary'}),2);
 const fixed={schema:'sg-work-line-event-v1',kind:'repair-verified',gameId:1,sourceAllowance:0,
  failureEvidenceHash:failure.evidenceHash,rejectedProofHash:failure.proofHash,evidenceHash:'d'.repeat(64),proof:proof(1,'e')};
 assert(applyWorkLineEvent(admission,fixed,'admission',60));assert.equal(admission.tasks[0].reason,null);
 assert.equal(await preparedCampaignSelector(admission,{verifyProof:async()=>true})({readyGameIds:[1,2],group:'primary'}),1);
 assert.equal(admission.sourceAllowance,0);
 assert.equal(applyWorkLineEvent(admission,failure,'admission',61),false);
});

test('native closure aligns an admission mirror fenced before the source failure arrived, without readiness',()=>{
 const q=newInventory(games),task=q.tasks[0];Object.assign(task,{status:'blocked',lane:'repair',proof:null,
  rejectedProofHash:'a'.repeat(64),failureEvidenceHash:'b'.repeat(64)});
 const event={schema:'sg-work-line-event-v1',kind:'native-repair-settled',gameId:1,sourceAllowance:0,
  evidenceHash:'d'.repeat(64),captureFailureEvidenceHash:'c'.repeat(64),rejectedProofHash:'e'.repeat(64),repairKey:'game-repair:fixture:'+'f'.repeat(64)};
 assert(applyWorkLineEvent(q,event,'admission',50));assert.equal(task.status,'blocked');assert.equal(task.proof,null);
 assert.equal(task.failureEvidenceHash,event.evidenceHash);assert.equal(task.rejectedProofHash,event.rejectedProofHash);
 assert.equal(task.captureFailureEvidenceHash,event.captureFailureEvidenceHash);
});
test('late native closure cannot revoke a newer admission proof or replace an unrelated repair fault',()=>{
 const event={schema:'sg-work-line-event-v1',kind:'native-repair-settled',gameId:1,sourceAllowance:0,
  evidenceHash:'d'.repeat(64),captureFailureEvidenceHash:'c'.repeat(64),rejectedProofHash:'e'.repeat(64),repairKey:'game-repair:fixture:'+'f'.repeat(64)};
 const q=newInventory(games);prepare(q,1);const before=structuredClone(q);
 assert.throws(()=>applyWorkLineEvent(q,event,'admission',50),/SETTLEMENT_BINDING/);
 assert.deepEqual(q.tasks,before.tasks);assert.equal(q.revision,before.revision);
 const repair=newInventory(games);Object.assign(repair.tasks[0],{status:'blocked',lane:'repair',failureEvidenceHash:'a'.repeat(64),rejectedProofHash:'b'.repeat(64)});
 assert.throws(()=>applyWorkLineEvent(repair,event,'repair',50),/SETTLEMENT_BINDING/);
});
test('missing money/persistence/Linux/native, foreign repair and proof edits cannot return a game',()=>{
 for(const gate of preparationGates){
  const q=newInventory(games);prepare(q,1);const f={schema:'sg-work-line-event-v1',kind:'capture-failed',gameId:1,sourceAllowance:0,proofHash:q.tasks[0].proofHash,evidenceHash:'c'.repeat(64),reason:'route'};
  applyWorkLineEvent(q,f,'admission',30);const p=proof(1);delete p.gates[gate];
  assert.throws(()=>applyWorkLineEvent(q,{schema:f.schema,kind:'repair-verified',gameId:1,sourceAllowance:0,proof:p,evidenceHash:'d'.repeat(64),failureEvidenceHash:f.evidenceHash,rejectedProofHash:f.proofHash},'admission',40),/PROOF_GATE/);
  assert.equal(q.tasks[0].status,'blocked');
 }
});
test('prepared inventory never widens online admission and a shared hold remains with its independent gate',async()=>{
 const q=newInventory(games);prepare(q,1);
 const select=preparedCampaignSelector(q,{verifyProof:async()=>false});assert.equal(await select({readyGameIds:[1],group:'primary'}),null);
 assert.equal(await preparedCampaignSelector(q,{verifyProof:async()=>true})({readyGameIds:[2],group:'primary'}),null);
});

test('one corrupt static preparation proof is recorded and skipped before selecting the next valid game',async()=>{
 const q=newInventory(games);prepare(q,1);prepare(q,2);q.tasks[0].proofHash='d'.repeat(64);
 const rejected=[];
 const select=preparedCampaignSelector(q,{verifyProof:async()=>true,onRejected:r=>rejected.push(r)});
 assert.equal(await select({readyGameIds:[1,2],group:'primary'}),2);
 assert.deepEqual(rejected,[{gameId:1,reason:'WORK_LINE_PROOF_CHANGED'}]);
 assert.equal(q.sourceAllowance,0);
 const filesUnavailable=preparedCampaignSelector(q,{verifyProof:async()=>{throw Error('MISSING_STATIC_EVIDENCE');}});
 assert.equal(await filesUnavailable({readyGameIds:[1,2],group:'primary'}),null);
});

