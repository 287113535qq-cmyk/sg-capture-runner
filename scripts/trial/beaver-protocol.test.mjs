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
const p=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_beaver_fields import sample,cfg1_sample,raw,frame,PLAN;from beaver_fields import BeaverSequence,SOURCE,EXTENSION,CFG1_EXTENSION;from round_fields import type_profile;values=[sample(),sample(True),raw([frame('BET')]),raw([frame('BET',1),frame('FREE_GAME',0,GSD='CFG~0')]),cfg1_sample(),cfg1_sample(True)];print(json.dumps({'base':type_profile(SOURCE)[1],'extension':{'free':type_profile(EXTENSION)[1],'cfg1':type_profile(CFG1_EXTENSION)[1]},'cases':[{'raw':r,'fields':BeaverSequence(PLAN).settled(r)} for r in values]}))"],{encoding:'utf8'});
assert.equal(p.status,0,p.stderr);
const fixture=JSON.parse(p.stdout);
test('actual Runner dispatcher and collector match Python complete fields',()=>{
  for(const c of fixture.cases){
    const mapping=roundMapping(c.raw,fixture.base,fixture.extension);
    assert.deepEqual(prepareNextgenRound(c.raw,mapping),c.fields);
    assert.equal(nextRequest(c.raw),null);
    if(c.raw.steps.length>1)assert.deepEqual(nextRequest({...c.raw,steps:c.raw.steps.slice(0,1)}),{MSGID:'FREE_GAME'});
    assert.throws(()=>prepareNextgenRound(c.raw,{...mapping,bonus:99}),/MAPPING_MISMATCH/);
  }
});
test('entrypoints reject mixed features, duplicate request and missing counts',()=>{
  for(const kind of ['mixed','duplicate','missing']){
    const raw=structuredClone(fixture.cases[0].raw);
    if(kind==='mixed')raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace('FID=1|','FID=1|0|');
    if(kind==='duplicate')raw.steps[1].requestPayload+='&LB=20';
    if(kind==='missing')raw.steps.at(-1).responsePayload=raw.steps.at(-1).responsePayload.replace(/&NFG=0/,'');
    assert.throws(()=>nextRequest(raw));
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension.free}));
  }
});
test('live capture-loop code resumes the saved BET and persists free responses before completion',async()=>{
  const {raw,fields}=fixture.cases[0],events=[],original=structuredClone(raw.steps[0]);
  const pending={sequence:120,attempt:'original-offline-attempt',awaiting:null,
    raw:{...structuredClone(raw),steps:[original]}};
  let index=1;const evidence={completedThisRun:0};
  await captureBatch({plan:{sourceKey:raw.sourceKey,target:299900,maxSteps:100},
    lease:{durable:119,sequenceTarget:120,pendingRound:pending},owned:{},
    payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
    post:async(payload,msg)=>{assert.equal(events.at(-1),'intent');assert.equal(msg,'FREE_GAME');
      events.push('source:'+msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{events.push(op);assert.notEqual(op,'begin');
      if(op==='exchange_journal'){
        const complete=index===raw.steps.length;
        if(complete)assert.deepEqual(r.normalized,fields);
        return {complete,followingIntentDurable:false,checkpoint:complete?120:119,endBalanceRaw:fields.money.endBalanceRaw};
      }
      return {checkpoint:120};},
    bootstrap:async()=>{throw Error('MUST_NOT_REINIT');},prepareRound:prepareNextgenRound,
    mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{},
    shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  assert.equal(evidence.completedThisRun,1);assert.equal(pending.attempt,'original-offline-attempt');
  assert.deepEqual(pending.raw.steps[0],original);
  assert.deepEqual(events,['intent','source:FREE_GAME','exchange_journal','intent','source:FREE_GAME','exchange_journal','release']);
});

// A fresh synthetic capture exercises the same continuation path that rejected CFG1.
test('fresh BET and all CFG1 FREE frames use durable intents, versioned mapping and one completed round',async()=>{
 const {raw,fields}=fixture.cases[4];let index=0,intent=false;const evidence={completedThisRun:0},messages=[];
 await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
 payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
 post:async(payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
 rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){const complete=index===raw.steps.length;if(complete)assert.deepEqual(r.normalized,fields);return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};}return {checkpoint:1};},
 bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{balance:100000},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 assert.deepEqual(messages,['BET',...Array(6).fill('FREE_GAME')]);assert.equal(evidence.completedThisRun,1);
 assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension.free),/BEAVER_MAPPING_REQUIRED/);
});

test('CFG1 counter and feature mutations fail both independent JS entrypoints',()=>{
 for(const [from,to] of [['CFG~1','CFG~0'],['CFG~1','CFG~2'],['NFG=5','NFG=0'],['CFGG=1','CFGG=0'],['FID=1|','FID=10|'],['FID=1|','FID=1|0|']]){
  const raw=structuredClone(fixture.cases[4].raw);raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(from,to);
  assert.throws(()=>nextRequest(raw));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension.cfg1}));
 }
});
