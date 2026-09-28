import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerState,RunnerPool} from './state-store.mjs';

function fixture() {
  const docs=new Map();let failCAS=0,time=100_000;
  const transport={async request(op,r){
    if(op==='resources')return {};
    const k=r.collection+'/'+r.key,old=docs.get(k);
    if(op==='read')return old?structuredClone(old):null;
    if(op==='create'){if(old)return {created:false};docs.set(k,{version:0,value:structuredClone(r.value)});return {created:true};}
    if(op==='cas'){
      if(failCAS>0){failCAS--;return {replaced:false};}
      if(!old || old.version!==r.version)return {replaced:false};
      docs.set(k,{version:r.version+1,value:structuredClone(r.value)});return {replaced:true,version:r.version+1};
    }
    throw Error('BAD_OP');
  }};
  const gate={observe(){},status:()=>({allowed:true})};
  const store=new RunnerState({transport,gate,now:()=>time,sleep:async()=>{}});
  const plan={trialId:'sg_r1_20260928_32723',target:299900};
  const pool=new RunnerPool({store,plan,group:'primary',now:()=>time});
  const setup=()=>store.create('state',pool.key,{enabled:true,failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{}});
  return {docs,store,pool,setup,now:()=>time,advance(ms){time+=ms;},contend(){failCAS=3;}};
}
test('late workers obtain distinct ranges; CAS conflicts do not duplicate allocation',async()=>{
  const f=fixture();await f.setup();
  const a=await f.pool.register(0,{owner:'job-a',sessionHash:'a'.repeat(64)});
  const first=await f.pool.take(a);assert.deepEqual([first.start,first.end],[1,100]);
  f.contend();const b=await f.pool.register(1,{owner:'job-b',sessionHash:'b'.repeat(64)});
  const second=await f.pool.take(b);assert.deepEqual([second.start,second.end],[101,200]);
  assert.deepEqual(await f.pool.take(a),first);
});
test('expired batch is retained for review, never handed to a replacement session',async()=>{
  const f=fixture();await f.setup();const lease=await f.pool.register(0,{owner:'old',sessionHash:'a'.repeat(64)});
  await f.pool.take(lease);f.advance(600_001);
  await assert.rejects(f.pool.register(0,{owner:'new',sessionHash:'a'.repeat(64)}),{code:'BATCH_RESUME_REVIEW_REQUIRED'});
  await assert.rejects(f.pool.take(lease),{code:'LEASE_LOST'});
});
test('group, session and duplicate-session checks preserve bindings',async()=>{
  const f=fixture();await f.setup();
  await assert.rejects(f.pool.register(20,{owner:'x',sessionHash:'a'.repeat(64)}),{code:'WORKER_GROUP_MISMATCH'});
  await f.pool.register(0,{owner:'a',sessionHash:'a'.repeat(64)});
  await assert.rejects(f.pool.register(1,{owner:'b',sessionHash:'a'.repeat(64)}),{code:'SHARED_SESSION'});
  f.advance(600_001);
  await assert.rejects(f.pool.register(0,{owner:'a2',sessionHash:'b'.repeat(64)}),{code:'SESSION_CHANGED'});
});
test('immutable journals reject changed content and never overwrite evidence',async()=>{
  const f=fixture();await f.store.create('journal','request:1',{payload:'intent'},{immutable:true});
  await assert.rejects(f.store.create('journal','request:1',{payload:'changed'},{immutable:true}),{code:'JOURNAL_CONTENT_CONFLICT'});
  assert.equal((await f.store.get('journal','request:1')).value.payload,'intent');
});
test('completion requires all batch records, not largest sequence; cannot credit twice',async()=>{
  const f=fixture();await f.setup();const lease=await f.pool.register(0,{owner:'a',sessionHash:'a'.repeat(64)}),batch=await f.pool.take(lease);
  await assert.rejects(f.pool.complete(lease,batch,{pending:null,confirmed:99,fullReadback:true}));
  await f.pool.complete(lease,batch,{pending:null,confirmed:100,fullReadback:true});
  await assert.rejects(f.pool.complete(lease,batch,{pending:null,confirmed:100,fullReadback:true}),{code:'BATCH_OWNER_MISMATCH'});
  assert.equal((await f.store.get('state',f.pool.key)).value.confirmed,100);
});
