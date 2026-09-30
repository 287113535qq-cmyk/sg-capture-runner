import test from 'node:test';import assert from 'node:assert/strict';
import {reviewClosedBatchDecoration} from './closed-batch-decoration.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('only two exact added null fields can bridge a frozen settlement during retirement',()=>{
 const old={id:50,pending:null,leaseUntil:0,checkpoint:100,journaled:100,sessionHash:hash('synthetic')};
 const batch={...old,pendingOriginal:null,protocolResume:null},receipt={fullReadback:true,batch:old};
 const proof={schema:'sg-closed-batch-null-decoration-v1',batchId:50,currentHash:hash(batch),settledHash:hash(old)};
 assert.deepEqual(reviewClosedBatchDecoration(batch,receipt,proof),old);
 for(const delta of [{checkpoint:99},{leaseUntil:1},{pending:{}},{sessionHash:hash('other')},{extra:null},{protocolResume:{}}, {pendingOriginal:0}]){
  const changed={...batch,...delta};assert.throws(()=>reviewClosedBatchDecoration(changed,receipt,{...proof,currentHash:hash(changed)}));
 }
 assert.deepEqual(batch,{...old,pendingOriginal:null,protocolResume:null});
});
