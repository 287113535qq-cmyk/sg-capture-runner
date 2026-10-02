import test from 'node:test';import assert from 'node:assert/strict';
import {newInventory,claimPreparation,finishPreparation,preparationGates} from './preparation-inventory.mjs';
import {applyWorkLineEvent,preparedCampaignSelector} from './work-line-events.mjs';
const games=[{gameId:1,name:'broken'},{gameId:2,name:'next'}];
const proof=(id,rev='a')=>({schema:'sg-reusable-preparation-v1',gameId:id,sourceAllowance:0,revisionHash:rev.repeat(64),
 gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))});
const prepare=(q,id,rev='a')=>{const c=claimPreparation(q,{owner:'test',now:id*10,lane:q.tasks.find(t=>t.gameId===id).lane});assert.equal(c.gameId,id);finishPreparation(q,c,{status:'prepared',proof:proof(id,rev)},id*10+1);};
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
