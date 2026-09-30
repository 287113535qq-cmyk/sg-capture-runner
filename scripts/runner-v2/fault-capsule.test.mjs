import test from 'node:test';import assert from 'node:assert/strict';import {faultCapsule} from './fault-capsule.mjs';
const plan={gameId:32721,sourceKey:'reviewed-profile'};
const raw=(n=10)=>({protocol:'nextgen',steps:[{msgId:'BET',requestPayload:'PID=PRIVATE',responsePayload:`FID=1|&NFG=${n}&TFG=10&CFGG=0&IFG=0&GSD=BGCL~PRIVATE#CL~PRIVATE#PRIVATE_KEY~PRIVATE&B=PRIVATE`} ]});
test('fault capsule groups same gap without including response values or session identity',()=>{
 const a=faultCapsule({plan,raw:raw(),code:'PYRAMIDS_FREE_UNREVIEWED_GSD'}),b=faultCapsule({plan,raw:raw(9),code:a.code});
 assert.equal(a.fingerprint,b.fingerprint);assert.notEqual(a.rawHash,b.rawHash);
 assert.deepEqual(a.trail[0].gsdFields,['BGCL','CL']);assert.equal(a.trail[0].unknownGsdCount,1);
 assert(!JSON.stringify(a).includes('PRIVATE'));assert.equal(a.captureAuthorization,false);
 assert.notEqual(a.fingerprint,faultCapsule({plan:{...plan,gameId:32718},raw:raw(),code:a.code}).fingerprint);
});
test('trail is bounded, malformed shapes are diagnostic only, unsafe error strings are removed',()=>{
 const r=raw();r.steps=Array.from({length:1026},()=>r.steps[0]);
 const a=faultCapsule({plan,raw:r,code:'private https://secret'});assert.equal(a.trail.length,8);assert.equal(a.stepCount,1026);
 assert.equal(a.code,'UNCLASSIFIED_FAILURE');assert(!JSON.stringify(a).includes('secret'));
 assert.equal(faultCapsule({plan,raw:{steps:[{msgId:'PRIVATE',responsePayload:null}]},code:'X'}).trail[0].message,'other');
});
