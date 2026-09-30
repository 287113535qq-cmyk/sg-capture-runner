import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {captureBatch} from './capture-batch.mjs';
import {isAdapterGap} from '../runner-v2/game-failure-policy.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const result=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_morepuff_fields import sample,PLAN;from morepuff_fields import MorepuffSequence,SOURCE,EXTENSION;from round_fields import type_profile;print(json.dumps({'base':type_profile(SOURCE)[1],'extension':type_profile(EXTENSION)[1],'cases':[{'raw':r,'fields':MorepuffSequence(PLAN).settled(r)} for r in [sample(n,n*100) for n in [0,2,7,8,11]]]}))"],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);const fixture=JSON.parse(result.stdout);
test('More Puff cash stops independently agree in Python, Runner and collector',()=>{
  for(const {raw,fields} of fixture.cases){
    assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fixture.base,fixture.extension)),fields);
    assert.equal(nextRequest(raw),null);
    const partial={...raw,steps:raw.steps.slice(0,1)};
    assert.deepEqual(nextRequest(partial),{MSGID:'FREE_GAME'});
    assert.throws(()=>roundMapping(partial,fixture.base,fixture.extension),/INCOMPLETE/);
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:1,typeMappingHash:fixture.extension}),/MAPPING/);
  }
});
test('Further features isolate the game; counter, mixed, unknown and money cases never settle',()=>{
  assert.equal(isAdapterGap('MOREPUFF_FEATURE_NOT_ADAPTED'),true);
  const cases=[...['1','3','4','5','6','9','10','12'].map(n=>['WHSTOP~0',`WHSTOP~${n}`]),
    ['FID=0|','FID=0|1|'],['FID=0|','FID=2|'],['FID=0|','FID=10|'],['NFG=0&',''],['CFGG=1','CFGG=0'],
    ['FRBAL=0','FRBAL=1'],['RID=0','RID=0&GCT=1'],['WHSTOP~0','WHSTOP~0#FEAT~MANSION'],
    ['WHSTOP~0','WHSTOP~0#CFG~0'],['TW=0','TW=10'],['AB=98000','AB=99000']];
  for(const [from,to] of cases){
    const raw=structuredClone(fixture.cases[0].raw);raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(from,to);
    assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension),from);
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}),from);
  }
});
test('actual captureBatch persists one BET and one FREE intent before accepting the cash exit',async()=>{
  const {raw,fields}=fixture.cases[0];let index=0,intent=false;const messages=[],evidence={completedThisRun:0};
  await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
    payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
    post:async(_payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){
      const complete=index===2;if(complete)assert.deepEqual(r.normalized,fields);
      return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};
    }return {checkpoint:1};},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,
    mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{balance:100000},
    shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  assert.deepEqual(messages,['BET','FREE_GAME']);assert.equal(evidence.completedThisRun,1);
});

test('unreviewed WHSLICE value is persisted and rejected before any further request',async()=>{
  // Synthetic reproduction of the observed branch shape, with no private payload.
  const raw=structuredClone(fixture.cases[0].raw),last=raw.steps[1];
  last.responsePayload=last.responsePayload.replace('FID=0|','FID=1|2|')
    .replace('NFG=0','NFG=1').replace('CFGG=1','CFGG=0')
    .replace('WHSTOP~0','WHSTOP~3#WHSLICE~0');
  assert.throws(()=>nextRequest(raw),/MEGAHAT_UNREVIEWED/);
  let index=0,intent=false;const messages=[],saved=[],evidence={completedThisRun:0};
  await assert.rejects(captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},
    lease:{durable:0,sequenceTarget:5,pendingRound:null},owned:{},
    payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
    post:async(_payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{
      if(op==='begin'||op==='intent')intent=true;
      if(op==='exchange_journal'){
        saved.push(r.step);assert.equal(r.normalized,undefined);
        if(index===2){assert.equal(r.following,undefined);throw Error('MEGAHAT_UNREVIEWED');}
        assert(r.following);intent=true;return {complete:false,followingIntentDurable:true};
      }
    },bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,
    mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{balance:100000},
    shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:5}),/MEGAHAT_UNREVIEWED/);
  assert.deepEqual(messages,['BET','FREE_GAME']);assert.deepEqual(saved,raw.steps);
  assert.equal(evidence.completedThisRun,0);
});
