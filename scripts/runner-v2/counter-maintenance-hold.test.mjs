import test from 'node:test';import assert from 'node:assert/strict';
import {checkCountPeerHolds,countPeerBoundary} from './count-peer-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){const own={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'PYRAMIDS_FREE_COUNTERS',category:'source_protocol',trialId:'sg_r1_20260928_32721',cooldownUntil:0}};return {own,rows:[{_id:'primary/global-hold',value:{active:false}},{_id:'secondary/global-hold',value:own}]};}
test('no-source counter maintenance accepts only the exact original own hold',()=>{const f=fixture();checkCountPeerHolds(f.rows,'secondary',hash(f.own));assert.throws(()=>checkCountPeerHolds(f.rows,'secondary'));});
for(const kind of ['changed-code','changed-category','changed-trial','cooldown','peer-hold','missing-peer','duplicate-id','changed-hash'])test('counter maintenance keeps protection for '+kind,()=>{
 const f=fixture(),expected=hash(f.own);
 if(kind==='changed-code')f.own.details.code='MONGO_CONTENT_CONFLICT';if(kind==='changed-category')f.own.details.category='source_network';
 if(kind==='changed-trial')f.own.details.trialId='other';if(kind==='cooldown')f.own.details.cooldownUntil=1;
 if(kind==='peer-hold')f.rows[0].value.active=true;if(kind==='missing-peer')f.rows.shift();if(kind==='duplicate-id')f.rows[0]._id=f.rows[1]._id;
 assert.throws(()=>checkCountPeerHolds(f.rows,'secondary',kind==='changed-hash'?'0'.repeat(64):expected));
});
test('a source workflow cannot use the maintenance hold exception',()=>{
 assert.throws(()=>countPeerBoundary({peer:{schema:'sg-count-peer-v1',group:'primary',repository:'zyzuoyang/sg-capture-runner',gameId:32799,trialId:'sg_r1_20261001_32799',run:'1:1',commit:'a'.repeat(40),profileHash:'b'.repeat(64),activation:'c'.repeat(64),lanesPerHost:4},selfGroup:'secondary',run:'2:1',commit:'d'.repeat(40),workflowPath:'.github/workflows/trial-300k.yml',maintenanceHoldHash:'e'.repeat(64)}));
});
