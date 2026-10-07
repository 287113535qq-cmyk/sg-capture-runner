import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyResumePage} from './sg-resume.mjs';
import {auditTasks} from './sg-admission-audit.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('same-page parser and journal verification overlap; neither alone admits a page',async()=>{
 const parser=deferred(),source=deferred(),events=[];let ended=false;
 const work=verifyResumePage({records:[{}],verifyRecords:()=>{events.push('parser');return parser.promise;},
  verifySources:()=>{events.push('journal');return source.promise;}}).then(()=>{ended=true;});
 await new Promise(setImmediate);assert.deepEqual(events,['parser','journal']);
 parser.resolve({verified:true,count:1});await new Promise(setImmediate);assert.equal(ended,false);
 source.resolve();await work;assert.equal(ended,true);
});
test('failed parser drains outstanding journal read before failure; unknown source never passes',async()=>{
 for(const fail of ['parser','journal']){
  const other=deferred(),error=new Error(fail),events=[];
  const work=verifyResumePage({records:[{}],verifyRecords:()=>fail==='parser'?Promise.reject(error):other.promise,
   verifySources:()=>fail==='journal'?Promise.reject(error):other.promise});
  const caught=work.catch(e=>{events.push('failed');return e;});await new Promise(setImmediate);assert.deepEqual(events,[]);
  other.resolve({verified:true,count:1});assert.equal(await caught,error);
 }
});
test('eight audit channels remain bounded and each task is assigned once',async()=>{
 let active=0,peak=0;const seen=new Set();
 await auditTasks(Array.from({length:44},(_,i)=>i),{contexts:Array.from({length:8},(_,i)=>i),audit:async id=>{
  assert(!seen.has(id));seen.add(id);peak=Math.max(peak,++active);await new Promise(setImmediate);active--;
 }});assert.equal(peak,8);assert.equal(active,0);assert.equal(seen.size,44);
 await assert.rejects(auditTasks([],{contexts:Array(9),audit:async()=>{}}),/BOUND/);
});
