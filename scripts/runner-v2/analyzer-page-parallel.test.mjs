import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyParallelEnvelope} from './analyzer-page-parallel.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const rows=()=>Array.from({length:5},(_,i)=>({_id:hash(i),contentHash:hash('content'+i),sequence:i+1}));
const reply=r=>({verified:true,count:r.records.length,idsHash:hash(r.records.map(x=>[x._id,x.contentHash]))});
test('two pipes run concurrently, preserve whole-page ordered hash and handle odd sizes',async()=>{
 let release,entered=0;const barrier=new Promise(resolve=>release=resolve),sizes=[];
 const parser={call:async r=>{sizes.push(r.records.length);if(++entered===2)release();await barrier;return reply(r);}};
 const r={op:'verify_batch',plan:{},records:rows()};
 assert.deepEqual(await verifyParallelEnvelope(parser,parser,r),reply(r));assert.deepEqual(sizes,[3,2]);
});
test('one failed half waits for the other half, rejects whole page and leaves no pending receipt',async()=>{
 let finished=false;
 const first={call:async()=>{throw Error('INVALID_XML');}};
 const second={call:async r=>{await new Promise(resolve=>setTimeout(resolve,20));finished=true;return reply(r);}};
 await assert.rejects(verifyParallelEnvelope(first,second,{op:'verify_batch',records:rows()}),/INVALID_XML/);
 assert.equal(finished,true);
});
for(const change of [r=>({...r,verified:false}),r=>({...r,count:r.count-1}),r=>({...r,idsHash:hash('wrong')})])
 test('changed half receipt cannot complete the whole page',async()=>{
  await assert.rejects(verifyParallelEnvelope({call:async r=>reply(r)},{call:async r=>change(reply(r))},{op:'verify_batch',records:rows()}),/PAGE_UNVERIFIED/);
 });
test('cross-half duplicate or reversed sequence, invalid limits and worker settings are refused',async()=>{
 let calls=0;const parser={call:async r=>{calls++;return reply(r);}};
 const duplicate=rows();duplicate[4]._id=duplicate[0]._id;
 const reversed=rows();reversed[4].sequence=1;
 for(const records of [duplicate,reversed,[],Array.from({length:101},(_,i)=>({_id:hash(i),sequence:i+1}))])
  await assert.rejects(verifyParallelEnvelope(parser,parser,{op:'verify_batch',records}),/PAGE_/);
 assert.equal(calls,0);
 const {analyzer}=await import('./analyzer.mjs');assert.throws(()=>analyzer({auditWorkers:4}),/AUDIT_WORKERS/);
});
