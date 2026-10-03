import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {protocolHash as hash} from './protocol-resume.mjs';
import {automaticFlowReplay,deliverConfirmedFlowEvidence,exportConfirmedFlowEvidence} from './confirmed-flow-evidence.mjs';
import {preparationReplayEvidence} from './preparation-replay-evidence.mjs';
import {reviewedPreparation} from './preparation-handlers.mjs';
import {applyWorkLineEvent,preparedCampaignSelector} from './work-line-events.mjs';
import {newInventory,preparationGates} from './preparation-inventory.mjs';
const plan={gameId:1,trialId:'fixture',runtimeGameId:10,sourceKey:'fixture',maxSteps:10};
const raw={fixtureOnly:false,sourceKey:plan.sourceKey,steps:[{msgId:'BET'}]};
const record={_id:'fixture-round',gameId:1,trialId:'fixture',runtimeGameId:10,fixtureOnly:false,raw,
 normalized:{money:{betRaw:20},classificationStatus:'pending'}};
const sample=()=>({schema:'sg-confirmed-flow-evidence-v1',gameId:1,plan,planHash:hash(plan),
 record:structuredClone(record),readback:structuredClone(record),recordHash:hash(record),sourceAllowance:0});
const proof=id=>({schema:'sg-reusable-preparation-v1',gameId:id,revisionHash:'a'.repeat(64),sourceAllowance:0,
 gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))});
test('confirmed full readback joins the exact fault, independently replays flow and money, and returns without semantics',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-flow-reentry-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const q=newInventory([{gameId:1},{gameId:2}]),repair=structuredClone(q);
 for(const x of [q,repair])for(const task of x.tasks){task.status='prepared';task.proof=proof(task.gameId);task.proofHash=hash(task.proof);}
 const evidence={plan,raw:{...raw,steps:[{msgId:'BET'},{msgId:'FREE_GAME'}]}},fault={schema:'sg-flow-repair-task-v1',gameId:1,evidence,evidenceHash:hash(evidence),sourceAllowance:0};
 const event={schema:'sg-work-line-event-v1',kind:'capture-failed',gameId:1,evidenceHash:fault.evidenceHash,
  proofHash:q.tasks[0].proofHash,reason:'FLOW_GAP',sourceAllowance:0};
 applyWorkLineEvent(q,event,'admission',1);applyWorkLineEvent(repair,event,'repair',1);
 const current=repair.tasks[0];assert.equal(automaticFlowReplay(root,fault,current,'a'.repeat(64)),null);
 // A different admitted game remains selectable while both analysis and repair are pending.
 assert.equal(await preparedCampaignSelector(q,{verifyProof:async()=>true})({readyGameIds:[1,2],group:'primary'}),2);
 deliverConfirmedFlowEvidence(root,sample());
 const task=automaticFlowReplay(root,fault,current,'a'.repeat(64));assert(task);
 assert.equal(automaticFlowReplay(root,fault,{...current,failureEvidenceHash:'c'.repeat(64)},'a'.repeat(64)),null);
 const next=r=>r.steps.length===2?{MSGID:'FREE_GAME'}:null;
 const result=await preparationReplayEvidence({task,revisionHash:task.revisionHash,runnerNext:next,
  parser:{call:async p=>{assert.notEqual(p.op,'classify');return p.op==='next'?next(p.raw):p.op==='verify'?{verified:true}:{validated:true};}},
  independentFields:()=>record.normalized});
 const staticReceipts=['local','linux','native'].map(gate=>({schema:'sg-preparation-gate-v1',gate,gameId:1,
  revisionHash:task.revisionHash,verified:true,sourceAllowance:0,supportingHashes:['d'.repeat(64)]}));
 const ready=reviewedPreparation({gameId:1,revisionHash:task.revisionHash,
  receipts:[...staticReceipts,...result.receipts],failureEvidenceHash:current.failureEvidenceHash});
 assert.equal(ready.status,'prepared');
 applyWorkLineEvent(q,{schema:'sg-work-line-event-v1',kind:'repair-verified',gameId:1,
  evidenceHash:hash(ready.proof),proof:ready.proof,failureEvidenceHash:current.failureEvidenceHash,
  rejectedProofHash:current.rejectedProofHash,sourceAllowance:0},'admission',2);
 assert.equal(q.tasks[0].status,'prepared');assert.equal(result.sourceRequests,0);
});
test('online evidence export reads one immutable receipt and full Mongo document and verifies before sealing',async()=>{
 const r={...record,sequence:1},calls=[];
 const args={plan,sequence:1,store:{get:async(c,k)=>{calls.push([c,k]);return {value:c==='state'?{games:[{game_id:1}]}:r};}},
  transport:{request:async(op,p)=>{assert.equal(op,'rounds_read');assert.equal(p.trialId,plan.trialId);return [structuredClone(r)];}},
  parser:{call:async p=>{assert.equal(p.op,'verify');assert.deepEqual(p.record,r);return {verified:true};}}};
 const task=await exportConfirmedFlowEvidence(args);assert.equal(task.recordHash,hash(r));assert.equal(task.sourceAllowance,0);
 assert.equal(calls.length,2);
 await assert.rejects(exportConfirmedFlowEvidence({...args,transport:{request:async()=>[{...r,sequence:2}]}}),/FULL_READBACK/);
 await assert.rejects(exportConfirmedFlowEvidence({...args,parser:{call:async()=>({verified:false})}}));
});
test('wrong readback, trial, runtime, plan or fixture never becomes flow evidence; repeated input is retained once',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-flow-invalid-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const alter of [x=>x.readback.normalized.money.betRaw++,x=>x.record.trialId='other',
  x=>x.record.runtimeGameId++,x=>x.planHash='c'.repeat(64),x=>x.record.raw.fixtureOnly=true]){
  const s=sample();alter(s);assert.throws(()=>deliverConfirmedFlowEvidence(root,s));
 }
 assert(!fs.existsSync(path.join(root,'.local')));
 const first=deliverConfirmedFlowEvidence(root,sample());assert.deepEqual(deliverConfirmedFlowEvidence(root,sample()),first);
 assert.equal(first.prepared,false);
});
