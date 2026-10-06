import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePageVerificationCache} from './sg-native-page-verification-cache.mjs';

const plan=()=>({gameId:123,trialId:'synthetic',adapter:'native-nextgen-v1',buy:0});
const page=()=>Array.from({length:100},(_,i)=>({_id:String(i),sequence:i+1,contentHash:'a'.repeat(64),
 raw:{steps:[{responseXml:'<round><win>1.00</win></round>'}]},normalized:{bet:1,mul:1,buy:0}}));
const complete=async(_plan,records)=>({verified:true,count:records.length});

test('three independent full reads reuse only the verified page content',async()=>{
 let reads=0,independentChecks=0;
 const cache=createNativePageVerificationCache({verify:async(p,rows)=>{independentChecks++;return complete(p,rows);}});
 for(let pass=0;pass<3;pass++){
  reads++;assert.deepEqual(await cache.verify(plan(),page()),{verified:true,count:100});
 }
 assert.equal(reads,3);assert.equal(independentChecks,1);
 assert.deepEqual(cache.status(),{pages:1,hits:2,checks:1,maxPages:4096});
});

test('unchanged IDs and declared hashes cannot hide altered raw XML, amounts, metadata, ordering or plan',async()=>{
 const cache=createNativePageVerificationCache({verify:complete});
 await cache.verify(plan(),page());
 for(const change of [r=>r[0].raw.steps[0].responseXml='<round><win>2.00</win></round>',
  r=>r[0].normalized.bet=2,r=>r[0].extra='changed',r=>r.reverse(),r=>r.pop()]){
  const rows=page();change(rows);await cache.verify(plan(),rows);
 }
 await cache.verify({...plan(),buy:1},page());
 assert.equal(cache.status().checks,7);assert.equal(cache.status().hits,0);
});

test('failed, unknown and partial verification never produce reusable receipts',async()=>{
 for(const verify of [async()=>{throw Object.assign(Error('UNKNOWN'),{outcomeUnknown:true});},
  async()=>({verified:false,count:100}),async()=>({verified:true,count:99})]){
  const cache=createNativePageVerificationCache({verify});
  await assert.rejects(cache.verify(plan(),page()));await assert.rejects(cache.verify(plan(),page()));
  assert.deepEqual(cache.status(),{pages:0,hits:0,checks:2,maxPages:4096});
 }
});

test('successful verification of an input changed while awaiting is rejected and not cached',async()=>{
 const rows=page(),p=plan();let release;
 const cache=createNativePageVerificationCache({verify:async()=>{await new Promise(r=>release=r);return {verified:true,count:100};}});
 const pending=cache.verify(p,rows);rows[0].normalized.bet=2;release();
 await assert.rejects(pending,/INPUT_CHANGED/);assert.equal(cache.status().pages,0);
});

test('receipt mutation cannot alter cached success and LRU storage stays bounded',async()=>{
 const cache=createNativePageVerificationCache({verify:complete,maxPages:2});
 const rows=page(),other=page(),third=page();other[0]._id='other';third[0]._id='third';
 const receipt=await cache.verify(plan(),rows);receipt.verified=false;receipt.count=0;
 await cache.verify(plan(),other);assert.deepEqual(await cache.verify(plan(),rows),{verified:true,count:100});
 await cache.verify(plan(),third);assert.equal(cache.status().pages,2);
 await cache.verify(plan(),other);assert.equal(cache.status().checks,4);
 assert.throws(()=>createNativePageVerificationCache({verify:complete,maxPages:4097}),/CACHE/);
});
