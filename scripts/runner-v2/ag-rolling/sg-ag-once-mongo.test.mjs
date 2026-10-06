import assert from 'node:assert/strict';
import test from 'node:test';
import {protectMongoOnce,isBusinessDriverFailure} from './sg-ag-once-mongo.mjs';
import {mongoOnce} from './sg-ag-ordinary-business.mjs';

test('only the actual protected driver failure receives business provenance and is never retried',async()=>{
 for(const synchronous of [false,true]){
  let calls=0;const fault=Error('driver socket closed'),once=protectMongoOnce({read(){calls++;
   if(synchronous)throw fault;return Promise.reject(fault);}});
  await assert.rejects(async()=>once.client.read(),error=>error===fault&&error.outcomeUnknown===true);
  assert.equal(isBusinessDriverFailure(fault),true);
  assert.throws(()=>once.client.read(),/UNKNOWN_NO_REPLAY/);assert.equal(calls,1);
 }
 assert.equal(isBusinessDriverFailure({businessDriverFailure:true,outcomeUnknown:true}),false);
});

test('outer business wrappers and nested protected drivers never rebrand an unknown native callback',async()=>{
 const native=Object.assign(Error('GATEWAY_ACK_UNKNOWN'),{outcomeUnknown:true});
 const inner=protectMongoOnce({async read(){throw native;}}),outer=protectMongoOnce(inner.client);
 await assert.rejects(mongoOnce(()=>outer.client.read()),error=>error===native);
 assert.equal(isBusinessDriverFailure(native),false);
 const callback=Error('native callback readback failed');
 await assert.rejects(mongoOnce(async()=>{throw callback;}),error=>error===callback&&error.outcomeUnknown===true);
 assert.equal(isBusinessDriverFailure(callback),false);
 const wrapped=protectMongoOnce({async read(){throw callback;}});
 await assert.rejects(wrapped.client.read());assert.equal(isBusinessDriverFailure(callback),false);
});

test('a nested protected genuine driver error keeps its provenance',async()=>{
 const fault=Error('driver failure'),inner=protectMongoOnce({async read(){throw fault;}}),outer=protectMongoOnce(inner.client);
 await assert.rejects(mongoOnce(()=>outer.client.read()),error=>error===fault);
 assert.equal(isBusinessDriverFailure(fault),true);
});

test('business wrapper exempts only exact local deadline guard and never clears existing unknown outcome',async()=>{
 for(const attributes of [{},{code:'OTHER'},{code:'RESOURCE_WAIT_DEADLINE'},{code:'RESOURCE_WAIT_DEADLINE',outcomeUnknown:true}]){
  const fault=Object.assign(Error('RESOURCE_WAIT_DEADLINE'),attributes);
  await assert.rejects(mongoOnce(async()=>{throw fault;}),error=>error===fault);
  assert.equal(fault.outcomeUnknown,attributes.code==='RESOURCE_WAIT_DEADLINE'&&attributes.outcomeUnknown!==true?undefined:true);
 }
 const driverFault=Object.assign(Error('RESOURCE_WAIT_DEADLINE'),{code:'RESOURCE_WAIT_DEADLINE'});
 const once=protectMongoOnce({async read(){throw driverFault;}});
 await assert.rejects(mongoOnce(()=>once.client.read()),error=>error===driverFault&&error.outcomeUnknown===true);
 assert.equal(isBusinessDriverFailure(driverFault),true);
});
