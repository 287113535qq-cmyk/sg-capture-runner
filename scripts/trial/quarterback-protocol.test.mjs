import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {captureBatch} from './capture-batch.mjs';

const output=spawnSync(process.env.PYTHON || 'python',['-c',
  "import sys,json;sys.path[:0]=['service','service/tests'];from test_quarterback_fields import sample,raw,exchange,retained_terminal,PLAN;from quarterback_fields import QuarterbackFields;values=[sample(),sample(True),raw([exchange('BET')]),raw([exchange('BET',FID='0|',NFG=1),exchange('FREE_GAME',FID='0|',NFG=0,TW=50,B=100025,AB=100025)]),retained_terminal()];print(json.dumps([{'raw':r,'fields':QuarterbackFields(PLAN).settled(r)} for r in values]))"],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const cases=JSON.parse(output.stdout);
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');

test('foam first value drives one PICK; every prefix requires the next distinct message',()=>{
  const expected=[{MSGID:'BET'},{MSGID:'FEATURE_START',CFG:'2'},{MSGID:'FEATURE_PICK',CFG:'2',FP:'0|1|800'},{MSGID:'FEATURE_END',CFG:'2'},null];
  for(const {raw} of cases.slice(0,2))for(let n=0;n<=4;n++)assert.deepEqual(nextRequest({...raw,steps:raw.steps.slice(0,n)}),expected[n]);
});
test('independent TypeScript settlement matches Python including retained NFR awarded count',()=>{
  for(const {raw,fields} of cases)assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fields.typeMappingHash,fields.typeMappingHash)),fields);
  assert.equal(roundMapping(cases[2].raw,'base','feature').typeMappingHash,'base');
  assert.equal(roundMapping(cases[3].raw,'base','feature').bonus,1);
  assert.throws(()=>roundMapping(cases[0].raw,'base',undefined));
});
test('choice index, higher prize, old game FP, replayed BET, and changed session rejected',()=>{
  for(const fp of ['0|1|0','0|1|1875','1|1|800','0|2|800']){
    const raw=structuredClone(cases[0].raw);raw.steps[2].requestPayload=raw.steps[2].requestPayload.replace('0|1|800',fp);
    assert.throws(()=>nextRequest(raw));
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:'x'}));
  }
  for(const kind of ['session','bet','extra']){
    const raw=structuredClone(cases[0].raw);
    if(kind==='session')raw.steps[1].requestPayload=raw.steps[1].requestPayload.replace('gdmgcmfoam-fixture','gdmgcmother');
    if(kind==='bet')raw.steps[1]=raw.steps[0];
    if(kind==='extra')raw.steps.push(raw.steps.at(-1));
    assert.throws(()=>nextRequest(raw));
  }
});
test('missing START data and unsupported combined/free branches cannot be guessed',()=>{
  for(const kind of ['gsd','stack','free','other-counter','end']){
    const raw=structuredClone(cases[0].raw);
    if(kind==='gsd')raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(/&GSD=.*/,'');
    if(kind==='stack')raw.steps[0].responsePayload=raw.steps[0].responsePayload.replace('FID=2|','FID=2|0|');
    if(kind==='free')raw.steps[0].responsePayload+='&NFG=1';
    if(kind==='other-counter')raw.steps[3].responsePayload+='&NFR_1=1';
    if(kind==='end')raw.steps[3].responsePayload=raw.steps[3].responsePayload.replace('CFR_2=1','CFR_2=0');
    assert.throws(()=>nextRequest(raw));
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:'x'}));
  }
});
test('generic games retain their terminal counter guard; malformed money never becomes zero',()=>{
  const raw=structuredClone(cases[0].raw);raw.sourceKey='other';
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:'x'}));
  raw.sourceKey=cases[0].raw.sourceKey;raw.startBalanceRaw++;
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:'x'}));
});

test('actual capture loop resumes the original successful BET without INIT/BET and persists each following response',async()=>{
  const {raw,fields}=cases[0],events=[];
  const original=structuredClone(raw.steps[0]),pending={sequence:113,attempt:'original-attempt',awaiting:null,
    raw:{...structuredClone(raw),steps:[original]}};
  let index=1;
  const evidence={completedThisRun:0};
  await captureBatch({plan:{sourceKey:raw.sourceKey,target:299900,maxSteps:100},lease:{durable:112,sequenceTarget:113,pendingRound:pending},owned:{},
    payload:msg=>{const step=raw.steps[index];assert.equal(step.msgId,msg);return step.requestPayload;},
    post:async(requestPayload,msg)=>{assert.equal(events.at(-1),'intent');events.push('source:'+msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{
      events.push(op);
      assert.notEqual(op,'begin');
      if(op==='exchange_journal'){
        const complete=index===4;if(complete)assert.deepEqual(r.normalized,fields);
        return {complete,followingIntentDurable:false,checkpoint:complete?113:112,endBalanceRaw:fields.money.endBalanceRaw};
      }
      return {checkpoint:113};
    },bootstrap:async()=>{throw Error('MUST_NOT_REINITIALIZE_PENDING');},prepareRound:prepareNextgenRound,
    mappingHash:fields.typeMappingHash,extensionHash:fields.typeMappingHash,evidence,state:{},shouldStop:()=>false,requestStop(){},
    deadline:performance.now()+60000,limit:1});
  assert.equal(evidence.completedThisRun,1);assert.deepEqual(pending.raw.steps[0],raw.steps[0]);
  assert.deepEqual(events,['intent','source:FEATURE_START','exchange_journal','intent','source:FEATURE_PICK','exchange_journal','intent','source:FEATURE_END','exchange_journal','release']);
});


test('retained FID with absent END counter group matches independently; partial groups stay rejected',()=>{
  const {raw,fields}=cases.at(-1);
  assert.equal(nextRequest(raw),null);
  assert.equal(fields.bonus,2);
  for(const extra of ['CFG=2','FS_2=1','NFR_2=1','CFR_2=1','CFP_2=1']){
    const invalid=structuredClone(raw);invalid.steps[3].responsePayload+='&'+extra;
    assert.throws(()=>nextRequest(invalid));
    assert.throws(()=>prepareNextgenRound(invalid,{buy:0,bonus:2,typeMappingHash:'x'}));
  }
});
