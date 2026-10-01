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
const result=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_free_review import sample,coin_sample,display_sample,repeated_base_coins_sample;from test_pyramids_hold_review import sample as hold_sample,super_display_sample;from pyramids_fields import PyramidsFields,SOURCE,EXTENSION;from test_pyramids_free_review import PLAN;from round_fields import type_profile;print(json.dumps({'base':type_profile(SOURCE)[1],'extension':type_profile(EXTENSION)[1],'cases':[{'raw':r,'fields':PyramidsFields(PLAN).settled(r)} for r in [sample(),hold_sample(),coin_sample(),display_sample(),repeated_base_coins_sample(),super_display_sample()]]}))"],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);const fixture=JSON.parse(result.stdout);

test('Pyramids Python, Runner and independent collector agree on isolated ten-free and Hold extensions',()=>{
  for(const {raw,fields} of fixture.cases){
    assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,fixture.base,fixture.extension)),fields);
    assert.equal(nextRequest(raw),null);
    for(let n=1;n<raw.steps.length;n++){
      const partial={...raw,steps:raw.steps.slice(0,n)};
      assert.deepEqual(nextRequest(partial),{MSGID:'FREE_GAME'});
      assert.throws(()=>roundMapping(partial,fixture.base,fixture.extension),/INCOMPLETE/);
    }
    assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:9,typeMappingHash:fixture.extension}),/MAPPING/);
  }
});

test('Pyramids collector and Runner both reject feature/counter/money changes',()=>{
 for(const[i,from,to]of[[1,'FID=1|','FID=0|'],[1,'FID=1|','FID=1|0|'],[1,'NFG=9','NFG=0'],[1,'CFGG=1','CFGG=0'],[1,'TFG=10','TFG=11'],[1,'BGRS~','UNKNOWN~'],[10,'BGRS~1;2;3;4;5;','FGRS~1'],[1,'BGRS~1;2;3;4;5;','CFGC~9'],[1,'IFG=1','IFG=1&GCT=1'],[10,'B=99980','B=99901']]){
  const raw=structuredClone(fixture.cases[0].raw);raw.steps[i].responsePayload=raw.steps[i].responsePayload.replace(from,to);
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
 }
});

test('fresh actual captureBatch records BET then ten FREE intents and a single complete round',async()=>{
  for(const {raw,fields} of fixture.cases){let index=0,intent=false;const messages=[],evidence={completedThisRun:0};
  await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
    payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},
    post:async(_payload,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},
    rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){
      const complete=index===raw.steps.length;if(complete)assert.deepEqual(r.normalized,fields);
      return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};
    }return {checkpoint:1};},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,
    mappingHash:fixture.base,extensionHash:fixture.extension,evidence,state:{balance:100000},
    shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  assert.deepEqual(messages,['BET',...Array(raw.steps.length-1).fill('FREE_GAME')]);assert.equal(evidence.completedThisRun,1);}
});


test('coin display rejects unreviewed coordinates, jackpot values, duplicates and unbound free-frame BGCL in both validators',()=>{
 for(const bad of ['', '3;0;20;|','0;5;20;|','0;0;-1;|','0;0;-0;|','0;0;9007199254740992;|','0;0;20;|0;0;30;|','0;0;|','0;0;20;99;|','0;0;1e2;|','0;0;２０;|']){
  const raw=structuredClone(fixture.cases[0].raw);raw.steps[0].responsePayload=raw.steps[0].responsePayload.replace('GSD=BGRS~1;2;3;4;5;','GSD=CL~'+bad);
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
 }
 const raw=structuredClone(fixture.cases[0].raw);raw.steps[1].responsePayload+='\x23BGCL~0;0;20;|';
 assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));
 assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
});

test('free-frame display aliases and stops remain strictly bounded independently',()=>{
 for(const gsd of ['CLBN~0;0;20;|','CL~0;0;20;|#CLBN~0;0;40;|','FSRS~1;2;3;4;',
  'FSRS~1;2;3;4;-1;','FSRS~1;2;3;4;9007199254740992;','FSRS~1;2;3;4;５;',
  'IIFS~2','BGCL~0;0;20;|','CL~0;0;-1;|','CL~0;0;20;|0;0;40;|','UNKNOWN~1']){
  const raw=structuredClone(fixture.cases[0].raw);raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace('GSD=BGRS~1;2;3;4;5;','GSD='+gsd);
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:2,typeMappingHash:fixture.extension}));
 }
});


test('super hold display boolean stays on reviewed trigger and preserves explicit terminal checks',()=>{
 for(const [index,flag] of [[0,'2'],[0,'true'],[0,'-1'],[1,'1'],[1,'0']]){
  const raw=structuredClone(fixture.cases[1].raw);
  const step=raw.steps[index];step.responsePayload+='#SHNST~'+flag;
  assert.throws(()=>roundMapping(raw,fixture.base,fixture.extension));
  assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:1,typeMappingHash:fixture.extension}));
 }
});
