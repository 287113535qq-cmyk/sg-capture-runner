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
 "import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_super_hold_review import super_sample;from test_pyramids_hold_review import PLAN;from pyramids_fields import PyramidsFields,SOURCE;from pyramids_super_hold_review import EXTENSION;from round_fields import type_profile;v=super_sample();print(json.dumps({'samples':[{'raw':v,'fields':PyramidsFields(PLAN).settled(v)}],'base':type_profile(SOURCE)[1],'extensions':{'superHold':type_profile(EXTENSION)[1]}}))"],{encoding:'utf8'});
assert.equal(python.status,0,python.stderr);const fixture=JSON.parse(python.stdout);
test('three independent real entrances agree and all incomplete prefixes refuse settlement',()=>{
 for(const {raw,fields}of fixture.samples){
  const before=structuredClone(raw),mapping=roundMapping(raw,fixture.base,fixture.extensions);
  assert.equal(mapping.bonus,6);assert.equal(mapping.typeMappingHash,fixture.extensions.superHold);
  assert.deepEqual(prepareNextgenRound(raw,mapping),fields);assert.equal(nextRequest(raw),null);
  for(let i=1;i<raw.steps.length;i++){
   const prefix={...raw,steps:raw.steps.slice(0,i)};
   assert.deepEqual(nextRequest(prefix),{MSGID:'FREE_GAME'});
   assert.throws(()=>roundMapping(prefix,fixture.base,fixture.extensions));
   assert.throws(()=>prepareNextgenRound(prefix,mapping));
  }
  assert.deepEqual(raw,before);
  assert.throws(()=>roundMapping(raw,fixture.base,{...fixture.extensions,superHold:undefined}));
  assert.throws(()=>prepareNextgenRound(raw,{...mapping,bonus:3}));
 }
});
test('fresh capture persists every intent and Super Hold response before a single final checkpoint',async()=>{
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
test('unknown fields, XML, money and changed session refuse both real entrances',()=>{
 const sample=fixture.samples[0].raw,mapping={buy:0,bonus:6,typeMappingHash:fixture.extensions.superHold};
 for(const [index,values]of [[1,{FID:'0|1|'}],[1,{GCT:'1'}],[1,{NFG:'0'}],[1,{CFGG:'2'}],[1,{GSD:'SHNST~0'}],[1,{GSD:'SHNST~2'}],[1,{GSD:'SHNST~1#WHSTOP~0'}],[sample.steps.length-1,{TW:'999999'}]]){
  const raw=structuredClone(sample),s=raw.steps[index];
  const p=Object.fromEntries(s.responsePayload.split('&').map(x=>{const j=x.indexOf('=');return[x.slice(0,j),x.slice(j+1)];}));Object.assign(p,values);
  s.responsePayload=Object.entries(p).map(([k,v])=>k+'='+v).join('&');s.responseXml='<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>'+s.responsePayload.replaceAll('&','&amp;')+'</PAYLOAD></GDMRESPONSE>';
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions));assert.throws(()=>prepareNextgenRound(raw,mapping));
 }
 for(const mode of ['session','missing','duplicate-xml']){
  const raw=structuredClone(sample);
  if(mode==='session')raw.steps[1].requestPayload=raw.steps[1].requestPayload.replace('fixture-pyramids','other');
  if(mode==='missing')raw.steps.splice(2,1);
  if(mode==='duplicate-xml')raw.steps[1].responseXml=raw.steps[1].responseXml.replace('<SUCCESS>true</SUCCESS>','<SUCCESS>true</SUCCESS><SUCCESS>true</SUCCESS>');
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions));assert.throws(()=>prepareNextgenRound(raw,mapping));
 }
});
test('official return code zero agrees; duplicated, nonzero and nested outer fields are refused',()=>{
 const original=fixture.samples[0],raw=structuredClone(original.raw);
 for(const s of raw.steps)s.responseXml=s.responseXml.replace('<GDMRESPONSE>','<GDMRESPONSE><OGS_RC>0</OGS_RC>');
 assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fixture.base,fixture.extensions)),original.fields);
 for(const text of ['<OGS_RC>1</OGS_RC>','<OGS_RC>0</OGS_RC><OGS_RC>0</OGS_RC>','<X><SUCCESS>true</SUCCESS></X>']){
  const bad=structuredClone(original.raw);bad.steps[1].responseXml=bad.steps[1].responseXml.replace('<GDMRESPONSE>','<GDMRESPONSE>'+text);
  assert.throws(()=>roundMapping(bad,fixture.base,fixture.extensions));assert.throws(()=>prepareNextgenRound(bad,{buy:0,bonus:6,typeMappingHash:fixture.extensions.superHold}));
 }
});
