import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedCaptureWindow} from './prepared-capture-window.mjs';

test('first prepared runtime has a bounded five-minute window; quota is independent',()=>{
 const profile={schema:'sg-prepared-count-profile-v1',gameId:32714,activation:'a'.repeat(64)};
 assert.equal(preparedCaptureWindow({profile}).minutes,5);
 const commit='b'.repeat(40),revision={schema:'sg-prepared-zero-source-runtime-v1',profileHash:hash(profile),gameId:32714,activation:profile.activation};
 const receipt={schema:'sg-count-runtime-v2',commit,activation:profile.activation,profileHash:hash(profile),revisionHash:hash(revision),sourceRequests:0,newBetAllowance:0};
 assert.equal(preparedCaptureWindow({profile,revision,receipt,commit}).verification,true);
 for(const minutes of [15,240]){
  const next={...revision,captureMinutes:minutes};
  assert.equal(preparedCaptureWindow({profile,revision:next,receipt:{...receipt,revisionHash:hash(next)},commit}).minutes,minutes);
 }
 for(const change of [{commit:'c'.repeat(40)},{revisionHash:'0'.repeat(64)},{newBetAllowance:100},{sourceRequests:1}])
  assert.throws(()=>preparedCaptureWindow({profile,revision,receipt:{...receipt,...change},commit}),/BINDING/);
 const bad={...revision,captureMinutes:60};
 assert.throws(()=>preparedCaptureWindow({profile,revision:bad,receipt:{...receipt,revisionHash:hash(bad)},commit}),/DURATION/);
});
