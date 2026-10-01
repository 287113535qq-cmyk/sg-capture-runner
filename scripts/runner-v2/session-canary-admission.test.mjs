import test from 'node:test';import assert from 'node:assert/strict';
import {claimSessionCanary,checkCanaryDispatchInputs} from './session-canary-admission.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {RunnerState} from './state-store.mjs';
function fixture(){
 const plan={gameId:32799,trialId:'sg_r1_20261001_32799'};
 const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,sessionLayout:{lanesPerHost:2},activation:'a'.repeat(64),completePreserved:100};
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'session-canary-v1',profileHash:hash(profile),activation:profile.activation,
  captureMinutes:32,resourceObservation:'sg-resource-observation-v1',hostResourceObservation:'sg-host-resource-observation-v1',newBetAllowance:0,
  completePreserved:200,remainingComplete:299800};
 const permit={schema:'sg-count-run-v1',commit:'b'.repeat(40),run:'100:1',profileHash:hash(profile),activation:profile.activation,
  completeBefore:200,remainingComplete:299800,createdAt:1000000,expiresAt:3000000};
 const inputs={role:'formal-count',allocation:'round-one',round_one_limit:'0',runtime_profile:'count-runtime-rhino-canary-20261001.json',formal_relay:'none',relay_parent:''};
 const rows=new Map();const store={async get(c,k){return rows.has(k)?{value:rows.get(k)}:null;},async create(c,k,v,{immutable}){
  assert.equal(c,'journal');assert.equal(immutable,true);assert(!rows.has(k));rows.set(k,v);
 }};return {plan,profile,revision,permit,inputs,store,rows};
}
test('one immutable claim binds the exact source permit without creating quota',async()=>{
 const f=fixture(),result=await claimSessionCanary(f);assert.equal(f.rows.size,1);
 assert.equal(result.value.sourcePermitHash,hash(f.permit));assert.equal(result.value.sourceRequests,0);assert.equal(result.value.newBetAllowance,0);
 await assert.rejects(()=>claimSessionCanary(f),/CANARY_ALREADY_CLAIMED/);
 await assert.rejects(()=>claimSessionCanary({...f,permit:{...f.permit,run:'101:1'}}),/CANARY_ALREADY_CLAIMED/);
});
test('unknown claim acknowledgement is never repeated by another run',async()=>{
 const f=fixture(),create=f.store.create;f.store.create=async(...args)=>{await create(...args);throw new Error('UNKNOWN_ACK');};
 await assert.rejects(()=>claimSessionCanary(f),/UNKNOWN_ACK/);assert.equal(f.rows.size,1);
 await assert.rejects(()=>claimSessionCanary({...f,permit:{...f.permit,run:'101:1'}}),/CANARY_ALREADY_CLAIMED/);
});
test('readback mismatch cannot release a source permission',async()=>{
 const f=fixture();f.store.get=async()=>f.rows.size?{value:{corrupt:true}}:null;
 await assert.rejects(()=>claimSessionCanary(f),/CANARY_ADMISSION_READBACK/);
});
test('two concurrent native-style claims release exactly one source permission',async()=>{
 const f=fixture(),rows=new Map(),transport={async request(op,{collection,key,value}){
  assert.equal(collection,'journal');
  if(op==='read')return rows.has(key)?{version:0,value:rows.get(key)}:null;
  assert.equal(op,'create');if(rows.has(key))return {created:false};rows.set(key,value);return {created:true};
 }};
 const store=new RunnerState({transport});store.writable=async()=>{};
 const admit=async permit=>{await claimSessionCanary({...f,store,permit});await store.create('journal','count-run:'+permit.run,permit,{immutable:true});};
 const results=await Promise.allSettled([admit(f.permit),admit({...f.permit,run:'101:1'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal([...rows.keys()].filter(k=>k.startsWith('count-run:')).length,1);
 assert.equal([...rows.keys()].filter(k=>k.startsWith('session-canary:')).length,1);
});
for(const [key,value] of [['formal_relay','same-allocation-v1'],['relay_parent','99:1'],['runtime_profile','count-runtime-rhino-ag-dispatchfix-20261001.json'],['role','capture']])
 test(`canary rejects ${key} before claiming`,async()=>{const f=fixture();f.inputs[key]=value;
  assert.throws(()=>checkCanaryDispatchInputs(f.inputs),/CANARY_RELAY_REQUIRES_COMPARISON/);
  await assert.rejects(()=>claimSessionCanary(f));assert.equal(f.rows.size,0);
 });
for(const change of [{completeBefore:201},{remainingComplete:299801},{activation:'c'.repeat(64)},{profileHash:'c'.repeat(64)},{run:'100:2'}])
 test(`changed source binding ${Object.keys(change)[0]} cannot claim`,async()=>{const f=fixture();Object.assign(f.permit,change);
  await assert.rejects(()=>claimSessionCanary(f),/CANARY_ADMISSION_BINDING/);assert.equal(f.rows.size,0);
 });
