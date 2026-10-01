import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';
import {rhinoFixture,rhinoGuaranteeFixture} from './rhino-fixture.mjs';
import {rhinoReview,rhinoNext,rhinoMapping,RHINO_SOURCE} from './rhino-protocol.mjs';
import {rhinoInit,rhinoPayload,rhinoSession} from './rhino-session.mjs';
import {protocolHash} from '../runner-v2/protocol-resume.mjs';
const require=createRequire(import.meta.url);require('../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json'});
const {rhinoFields}=require('../../collector/sg.rhino.ts');
const extensionHash=protocolHash(JSON.parse(fs.readFileSync('service/round_types.json')).profiles['ragingrhino-wms-v1-terminal-guarantee-v1']);
const mappingHash=protocolHash(JSON.parse(fs.readFileSync('service/round_types.json')).profiles[RHINO_SOURCE]);
const init='<GameResponse type="Init"><Header gameID="20124" versionID="1_0" isRecovering="N" sessionID="synthetic-0"/><BetMultipliers defaultIndex="0">1|2|3</BetMultipliers><CreditBets>40</CreditBets><Balances><Balance name="CASH_BALANCE" value="100000"/></Balances></GameResponse>';
test('Rhino ordinary and variable free awards require separate EndGame acknowledgement',()=>{
 for(const raw of [rhinoFixture(0),rhinoFixture(8,{4:5}),rhinoFixture(15,{4:10}),rhinoFixture(8,{4:5,10:8})]){
  const s=rhinoReview(raw);assert.equal(s.next,null);
  const fields=rhinoFields(raw,rhinoMapping(raw,mappingHash,extensionHash));assert.equal(fields.bet,0.4);assert.equal(fields.bonus,Number(raw.steps.length>2));
  for(let n=0;n<raw.steps.length;n++){
   const prefix={...raw,steps:raw.steps.slice(0,n)};
   assert.deepEqual(rhinoNext(prefix),{MSGID:n===raw.steps.length-1?'EndGame':'Logic'});
   assert.throws(()=>rhinoMapping(prefix,mappingHash),/INCOMPLETE/);
  }
 }
});
test('Rhino rejects corrupt counts, identity, money, and unreviewed features',()=>{
 for(const [find,replace] of [['remainingFreeSpins="14"','remainingFreeSpins="13"'],['isMaxWin="N"','isMaxWin="Y"'],['stake="40"','stake="200"'],['lastFreeSpin="N"','lastFreeSpin="Y"'],['name="FreeSpins"','name="BonusGuarantee"']]){
  const raw=rhinoFixture(15);const s=raw.steps[1];assert(s.responseXml.includes(find));s.responseXml=s.responsePayload=s.responsePayload.replace(find,replace);
  assert.throws(()=>rhinoReview(raw));assert.throws(()=>rhinoFields(raw,{buy:0,bonus:1,typeMappingHash:mappingHash}));
 }
 const raw=rhinoFixture(8);raw.steps[1].requestPayload=rhinoPayload('Logic','different-session');assert.throws(()=>rhinoReview(raw),/SESSION/);
 const flag=rhinoFixture(8,{4:5});flag.steps[4].responseXml=flag.steps[4].responsePayload=flag.steps[4].responsePayload.replace('bonusAwarded="Y"','bonusAwarded="N"');assert.throws(()=>rhinoReview(flag),/FREE_FLAG/);assert.throws(()=>rhinoFields(flag,{buy:0,bonus:1,typeMappingHash:mappingHash}));
 assert.throws(()=>rhinoReview(rhinoFixture(1025)),/STEP_LIMIT/);
});
test('Rhino fresh Init verifies own bet encoding and refuses recovery',()=>{
 assert.equal(rhinoInit(init).balance,100000);
 for(const [a,b]of [['<CreditBets>40','<CreditBets>200'],['defaultIndex="0"','defaultIndex="9"'],['isRecovering="N"','isRecovering="Y"'],['</GameResponse>','<BaseGameRecoveryInfo/></GameResponse>']])assert.throws(()=>rhinoInit(init.replace(a,b)));
 assert(!rhinoPayload('Init','synthetic').includes('WagerInfo'));
 assert(rhinoPayload('Logic','synthetic').includes('<WagerInfo betMultiplier="1"/>'));
 assert(!rhinoPayload('EndGame','synthetic').includes('WagerInfo'));
});
test('Rhino session scope cannot reuse another game or applied pilot identity',()=>{
 const plan={gameId:32799,runtimeGameId:33159,sourceKey:RHINO_SOURCE,adapter:'rhino-wms-v1',trialId:'sg_r1_20261001_32799',mode:'demo',buy:0,betRaw:40,demoGeneration:'a'.repeat(64)};
 const base={mode:'demo',sessionId:'Free:synthetic',operatorId:'synthetic'};
 assert.notEqual(rhinoSession(base,plan,0),rhinoSession(base,plan,1));assert.throws(()=>rhinoSession(base,{...plan,gameId:32795},0));
 assert.throws(()=>rhinoSession(base,{...plan,countAllocation:'b'.repeat(64)},0,'1:1:00000000-0000-0000-0000-000000000001'));
});

test('Rhino terminal guarantee is counted once and does not replace EndGame',()=>{
 const raw=rhinoGuaranteeFixture(),prefix={...raw,steps:raw.steps.slice(0,-1)};
 assert.equal(rhinoReview(prefix).next,'EndGame');assert.throws(()=>rhinoMapping(prefix,mappingHash),/INCOMPLETE/);
 assert.throws(()=>rhinoMapping(raw,mappingHash),/GUARANTEE_MAPPING/);
 const out=rhinoFields(raw,rhinoMapping(raw,mappingHash,extensionHash));assert.equal(out.money.totalWinRaw,205);assert.equal(out.money.endBalanceRaw,100165);assert.equal(out.bonus,1);
 for(const [a,b] of [['data bonusAwarded="205"','data bonusAwarded="204"'],['data bonusAwarded="205"','data bonusAwarded="0"'],['data bonusAwarded="205"','data bonusAwarded="-1"'],['data bonusAwarded="205"','data bonusAwarded="205" unknown="1"'],['name="BonusGuarantee"','name="Other"'],['bonusAwarded="Y"','bonusAwarded="N"'],['totalSpinWin="0"','totalSpinWin="205"'],['remainingFreeSpins="0"','remainingFreeSpins="1"'],['lastFreeSpin="Y"','lastFreeSpin="N"']]){
  const bad=structuredClone(raw),step=bad.steps.at(-2);assert(step.responseXml.includes(a));step.responsePayload=step.responseXml=step.responseXml.replace(a,b);
  assert.throws(()=>rhinoReview(bad),a);assert.throws(()=>rhinoFields(bad,{buy:0,bonus:1,typeMappingHash:mappingHash}),a);
 }
});
