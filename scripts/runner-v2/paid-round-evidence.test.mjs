import test from 'node:test';import assert from 'node:assert/strict';
import {onePaidRound} from './paid-round-evidence.mjs';import {pearlFixture} from '../trial/pearl-fixture.mjs';
const plan={gameId:32795,adapter:'pearl-wms-v1'};
test('one paid WMS round includes eight free Logic exchanges; unknown final frame may be abandoned once',()=>{
 const raw=pearlFixture();assert.equal(raw.steps.filter(s=>s.msgId==='Logic').length,9);assert(onePaidRound(plan,raw));
 for(let n=1;n<=9;n++){const p={...raw,steps:raw.steps.slice(0,n)};assert(!onePaidRound(plan,p));assert(onePaidRound(plan,p,{abandoned:true}));}
 const p=structuredClone(raw);p.steps.push(p.steps[0]);assert(!onePaidRound(plan,p,{abandoned:true}));
 const q=structuredClone(raw);q.steps[1].requestPayload=q.steps[1].requestPayload.replace('synthetic-1','foreign');assert(!onePaidRound(plan,q,{abandoned:true}));
 const changed={...raw,steps:structuredClone(raw.steps.slice(0,2))};changed.steps[1].requestPayload=changed.steps[1].requestPayload.replace('affiliate="offline"','affiliate="changed"');assert(!onePaidRound(plan,changed,{abandoned:true}));
 assert(!onePaidRound({gameId:32714},raw));
});
