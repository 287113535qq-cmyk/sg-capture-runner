import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';import {captureBatch} from './capture-batch.mjs';import {isAdapterGap} from '../runner-v2/game-failure-policy.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_piggies_fields import sample,PLAN;from piggies_fields import PiggiesFields,SOURCE;from round_fields import type_profile;print(json.dumps({'mapping':type_profile(SOURCE)[1],'cases':[{'raw':v,'fields':PiggiesFields(PLAN).settled(v)} for v in [sample(),sample(False)]]}))"],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const f=JSON.parse(r.stdout);
test('Python, Runner and collector agree on retrigger and ordinary settlement',()=>{
 for(const {raw,fields} of f.cases){assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,f.mapping)),fields);assert.equal(nextRequest(raw),null);for(let i=1;i<raw.steps.length;i++){const p={...raw,steps:raw.steps.slice(0,i)};assert.deepEqual(nextRequest(p),{MSGID:'FREE_GAME'});assert.throws(()=>roundMapping(p,f.mapping));}}
});
test('feature gaps isolate but money and inconsistent counters remain shared failures',()=>{
 assert(isAdapterGap('PIGGIES_FEATURE_NOT_ADAPTED'));assert(!isAdapterGap('PIGGIES_COUNTER_MISMATCH'));assert(!isAdapterGap('TRIAL_ACTUAL_COST_MISMATCH'));
 for(const [before,after] of [['FID=0|','FID=1|'],['FRBAL=0','FRBAL=1'],['NFG=0','NFG=0&GCT=1'],['VA~0','UNKNOWN~0'],['TFG=4','TFG=5'],['CFGG=4','CFGG=3'],['TW=0','TW=1']]){
  const raw=structuredClone(f.cases[0].raw);raw.steps.at(-1).responsePayload=raw.steps.at(-1).responsePayload.replace(before,after);assert.throws(()=>roundMapping(raw,f.mapping));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:1,typeMappingHash:f.mapping}));
 }
});
test('real capture entrance persists intent then completes retrigger using one BET',async()=>{
 const {raw,fields}=f.cases[0];let index=0,intent=false;const messages=[],evidence={completedThisRun:0};
 await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},payload:msg=>{assert.equal(raw.steps[index].msgId,msg);return raw.steps[index].requestPayload;},post:async(_p,msg)=>{assert(intent);intent=false;messages.push(msg);return structuredClone(raw.steps[index++]);},rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){const complete=index===raw.steps.length;if(complete)assert.deepEqual(r.normalized,fields);return{complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:fields.money.endBalanceRaw};}return{checkpoint:1};},bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,mappingHash:f.mapping,evidence,state:{balance:100000},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 assert.deepEqual(messages,['BET','FREE_GAME','FREE_GAME','FREE_GAME','FREE_GAME']);assert.equal(evidence.completedThisRun,1);
});
