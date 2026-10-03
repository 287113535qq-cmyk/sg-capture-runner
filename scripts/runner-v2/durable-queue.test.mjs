import test from 'node:test';
import assert from 'node:assert/strict';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {RunnerState} from './state-store.mjs';

function fixture(){
  const docs=new Map();let now=1000;
  const transport={async request(op,r){
    if(op==='resources')return {};
    if(op==='read_many')return r.keys.filter(k=>docs.has(r.collection+'/'+k)).map(k=>({_id:'primary/'+k,...structuredClone(docs.get(r.collection+'/'+k))}));
    const key=r.collection+'/'+r.key,old=docs.get(key);
    if(op==='read')return old?structuredClone(old):null;
    if(op==='create'){if(old)return {created:false};docs.set(key,{version:0,value:structuredClone(r.value)});return {created:true};}
    if(op==='cas'){
      if(!old||old.version!==r.version)return {replaced:false};
      docs.set(key,{version:r.version+1,value:structuredClone(r.value)});return {replaced:true,version:r.version+1};
    }
    throw Error('BAD_OP');
  }};
  const store=new RunnerState({transport,gate:{observe(){},status:()=>({allowed:true})},now:()=>now,sleep:async()=>{}});
  return {store,transport,advance:ms=>{now+=ms;},now:()=>now};
}

test('durable queue rejects content changes and checkpoint gaps after interruption',async()=>{
  const f=fixture(),plan={trialId:'sg_r1_20260928_32723'},batchKey='batch:x:1';
  await f.store.create('state',batchKey,{id:1,owner:'job',epoch:2,checkpoint:99,journaled:102});
  const queue=new DurableQueue({...f,plan,batchKey,owner:'job',epoch:2});
  const records=[100,101,102].map(sequence=>({trialId:plan.trialId,batchId:1,sequence,payload:'original'}));
  for(const record of records)await queue.append(record);
  assert.deepEqual(await queue.outstanding(),records);
  await assert.rejects(queue.confirm([records[1]]),/CHECKPOINT_GAP/);
  await assert.rejects(queue.assertDurable([{...records[0],payload:'changed'}]),/DURABLE_QUEUE_CONTENT_MISMATCH/);
  await queue.confirm(records.slice(0,2));
  assert.deepEqual(await queue.outstanding(),[records[2]]);
  await f.store.update('state',batchKey,x=>({...x,epoch:3}));
  await assert.rejects(queue.confirm([records[2]]),/BATCH_LEASE_LOST/);
  assert.equal((await f.store.get('journal',receiptKey(plan.trialId,100))).value.payload,'original');
});

test('writer slots bound concurrency and expired holder cannot release replacement slot',async()=>{
  const f=fixture();await f.store.create('state','write-permits',{limit:1,slots:{}});
  const a=new WritePermits({...f,group:'primary',owner:'a'}),b=new WritePermits({...f,group:'primary',owner:'b'});
  const first=await a.acquire();assert(first);assert.equal(await b.acquire(),null);
  f.advance(120001);const second=await b.acquire();assert(second);
  await assert.rejects(first.assertOwned(),/WRITE_PERMIT_LOST/);
  await first.release();await second.assertOwned();
  await second.release();assert(await a.acquire());
});

test('permit acquisition uses the CAS read once, including contention, and preserves missing-limit rejection',async()=>{
 const f=fixture(),events=[],request=f.transport.request.bind(f.transport);
 f.transport.request=async(op,r)=>{events.push(op);return request(op,r);};
 const permits=new WritePermits({...f,group:'primary',owner:'a'});
 await assert.rejects(permits.acquire(),/WRITE_LIMITS_NOT_INITIALIZED/);
 await f.store.create('state','write-permits',{limit:1,slots:{}});events.length=0;
 assert(await permits.acquire());assert.equal(events.filter(op=>op==='read').length,1);
 events.length=0;assert.equal(await new WritePermits({...f,group:'primary',owner:'b'}).acquire(),null);
 assert.deepEqual(events,['read']);
});

test('unknown permit write acknowledgement stops after one mutation without replay or release',async()=>{
 const f=fixture();await f.store.create('state','write-permits',{limit:1,slots:{}});
 const request=f.transport.request.bind(f.transport);let writes=0;
 f.transport.request=async(op,r)=>{
  const result=await request(op,r);
  if(op==='cas'){writes++;throw Object.assign(Error('GATEWAY_ACK_UNKNOWN'),{code:'GATEWAY_ACK_UNKNOWN'});}
  return result;
 };
 await assert.rejects(new WritePermits({...f,group:'primary',owner:'a'}).acquire(),{code:'GATEWAY_ACK_UNKNOWN'});
 assert.equal(writes,1);assert.equal((await f.store.get('state','write-permits')).value.slots['0'].owner,'a');
});
