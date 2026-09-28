import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoWriter} from './mongo-writer.mjs';
const record=n=>({_id:String(n).padStart(64,'0'),contentHash:'a'.repeat(64),fixtureOnly:false,buy:0,
  trialId:'sg_r1_20260928_32723',sequence:n,raw:{steps:[]},normalized:{}});
function fixture() {
  const stored=new Map(),confirmed=[],holds=[];let inserts=0,allowed=true,durable=true,lostAck=false;
  const f={stored,confirmed,holds,setAllowed(v){allowed=v;},setDurable(v){durable=v;},
    loseAck(){lostAck=true;},get inserts(){return inserts;}};
  f.gate={status:()=>({allowed:allowed&&!holds.length,reason:'RESOURCE_OVERLOAD',maxBatchSize:10}),hold:r=>holds.push(r)};
  f.sink={read:async ids=>ids.filter(id=>stored.has(id)).map(id=>stored.get(id)),insert:async rows=>{
    inserts++;for(const r of rows)stored.set(r._id,structuredClone(r));
    if(lostAck){lostAck=false;throw Error('socket lost');}
  }};
  f.queue={assertDurable:async()=>assert.equal(durable,true),confirm:async rows=>confirmed.push(...rows)};
  f.permits={acquire:async()=>({assertOwned:async()=>{},release:async()=>{}})};
  f.writer=()=>new MongoWriter(f);return f;
}
test('resource pause preserves queue and sends no reads or inserts',async()=>{
  const f=fixture();f.setAllowed(false);const r=await f.writer().deliver([record(1)]);
  assert.equal(r.paused,true);assert.equal(f.inserts,0);assert.equal(f.confirmed.length,0);
});
test('batch write readback and confirmation happen on Runner; duplicate adds nothing',async()=>{
  const f=fixture(),rows=Array.from({length:25},(_,i)=>record(i+1));
  assert.equal((await f.writer().deliver(rows)).confirmed,25);assert.equal(f.inserts,3);
  assert.equal((await f.writer().deliver(rows)).confirmed,25);assert.equal(f.inserts,3);
});
test('unknown Mongo acknowledgement remains pending; later readback prevents another insert',async()=>{
  const f=fixture();f.loseAck();await assert.rejects(f.writer().deliver([record(1)]),{code:'MONGO_ACK_UNKNOWN'});
  assert.equal(f.confirmed.length,0);assert.equal(f.inserts,1);
  assert.equal((await f.writer().deliver([record(1)])).confirmed,1);assert.equal(f.inserts,1);
});
test('same id and hash but different content is a hold, never overwritten',async()=>{
  const f=fixture();f.stored.set(record(1)._id,{...record(1),buy:1});
  await assert.rejects(f.writer().deliver([record(1)]),{code:'MONGO_CONTENT_CONFLICT'});
  assert.equal(f.inserts,0);assert.deepEqual(f.holds,['MONGO_CONTENT_CONFLICT']);
});
test('lost permit or failed durable queue cannot cause writes',async()=>{
  const f=fixture();f.setDurable(false);await assert.rejects(f.writer().deliver([record(1)]));assert.equal(f.inserts,0);
  f.setDurable(true);f.permits.acquire=async()=>({assertOwned:async()=>{throw Error('LEASE_LOST');},release:async()=>{}});
  await assert.rejects(f.writer().deliver([record(1)]),/LEASE_LOST/);assert.equal(f.inserts,0);
});
test('pause while waiting for write permit is checked again before writing',async()=>{
  const f=fixture();f.permits.acquire=async()=>{f.setAllowed(false);return {assertOwned:async()=>{},release:async()=>{}};};
  assert.equal((await f.writer().deliver([record(1)])).paused,true);assert.equal(f.inserts,0);
});
test('missing or unexpected readback never advances checkpoint',async()=>{
  const f=fixture();f.sink.insert=async()=>{};
  await assert.rejects(f.writer().deliver([record(1)]),{code:'MONGO_ACK_UNKNOWN'});assert.equal(f.confirmed.length,0);
});

test('recovery shrinks a batch even when a larger batch was waiting on a permit',async()=>{
  const f=fixture();let size=100;const lengths=[];
  f.gate.status=()=>({allowed:true,maxBatchSize:size});
  f.permits.acquire=async()=>{size=10;return {assertOwned:async()=>{},release:async()=>{}};};
  const insert=f.sink.insert;f.sink.insert=async rows=>{lengths.push(rows.length);await insert(rows);};
  await f.writer().deliver(Array.from({length:25},(_,i)=>record(i+1)));
  assert.deepEqual(lengths,[10,10,5]);
});
