import test from 'node:test';
import assert from 'node:assert/strict';
import {pearlFixture} from './pearl-fixture.mjs';
import {pearlNext,pearlReview,pearlMapping} from './pearl-protocol.mjs';

test('Pearl needs all eight free frames and a confirmed EndGame',()=>{
 for(const free of [false,true]){
  const raw=pearlFixture(free);
  for(let n=0;n<raw.steps.length;n++)assert.equal(pearlNext({...raw,steps:raw.steps.slice(0,n)}).MSGID,n===raw.steps.length-1?'EndGame':'Logic');
  assert.equal(pearlNext(raw),null);assert.equal(pearlReview(raw).win,400);
  assert.deepEqual(pearlMapping(raw,'a'.repeat(64)),{buy:0,bonus:Number(free),typeMappingHash:'a'.repeat(64)});
 }
});
test('Pearl rejects incorrect money, identity, progression and unreviewed features',()=>{
 const changes=[
  r=>{r.steps.splice(3,1);},r=>{r.steps.push(r.steps[0]);},
  r=>{r.steps[1].requestPayload=r.steps[1].requestPayload.replace('synthetic-1','foreign');},
  r=>{r.steps[1].requestPayload=r.steps[1].requestPayload.replace('total="200"','total="400"');},
  r=>{r.steps[1].responseBalance++;},r=>{r.startBalanceRaw++;},
  r=>{r.steps[1].responsePayload=r.steps[1].responseXml='<!DOCTYPE x><GameResponse/>';},
  ...[['freeSpinNumber="1"','freeSpinNumber="2"'],['freeSpinsAwarded="0"','freeSpinsAwarded="8"'],
   ['readyForEndGame="N"','readyForEndGame="Y"'],['isMaxWin="0"','isMaxWin="1"'],
   ['totalWin="0"','totalWin="1"'],['<BGInfo','<BGInfo UNKNOWN="1"'],
   ['<AccountData/>','<UnknownFeature/>']].map(([a,b])=>r=>{r.steps[1].responseXml=r.steps[1].responsePayload=r.steps[1].responsePayload.replace(a,b);})
 ];
 for(const mutate of changes){const r=pearlFixture();mutate(r);assert.throws(()=>pearlReview(r));}
});
test('historical omitted stake is available only to explicit offline review',()=>{
 const r=pearlFixture();r.steps[1].requestPayload=r.steps[1].requestPayload.replace(/<Stake[^>]*\/>/,'').replace(/<AccountData>.*?<\/AccountData>/,'');
 assert.throws(()=>pearlReview(r),/WMS_REQUEST_MISMATCH/);assert.equal(pearlReview(r,{legacy:true}).next,null);
});
