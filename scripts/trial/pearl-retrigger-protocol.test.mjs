
import test from 'node:test';import assert from 'node:assert/strict';
import {pearlRetriggerReview as pearlReview,pearlRetriggerNext as pearlNext} from './pearl-retrigger-protocol.mjs';
import {pearlFixture} from './pearl-fixture.mjs';import {retriggerFixture} from './pearl-retrigger-fixture.mjs';
const edit=(raw,index,from,to)=>{const s=raw.steps[index];assert(s.responsePayload.includes(from));s.responseXml=s.responsePayload=s.responsePayload.replaceAll(from,to);};
test('synthetic retrigger requires every free frame and EndGame',()=>{
 const r=retriggerFixture();assert.equal(r.steps.length,18);
 for(let n=0;n<18;n++)assert.equal(pearlNext({...r,steps:r.steps.slice(0,n)}).MSGID,n===17?'EndGame':'Logic');
 assert.equal(pearlNext(r),null);assert.equal(pearlReview(r).win,400);
});
test('old base and fixed-eight shapes remain valid',()=>{for(const free of [false,true])assert.equal(pearlNext(pearlFixture(free)),null);});
test('counter totals, extra retriggers, bonus flags, money, session and missing frames reject',()=>{
 const cases=[r=>edit(r,7,'freeSpinsTotal="16"','freeSpinsTotal="8"'),r=>edit(r,7,'freeSpinsAwarded="8"','freeSpinsAwarded="0"'),r=>edit(r,7,'freeSpinsAwarded="8"','freeSpinsAwarded="4"'),r=>edit(r,7,'freeSpinNumber="7"','freeSpinNumber="6"'),r=>edit(r,7,'bonusAwarded="Y"','bonusAwarded="N"'),r=>edit(r,8,'freeSpinsTotal="16"','freeSpinsTotal="24"'),r=>edit(r,7,'readyForEndGame="N"','readyForEndGame="Y"'),r=>edit(r,7,'isMaxWin="0"','isMaxWin="1"'),r=>{r.steps[7].responseBalance++;},r=>{r.steps[8].requestPayload=r.steps[8].requestPayload.replace('synthetic-8','foreign');},r=>{r.steps.splice(10,1);},r=>edit(r,7,'totalWin="0"','totalWin="1"')];
 for(const mutate of cases){const r=retriggerFixture();mutate(r);assert.throws(()=>pearlReview(r));}
});
