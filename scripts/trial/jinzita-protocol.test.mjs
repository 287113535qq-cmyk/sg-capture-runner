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
const result=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_jinzita_fields import sample;from jinzita_fields import JinzitaSequence,SOURCE,EXTENSION;from test_jinzita_fields import PLAN;from round_fields import type_profile;print(json.dumps({'base':type_profile(SOURCE)[1],'extension':type_profile(EXTENSION)[1],'cases':[{'raw':r,'fields':JinzitaSequence(PLAN).settled(r)} for r in [sample(),sample(True)]]}))"],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);const fixture=JSON.parse(result.stdout);

test('Jinzita Python, Runner and independent collector agree on standalone and retriggered FID1',()=>{
  for(const {raw,fields} of fixture.cases){
    assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fixture.base,fixture.extension)),fields);
    assert.equal(nextRequest(raw),null);
    for(let n=1;n<raw.steps.length;n++){
      const partial={...raw,steps:raw.steps.slice(0,n)};
      assert.deepEqual(nextRequest(partial),{MSGID:'FREE_GAME'});
      assert.throws(()=>roundMapping(partial,fixture.base,fixture.extension),/INCOMPLETE/);
    }
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:1,typeMappingHash:fixture.extension}),/MAPPING/);
  }
});

test('Jinzita rejects feature switches, missing counters, early termination, session and cost mutations',()=>{
  for(const [i,from,to] of [[1,'FID=1|','FID=0|'],[3,'FID=1|','FID=2|'],[3,'FID=1|','FID=10|'],
    [1,'FID=1|','FID=1|0|'],[1,'NFG=2','NFG=0'],[1,'CFGG=1','CFGG=0'],
    [1,'NFG=2&',''],[1,'FID~[]','FID~[0]'],[1,'BP~false','CFG~1'],[1,'BP~false','FGRS~9'],[3,'BP~false','FGRS~1'],[1,'BP~false','CFGC~9'],[1,'IFG=1','IFG=1&GCT=1'],[3,'B=99980','B=99901']]){
    const raw=structuredClone(fixture.cases[0].raw);raw.steps[i].responsePayload=raw.steps[i].responsePayload.replace(from,to);
    assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
  }
  const raw=structuredClone(fixture.cases[0].raw);raw.steps[1].requestPayload=raw.steps[1].requestPayload.replace('offline-jinzita','new-session');
  assert.throws(()=>nextRequest(raw),/SESSION/);
});

test('fresh actual captureBatch records BET then three FREE intents and a single complete round',async()=>{
  const {raw,fields}=fixture.cases[0];let index=0,intent=false;const messages=[],evidence={completedThisRun:0};
  await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
    payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
    post:async(_payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){
      const complete=index===raw.steps.length;if(complete)assert.deepEqual(r.normalized,fields);
      return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};
    }return {checkpoint:1};},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,
    mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{balance:100000},
    shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  assert.deepEqual(messages,['BET','FREE_GAME','FREE_GAME','FREE_GAME']);assert.equal(evidence.completedThisRun,1);
});
