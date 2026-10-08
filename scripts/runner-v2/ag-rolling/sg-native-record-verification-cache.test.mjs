import test from 'node:test';import assert from 'node:assert/strict';
import {createRecordVerificationCache,createGameRecordVerificationCache} from './sg-native-record-verification-cache.mjs';
const plan={gameId:32708,trialId:'offline-only'},row=n=>({_id:String(n),sequence:n,fixtureOnly:false,raw:{xml:'<value/>'},contentHash:'x',normalized:{money:100}});
const page=(start=1,size=100)=>Array.from({length:size},(_,i)=>row(start+i));
const complete=async(p,rows)=>({verified:true,count:rows.length});
test('regrouped pages retain every read while each exact record is parsed once',async()=>{
 let reads=0;const cache=createRecordVerificationCache({verify:complete});
 for(let pass=0;pass<3;pass++)for(const records of [page(1,50),page(51,50)].map((p,i)=>pass?p.filter((r,j)=>j%2===i).concat(page(i?1:51,50).filter((r,j)=>j%2!==i)):p)){
  reads++;await cache.verify(plan,records);
 }
 assert.equal(reads,6);assert.equal(cache.status().verifiedRecords,100);assert.equal(cache.status().hits,200);
});
for(const [name,alter] of Object.entries({raw:r=>r.raw.xml+='changed',money:r=>r.normalized.money++,metadata:r=>r.extra='changed',declaredHash:r=>r.contentHash='changed'}))
 test('changed '+name+' rechecks despite unchanged id',async()=>{
  const cache=createRecordVerificationCache({verify:complete});await cache.verify(plan,page());const p=page();alter(p[0]);await cache.verify(plan,p);assert.equal(cache.status().verifiedRecords,101);
 });
test('plan, order and scope: new plan rechecks; order alone still checks batch rules',async()=>{
 const cache=createRecordVerificationCache({verify:complete});await cache.verify(plan,page());await cache.verify(plan,page().reverse());assert.equal(cache.status().verifiedRecords,100);
 await cache.verify({...plan,gameId:32715},page());assert.equal(cache.status().verifiedRecords,200);
});
for(const [name,alter] of Object.entries({duplicateId:p=>p[1]._id=p[0]._id,duplicateSequence:p=>p[1].sequence=p[0].sequence,fixture:p=>p[0].fixtureOnly=true,zero:p=>p[0].sequence=0,float:p=>p[0].sequence=1.5,overflow:p=>p[0].sequence=2**53}))
 test('cached page rejects '+name,async()=>{const c=createRecordVerificationCache({verify:complete});await c.verify(plan,page());const p=page();alter(p);await assert.rejects(c.verify(plan,p),/BATCH/);});
for(const [name,verify]of [['throw',async()=>{throw Error('UNKNOWN');}],['partial',async()=>({verified:true,count:99})],['false',async()=>({verified:false,count:100})]])
 test(name+' never caches partial evidence',async()=>{const c=createRecordVerificationCache({verify});await assert.rejects(c.verify(plan,page()));assert.equal(c.status().records,0);});
test('mutation during verification does not admit new fingerprints',async()=>{
 let release;const c=createRecordVerificationCache({verify:async(p,rows)=>{await new Promise(r=>release=r);return complete(p,rows);}}),p=page();const pending=c.verify(plan,p);p[0].raw.xml='changed';release();await assert.rejects(pending,/INPUT_CHANGED/);assert.equal(c.status().records,0);
});
test('mutation of a cached member while new members verify is rejected',async()=>{
 let release,block=false;const c=createRecordVerificationCache({verify:async(p,rows)=>{if(block)await new Promise(r=>release=r);return complete(p,rows);}});await c.verify(plan,[row(1)]);block=true;
 const p=[row(1),row(2)],pending=c.verify(plan,p);p[0].raw.xml='changed';release();await assert.rejects(pending,/INPUT_CHANGED/);assert.equal(c.status().records,1);
});
test('bounded LRU and explicit game release',async()=>{
 const c=createRecordVerificationCache({verify:complete,maxRecords:2});await c.verify(plan,[row(1),row(2)]);await c.verify(plan,[row(3)]);assert.equal(c.status().records,2);await c.verify(plan,[row(1)]);assert.equal(c.status().verifiedRecords,4);c.clear();assert.equal(c.status().records,0);
});
test('empty and oversized pages reject',async()=>{const c=createRecordVerificationCache({verify:complete});await assert.rejects(c.verify(plan,[]));await assert.rejects(c.verify(plan,page(1,101)));});
test('one game only, release on completion/block/close never reuses old evidence',async()=>{
 let checks=0;const c=createGameRecordVerificationCache({verify:async(p,rows)=>{checks++;return complete(p,rows);}});
 await c.verify('first',plan,page());await c.verify('first',plan,page());assert.equal(checks,1);
 await c.verify('second',plan,page());assert.equal(checks,2);c.release('first');assert.equal(c.status().gameKey,'second');
 c.release('second');assert.equal(c.status().records,0);await c.verify('second',plan,page());assert.equal(checks,3);c.release();assert.equal(c.status().gameKey,null);
});
test('300000 record regrouping avoids reparse without skipping a fresh page',async()=>{
 const c=createRecordVerificationCache({verify:complete}),size=300000;let reads=0;
 for(let pass=0;pass<2;pass++)for(let start=0;start<size;start+=100){
  const rows=Array.from({length:100},(_,i)=>row(pass?((start+i)*137)%size+1:start+i+1));reads++;await c.verify(plan,rows);
 }
 assert.equal(reads,6000);assert.equal(c.status().records,300000);assert.equal(c.status().verifiedRecords,300000);assert.equal(c.status().hits,300000);
});
