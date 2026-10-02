import test from 'node:test';import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
const plan={trialId:'trial',gameId:1},batch={id:2,checkpoint:0,journaled:0,pending:{awaiting:null,sequence:1,raw:{steps:[{responsePayload:'full'}]}}};
const archive={schema:'sg-abandoned-demo-v1',trialId:'trial',batchId:2,pending:structuredClone(batch.pending),sourceRequests:0,disposition:'interrupted-abandoned-without-replay',reason:'FLOW_GAP'};
test('durable source failure produces independent flow and semantic work, never source allowance',()=>{
 const result=captureFaultReceipt({plan,batch,archiveKey:'abandoned-demo:trial:2:hash',archive,group:'primary'});
 assert.equal(result.flowRepairStatus,'queued');assert.equal(result.protocolAnalysisStatus,'queued');assert.equal(result.sourceAllowance,0);assert.equal(result.requiresNewSession,true);
 assert.equal(result.raw,undefined);assert.equal(result.archiveKey,'abandoned-demo:trial:2:hash');
});
test('unknown response, unconfirmed write or changed private archive cannot produce a repair receipt',()=>{
 for(const b of [{...batch,pending:{...batch.pending,awaiting:{request:'unknown'}}},{...batch,checkpoint:1}])assert.throws(()=>captureFaultReceipt({plan,batch:b,archiveKey:'abandoned-demo:trial:2:hash',archive,group:'primary'}));
 assert.throws(()=>captureFaultReceipt({plan,batch,archiveKey:'abandoned-demo:trial:2:hash',archive:{...archive,pending:{...archive.pending,raw:{steps:[]}}},group:'primary'}));
});
