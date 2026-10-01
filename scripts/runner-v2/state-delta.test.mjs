import test from 'node:test';
import assert from 'node:assert/strict';
import {stateDelta} from './state-delta.mjs';
import {RunnerState} from './state-store.mjs';

function apply(before,delta){
 const out=structuredClone(before);
 for(const [path,value] of Object.entries(delta.set)){
  const parts=path.split('.'),last=parts.pop();let node=out;
  for(const part of parts)node=node[part]??={};node[last]=structuredClone(value);
 }
 for(const path of delta.unset){const parts=path.split('.'),last=parts.pop();let node=out;for(const part of parts)node=node[part];delete node[last];}
 return out;
}
test('delta exactly preserves unrelated history, arrays, removals, null and empty objects',()=>{
 const old={history:Array.from({length:2000},(_,i)=>({id:i,proof:'a'.repeat(64)})),workers:{0:{lease:1,active:{id:2}},1:{lease:7}},counter:0,removed:true};
 const next=structuredClone(old);next.workers[0].lease=3;next.workers[0].active=null;next.workers[0].extra={};next.counter=1;delete next.removed;
 const delta=stateDelta(old,next);assert(delta);assert.deepEqual(apply(old,delta),next);
 assert.equal(delta.set['workers.0.lease'],3);assert.equal(delta.set['workers.0.active'],null);
 assert(!Object.keys(delta.set).some(k=>k.startsWith('history')));assert.equal(old.workers[0].lease,1);
 const array={x:[1,2,3]},changed={x:[1,7]};assert.deepEqual(stateDelta(array,changed),{set:{x:[1,7]},unset:[]});
});
test('unsupported or large deltas retain full CAS and never produce ambiguous Mongo paths',()=>{
 assert.equal(stateDelta({a:1},{a:1}),null);
 assert.equal(stateDelta({'a.b':1},{'a.b':2}),null);
 assert.equal(stateDelta({constructor:1},{constructor:2}),null);
 assert.equal(stateDelta({x:''},{x:'x'.repeat(65536)}),null);
 const old={},next={};for(let i=0;i<65;i++)next['key'+i]=i;assert.equal(stateDelta(old,next),null);
});
test('delta conflict reruns callback against fresh document; lost ownership refuses rather than retrying a write',async()=>{
 let doc={version:0,value:{owner:'self',count:0,other:9}},calls=[],conflict=true,callback=0;
 const store=new RunnerState({deltaCas:true,gate:{observe(){},status:()=>({allowed:true})},sleep:async()=>{},transport:{async request(op,r){
  if(op==='resources')return {};calls.push({op,...r});
  if(op==='read')return structuredClone(doc);
  assert.equal(op,'cas_delta');
  if(conflict){conflict=false;doc={version:1,value:{owner:'peer',count:0,other:10}};return {replaced:false,version:r.version+1};}
  if(r.version!==doc.version)return {replaced:false,version:r.version+1};doc={version:r.version+1,value:apply(doc.value,r)};return {replaced:true,version:doc.version};
 }}});
 await assert.rejects(store.update('state','pool:trial',v=>{callback++;assert.equal(v.owner,'self','LEASE_LOST');v.count++;return v;}),/LEASE_LOST/);
 assert.equal(callback,2);assert.equal(calls.filter(c=>c.op==='cas_delta').length,1);assert.equal(doc.value.count,0);assert.equal(doc.value.other,10);
});
test('feature off, non-pool metadata and unpatchable values use full CAS; unknown confirmation is not retried',async()=>{
 let calls=[];const transport={async request(op,r){calls.push({op,...r});return op==='resources'?{}:{replaced:true,version:r.version+1};}},gate={observe(){},status:()=>({allowed:true})};
 const old={version:0,value:{a:1}},next={a:2};
 const legacy=new RunnerState({transport,gate});await legacy.cas('state','pool:trial',old,next);assert.equal(calls.at(-1).op,'cas');
 const enabled=new RunnerState({transport,gate,deltaCas:true});await enabled.cas('state','batch:trial:1',old,next);assert.equal(calls.at(-1).op,'cas');
 await enabled.cas('state','pool:trial',old,next);assert.equal(calls.at(-1).op,'cas_delta');assert(!Object.hasOwn(calls.at(-1),'value'));
 enabled.transport={async request(op){if(op==='resources')return {};throw Error('UNKNOWN_CONFIRMATION');}};
 await assert.rejects(enabled.cas('state','pool:trial',old,next),/UNKNOWN_CONFIRMATION/);
 for(const ack of [{version:1},{replaced:true,version:7}]){
  let writes=0;enabled.transport={async request(op){if(op==='resources')return {};writes++;return ack;}};
  await assert.rejects(enabled.cas('state','pool:trial',old,next),/DELTA_CAS_ACK/);assert.equal(writes,1);
 }
});
