import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerState} from './state-store.mjs';
import {ResourceGate} from './resource-gate.mjs';

test('concurrent guards observe one advancing sample and retain overload recovery',async()=>{
 let now=100000,calls=0,resolve,user=0,idle=0;
 const gate=new ResourceGate({now:()=>now});
 const sample=cpu=>({sampledAtMs:now,bootId:'boot',cpuTicks:[user+=cpu,0,0,idle+=100-cpu,0,0,0,0],
  memTotalKiB:100000,memAvailableKiB:50000,diskFreeBytes:100*1024**3});
 const store=new RunnerState({gate,now:()=>now,transport:{request:async op=>{
  assert.equal(op,'resources');calls++;return new Promise(r=>resolve=r);
 }}});
 async function observe(cpu){const pending=Array.from({length:80},()=>store.sample());
  resolve(sample(cpu));return Promise.all(pending);}
 for(let i=0;i<8;i++){const states=await observe(10);assert(states.every(s=>s.allowed===(i===7)));now+=10000;}
 assert.equal(calls,8);assert.equal(gate.observation.samples,8);
 assert((await observe(96)).every(s=>!s.allowed));now+=10000;
 for(let i=0;i<7;i++){assert((await observe(10)).every(s=>s.allowed===(i===6)));now+=10000;}
 gate.hold('SPACE_HOLD');assert((await observe(10)).every(s=>!s.allowed));
});

test('failed shared read rejects every guard, invalidates gate, and permits a new read',async()=>{
 let calls=0,reject;
 const observed=[],gate={observe:s=>observed.push(s),status:()=>({allowed:false})};
 const store=new RunnerState({gate,now:()=>100000,transport:{request:async()=>{
  calls++;return new Promise((_,r)=>reject=r);
 }}});
 const pending=Array.from({length:80},()=>store.sample());reject(Error('METRICS_UNAVAILABLE'));
 const result=await Promise.allSettled(pending);
 assert(result.every(r=>r.status==='rejected'));assert.equal(calls,1);assert.deepEqual(observed,[null]);
 const next=store.sample();assert.equal(calls,2);reject(Error('METRICS_UNAVAILABLE'));
 await assert.rejects(next,/METRICS_UNAVAILABLE/);assert.equal(store.lastSample,-Infinity);
});
