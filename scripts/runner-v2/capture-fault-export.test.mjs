import test from 'node:test';import assert from 'node:assert/strict';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import {exportCaptureFaultPage} from './capture-fault-export.mjs';
test('actual native document interface exports archived faults using current nextBatchId and bounded pages',async()=>{
 const plan={gameId:1,trialId:'trial'},batch={id:101,checkpoint:0,journaled:0,pending:{awaiting:null,sequence:1,raw:{steps:[{reply:'full'}]}}};
 const archive={schema:'sg-abandoned-demo-v1',trialId:'trial',batchId:101,pending:batch.pending,reason:'FLOW_GAP',sourceRequests:0,disposition:'interrupted-abandoned-without-replay'};
 const receipt=captureFaultReceipt({plan,batch,archiveKey:'abandoned-demo:trial:101:hash',archive,group:'primary'});
 const calls=[],store={get:async(c,k)=>({value:k==='campaign'?{games:[{game_id:1}]}:k==='pool:trial'?{nextBatchId:103}:k.startsWith('capture-fault:')?receipt:archive}),getMany:async(c,keys)=>{calls.push(keys);return keys.map(k=>k==='batch:trial:101'?{value:{id:101,workLineFault:'capture-fault:trial:101:hash'}}:null);}};
 const first=await exportCaptureFaultPage({store,plan,publication:{},limit:100});assert.equal(first.hasMore,true);assert.equal(first.exports.length,0);assert.equal(calls[0].length,100);
 const last=await exportCaptureFaultPage({store,plan,publication:{},afterBatchId:first.nextBatchId,limit:100});assert.equal(last.exports.length,1);assert.equal(last.hasMore,false);assert.equal(last.nextBatchId,102);assert.equal(last.sourceRequests,0);
 await assert.rejects(exportCaptureFaultPage({store,plan,publication:{},limit:101}));
});
