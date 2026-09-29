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
const p=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_beaver_fields import sample,raw,frame,PLAN;from beaver_fields import BeaverSequence,SOURCE,EXTENSION;from round_fields import type_profile;values=[sample(),sample(True),raw([frame('BET')]),raw([frame('BET',1),frame('FREE_GAME',0,GSD='CFG~0')])];print(json.dumps({'base':type_profile(SOURCE)[1],'extension':type_profile(EXTENSION)[1],'cases':[{'raw':r,'fields':BeaverSequence(PLAN).settled(r)} for r in values]}))"],{encoding:'utf8'});
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
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
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
