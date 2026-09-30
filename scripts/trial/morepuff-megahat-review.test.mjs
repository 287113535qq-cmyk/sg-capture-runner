import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {inspectMegaHat} from './morepuff-megahat-review.mjs';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
import {captureBatch} from './capture-batch.mjs';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const r=spawnSync(process.env.PYTHON??'python',['service/tests/test_morepuff_megahat_review.py','--json'],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const data=JSON.parse(r.stdout);
test('independent candidate agrees on incomplete prefixes and a synthetic terminal',()=>{
 for(const p of data.positive)assert.deepEqual(inspectMegaHat(p.raw),p.result);
});
test('further features, inconsistent counters, money and session changes stay rejected',()=>{
 for(const raw of data.negative){assert.throws(()=>inspectMegaHat(raw));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:data.mappingHash}));}
});
test('three independent implementations agree and mapping cannot borrow the cash hash',()=>{
 const raw=data.positive[2].raw,hashes={megahat:data.mappingHash,cash:'a'.repeat(64)};
 assert.deepEqual(prepareNextgenRound(raw,roundMapping(raw,'b'.repeat(64),hashes)),data.normalized);
 assert.equal(nextRequest(raw),null);assert.deepEqual(nextRequest(data.positive[1].raw),{MSGID:'FREE_GAME'});
 assert.throws(()=>roundMapping(raw,'b'.repeat(64),hashes.cash),/MAPPING/);
 assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:hashes.cash}),/MAPPING/);
});
test('capture entry persists BET plus two FREE intents before synthetic settlement',async()=>{
 const raw=data.positive[2].raw;let index=0,intent=false;const sent=[],evidence={completedThisRun:0};
 await captureBatch({plan:{sourceKey:raw.sourceKey,target:100,maxSteps:100},lease:{durable:0,sequenceTarget:1,pendingRound:null},owned:{},
  payload:msg=>{assert.equal(msg,raw.steps[index].msgId);return raw.steps[index].requestPayload;},
  post:async(_p,msg)=>{assert(intent);intent=false;sent.push(msg);return structuredClone(raw.steps[index++]);},
  rpc:async(op,r)=>{if(op==='begin'||op==='intent')intent=true;if(op==='exchange_journal'){const complete=index===3;if(complete)assert.deepEqual(r.normalized,data.normalized);return {complete,followingIntentDurable:false,checkpoint:complete?1:0,endBalanceRaw:data.normalized.money.endBalanceRaw};}return {checkpoint:1};},
  bootstrap:async()=>{throw Error('UNEXPECTED_INIT');},prepareRound:prepareNextgenRound,mappingHash:'b'.repeat(64),extensionHash:{megahat:data.mappingHash,cash:'a'.repeat(64)},
  evidence,state:{balance:raw.startBalanceRaw},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 assert.deepEqual(sent,['BET','FREE_GAME','FREE_GAME']);assert.equal(evidence.completedThisRun,1);
});
