import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {captureBatch} from './capture-batch.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const python=spawnSync(process.env.PYTHON??'python',['-c',
 "import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_fifteen_review import fifteen_sample,negative_samples;from test_pyramids_free_review import PLAN;from pyramids_fields import PyramidsFields,SOURCE,EXTENSION;from pyramids_fifteen_review import EXTENSION as FIFTEEN;from pyramids_major_review import EXTENSION as MAJOR;from round_fields import type_profile;print(json.dumps({'samples':[{'raw':v,'fields':PyramidsFields(PLAN).settled(v)} for v in [fifteen_sample()]+[fifteen_sample(True,n) for n in (0,2,4)]],'negative':negative_samples(),'base':type_profile(SOURCE)[1],'extensions':{'free':type_profile(EXTENSION)[1],'major':type_profile(MAJOR)[1],'fifteen':type_profile(FIFTEEN)[1]}}))"],{encoding:'utf8'});
assert.equal(python.status,0,python.stderr);const fixture=JSON.parse(python.stdout);
test('three independent real entrances agree and all incomplete prefixes refuse settlement',()=>{
 for(const {raw,fields}of fixture.samples){
  const before=structuredClone(raw),mapping=roundMapping(raw,fixture.base,fixture.extensions);
  assert.equal(mapping.bonus,5);assert.equal(mapping.typeMappingHash,fixture.extensions.fifteen);
  assert.deepEqual(prepareNextgenRound(raw,mapping),fields);assert.equal(nextRequest(raw),null);
  for(let i=1;i<raw.steps.length;i++){
   const prefix={...raw,steps:raw.steps.slice(0,i)};
   assert.deepEqual(nextRequest(prefix),{MSGID:'FREE_GAME'});
   assert.throws(()=>roundMapping(prefix,fixture.base,fixture.extensions));
   assert.throws(()=>prepareNextgenRound(prefix,mapping));
  }
  assert.deepEqual(raw,before);
  assert.throws(()=>roundMapping(raw,fixture.base,{...fixture.extensions,fifteen:undefined}));
  assert.throws(()=>prepareNextgenRound(raw,{...mapping,bonus:3}));
 }
});
test('counter wallet session XML and unknown feature mutations rejected independently',()=>{
 for(const [index,raw]of fixture.negative.entries()){
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions),`Runner mutation ${index}`);
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:5,typeMappingHash:fixture.extensions.fifteen}),`collector mutation ${index}`);
 }
});
test('fresh capture persists every intent and fifteen response before a single final checkpoint',async()=>{
 const {raw,fields}=fixture.samples[0];let index=0,intent=false;const messages=[],evidence={completedThisRun:0};
 await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
  payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
  post:async(_payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
  rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){
   const complete=index===raw.steps.length;if(complete)assert.deepEqual(r.normalized,fields);
   return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};
  }return {checkpoint:1};},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,
  mappingHash:fixture.base,extensionHash:fixture.extensions,evidence,state:{balance:100000},
  shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 assert.deepEqual(messages,['BET',...Array(raw.steps.length-1).fill('FREE_GAME')]);
 assert.equal(evidence.completedThisRun,1);
});
