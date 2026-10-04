import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTasks,readOnlyAuditTransport,preparingGuard} from './sg-admission-audit.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('four isolated audits visit every task once and drain before returning',async()=>{
 let active=0,peak=0;const seen=new Map();
 await auditTasks(Array.from({length:22},(_,i)=>i),{contexts:[0,1,2,3],audit:async item=>{
  active++;peak=Math.max(peak,active);seen.set(item,(seen.get(item)??0)+1);await pause(2);active--;
 }});
 assert.equal(peak,4);assert.equal(active,0);assert.equal(seen.size,22);assert([...seen.values()].every(n=>n===1));
});
test('an unknown read acknowledgement stops assigning tasks and drains every already issued audit without retry',async()=>{
 let active=0,attempts=0,finished=0;const error=Object.assign(new Error('GATEWAY_ACK_UNKNOWN'),{code:'GATEWAY_ACK_UNKNOWN'});
 await assert.rejects(auditTasks(Array.from({length:20},(_,i)=>i),{contexts:[0,1,2,3],audit:async item=>{
  active++;attempts++;try{if(item===0){await pause(1);throw error;}await pause(15);finished++;}finally{active--;}
 }}),e=>e===error);
 assert.equal(active,0);assert.equal(attempts,4);assert.equal(finished,3);
});
test('admission audit channels cannot issue metadata or source writes and unknown reads are not retried',async()=>{
 const calls=[],unknown=new Error('GATEWAY_ACK_UNKNOWN');let closed=0;
 const reader=readOnlyAuditTransport({async request(op){calls.push(op);if(op==='scan')throw unknown;return []},close(){closed++;}});
 await reader.request('read_many',{collection:'journal',keys:['known']});
 for(const op of ['create','cas','rolling_journal_insert','rounds_insert','BET'])assert.throws(()=>reader.request(op,{}),/READ_ONLY/);
 await assert.rejects(reader.request('scan',{}),e=>e===unknown);assert.deepEqual(calls,['read_many','scan']);reader.close();assert.equal(closed,1);
});
test('parallel admission coalesces owner reads but checks resources for every caller and refreshes ownership after one second',async()=>{
 let clock=1000,reads=0,boundaries=0,resources=0;
 const value={owner:'123:1',queueId:'queue',status:'preparing',activation:'a',commit:'b'};
 const store={async writable(){resources++;},async get(){reads++;await pause(2);return {value:structuredClone(value)};}};
 const guard=preparingGuard({store,boundary:async()=>{boundaries++;await pause(2);},run:'123:1',queueId:'queue',activation:'a',commit:'b',now:()=>clock});
 await Promise.all(Array.from({length:4},()=>guard()));assert.equal(reads,1);assert.equal(resources,4);
 clock+=999;await guard();assert.equal(reads,1);assert.equal(resources,5);
 clock+=1;await Promise.all([guard(),guard()]);assert.equal(reads,2);
 clock+=15000;await Promise.all([guard(),guard(),guard()]);assert.equal(boundaries,1);assert.equal(reads,3);
 clock+=1000;value.activation='foreign';await assert.rejects(guard(),/OWNERSHIP/);
 assert.equal(reads,4);assert.equal(resources,11);
});
