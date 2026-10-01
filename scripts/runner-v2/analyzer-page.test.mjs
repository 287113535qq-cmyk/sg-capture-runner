import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAnalyzerPage} from './analyzer-page.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
const records=n=>Array.from({length:n},(_,i)=>({_id:hash(i),contentHash:hash('content'+i)}));
function parser(change=x=>x){const calls=[];return {calls,call:async r=>{
 calls.push(r);return change({verified:true,count:r.records.length,idsHash:hash(r.records.map(x=>[x._id,x.contentHash]))});
}};}

test('100 records use one verified private envelope with exact ordered identities',async()=>{
 const p=parser(),rows=records(100);assert.deepEqual(await verifyAnalyzerPage(p,{gameId:32799},rows),{verified:true,count:100});
 assert.equal(p.calls.length,1);assert.equal(p.calls[0].op,'verify_batch');assert.deepEqual(p.calls[0].records,rows);
});
for(const bad of [r=>({...r,verified:false}),r=>({...r,count:r.count-1}),r=>({...r,idsHash:'0'.repeat(64)})])
 test('missing or changed whole-page verification is rejected',async()=>{
  await assert.rejects(verifyAnalyzerPage(parser(bad),{},records(2)),/PAGE_UNVERIFIED/);
 });
test('large pages split below the existing Python pipe limit without dropping records',async()=>{
 const p=parser(),rows=records(2).map(r=>({...r,padding:'x'.repeat(3_150_000)}));
 assert.equal((await verifyAnalyzerPage(p,{},rows)).count,2);assert.equal(p.calls.length,2);
 assert(p.calls.every(r=>Buffer.byteLength(JSON.stringify(r))<6*1024*1024));
});
test('empty, oversized and single oversized-record pages are rejected',async()=>{
 for(const rows of [[],records(101),[{...records(1)[0],padding:'x'.repeat(6*1024*1024)}]])
  await assert.rejects(verifyAnalyzerPage(parser(),{},rows),/PAGE_/);
});
