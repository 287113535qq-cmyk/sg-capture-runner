import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {deliverCaptureFault} from './capture-fault-delivery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparationGates} from './preparation-inventory.mjs';
test('verified original source publication and archive automatically deliver to all independent queues',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-fault-delivery-'));
 try{
  const plan={gameId:1,trialId:'trial'},batch={id:1,checkpoint:0,journaled:0,pending:{awaiting:null,sequence:1,raw:{steps:[{payload:'original'}]}}};
  const archive={schema:'sg-abandoned-demo-v1',trialId:'trial',batchId:1,pending:batch.pending,reason:'FLOW_GAP',sourceRequests:0,disposition:'interrupted-abandoned-without-replay'};
  const receipt=captureFaultReceipt({plan,batch,archiveKey:'abandoned-demo:trial:1:hash',archive,group:'primary'}),proof={schema:'sg-reusable-preparation-v1',gameId:1,revisionHash:'a'.repeat(64),sourceAllowance:0,gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))};
  const publication={schema:'sg-prepared-publication-v1',sourceAllowance:0,bindings:{1:{group:'primary',planHash:hash(plan),proofHash:hash(proof)}},inventory:{tasks:[{gameId:1,status:'prepared',proof,proofHash:hash(proof)}]}};
  const envelope={schema:'sg-capture-fault-export-v1',sourceAllowance:0,receipt,plan,batch,archive,publication};
  const result=deliverCaptureFault(root,envelope);assert.equal(result.status,'repair-and-analysis-delivered');
  assert.deepEqual(result,deliverCaptureFault(root,envelope));assert.equal(result.sourceRequests,0);
  assert.equal(fs.readdirSync(path.join(root,'.local/preparation-worker/repair/inbox')).length,1);
  const changed=structuredClone(envelope);changed.archive.pending.raw.steps=[];assert.throws(()=>deliverCaptureFault(root,changed));
  const foreign=structuredClone(envelope);foreign.publication.bindings[1].planHash='a'.repeat(64);assert.throws(()=>deliverCaptureFault(root,foreign));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
