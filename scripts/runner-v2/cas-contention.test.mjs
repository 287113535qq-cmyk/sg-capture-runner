import test from 'node:test';
import assert from 'node:assert/strict';
import {contentionDelay} from './cas-contention.mjs';
import {RunnerState} from './state-store.mjs';
test('conflict delay stays bounded with independent schedules and refuses invalid randomness',()=>{
 for(const attempt of [0,1,24,25,159]){
  const ceiling=Math.min(250,10+attempt*10);
  assert.equal(contentionDelay(attempt,()=>0),Math.floor(ceiling/2));
  assert(contentionDelay(attempt,()=>0.9999)<ceiling);
 }
 for(const sample of [-1,1,NaN,Infinity])assert.throws(()=>contentionDelay(0,()=>sample),/RANDOM/);
 assert.throws(()=>contentionDelay(-1),/ATTEMPT/);
});
test('only explicit CAS conflict jitters; fresh snapshot is rechecked and unknown acknowledgement has no retry',async()=>{
 let reads=0,writes=0;const sleeps=[];const gate={observe(){},status:()=>({allowed:true})};
 const transport={async request(op,r){if(op==='resources')return {};if(op==='read'){reads++;return {version:reads-1,value:{owner:reads===1?'self':'peer'}};}
  writes++;return {replaced:false,version:r.version+1};}};
 const store=new RunnerState({transport,gate,random:()=>0.5,sleep:async ms=>{sleeps.push(ms);}});
 await assert.rejects(store.update('state','pool:trial',v=>{assert.equal(v.owner,'self','LEASE_LOST');return {...v,count:1};}),/LEASE_LOST/);
 assert.equal(writes,1);assert.equal(reads,2);assert.deepEqual(sleeps,[7]);
 sleeps.length=0;transport.request=async op=>{if(op==='resources')return {};if(op==='read')return {version:1,value:{}};throw Error('UNKNOWN_ACK');};
 await assert.rejects(store.update('state','pool:trial',v=>({...v,count:1})),/UNKNOWN_ACK/);assert.deepEqual(sleeps,[]);
});
