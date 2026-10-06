import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativePageVerificationCache,createGameNativePageVerificationCache} from './sg-native-page-verification-cache.mjs';
import {readBusinessNativePages} from './sg-business-native-reader.mjs';

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

test('five complete indexed source passes still perform every database page read while reusing successful parser work',async()=>{
 const binding={gameId:'123',trialId:'synthetic'},inventory=Array.from({length:20},(_,w)=>Array.from({length:15000},(_,i)=>({
  _id:String(w*15000+i+1).padStart(64,'0'),trialId:'synthetic',gameId:123,shardId:w,sequence:w*15000+i+1,contentHash:'a'.repeat(64)})));
 const by=new Map(inventory.flat().map(r=>[r._id,r]));let reads=0,checks=0,visits=0;
 const source={find(query){return {toArray:async()=>{reads++;return query._id.$in.map(id=>({...by.get(id)}));}};}};
 const cache=createGameNativePageVerificationCache({verify:async(p,rows)=>{checks++;return complete(p,rows);}}),hashes=[];
 for(let pass=0;pass<5;pass++)hashes.push((await readBusinessNativePages({source,binding,inventory,
  verify:rows=>cache.verify('game-123',plan(),rows),visit:async()=>{visits++;}})).recordsHash);
 assert.equal(reads,15000);assert.equal(visits,15000);assert.equal(checks,3000);assert.equal(new Set(hashes).size,1);
 assert.deepEqual(cache.status(),{gameKey:'game-123',pages:3000,hits:12000,checks:3000,maxPages:4096});
 // A later database read returns changed bytes under the same identity/hash.
 by.get(inventory[0][0]._id).extra='changed';
 const changed=await readBusinessNativePages({source,binding,inventory,verify:rows=>cache.verify('game-123',plan(),rows),visit:async()=>{}});
 assert.equal(reads,18000);assert.equal(checks,3001);assert.notEqual(changed.recordsHash,hashes[0]);
});

test('shared verification cache discards the previous game and releases on completion or block',async()=>{
 let checks=0;const cache=createGameNativePageVerificationCache({verify:async(p,rows)=>{checks++;return complete(p,rows);}});
 await cache.verify('first',plan(),page());await cache.verify('first',plan(),page());assert.equal(checks,1);
 await cache.verify('second',plan(),page());assert.equal(checks,2);assert.equal(cache.status().pages,1);
 await cache.verify('first',plan(),page());assert.equal(checks,3);
 await cache.verify('first',{...plan(),version:2},page());assert.equal(checks,4);
 cache.release('second');assert.equal(cache.status().pages,2);cache.release('first');assert.equal(cache.status().pages,0);
 await cache.verify('first',plan(),page());assert.equal(checks,5);cache.release();assert.equal(cache.status().gameKey,null);
});
