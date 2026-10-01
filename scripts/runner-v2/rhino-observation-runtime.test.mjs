import test from 'node:test';import assert from 'node:assert/strict';
import {checkRhinoObservationRevision,rhinoObservationMinutes} from './rhino-observation-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
function fixture(){const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,sessionLayout:{lanesPerHost:2},activation:'a'.repeat(64)},commit='b'.repeat(40);
 const revision={schema:'sg-count-runtime-refresh-profile-v1',gameId:32799,activation:profile.activation,profileHash:hash(profile),captureMinutes:30,newBetAllowance:0,resourceObservation:'sg-resource-observation-v1'};
 const receipt={schema:'sg-count-runtime-v2',commit,activation:profile.activation,profileHash:hash(profile),revisionHash:hash(revision),newBetAllowance:0,sourceRequests:0};return {profile,revision,receipt,commit};}
test('healthy two-lane observation changes duration with bound receipt and grants zero new allowance',()=>{
 const f=fixture();assert.equal(rhinoObservationMinutes(f.profile,f.revision,f.receipt,f.commit),30);
 for(const mode of ['refresh','admit'])assert.equal(countControlPolicy(mode,f.profile,'count-runtime-rhino-two-observation-20261001.json').observationWindow,true);
 for(const mode of ['activate','repair','sessions','amend'])assert.throws(()=>countControlPolicy(mode,f.profile,'count-runtime-rhino-two-observation-20261001.json'));
});
test('unbound duration, extra quota, lane expansion, incomplete telemetry or stale receipt refuse',()=>{
 for(const field of ['duration','quota','lanes','telemetry','receipt','commit']){const f=fixture();
  if(field==='duration')f.revision.captureMinutes=60;if(field==='quota')f.revision.newBetAllowance=1;
  if(field==='lanes')f.profile.sessionLayout.lanesPerHost=4;if(field==='telemetry')delete f.revision.resourceObservation;
  if(field==='receipt')f.receipt.revisionHash='c'.repeat(64);if(field==='commit')f.commit='d'.repeat(40);
  assert.throws(()=>rhinoObservationMinutes(f.profile,f.revision,f.receipt,f.commit),undefined,field);
 }
 assert.throws(()=>checkRhinoObservationRevision(fixture().profile,{}));
});
