import test from 'node:test';import assert from 'node:assert/strict';
import {checkRhinoContinuousRevision,rhinoContinuousMinutes} from './rhino-continuous-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,activation:'a'.repeat(64),completePreserved:8320,sessionLayout:{lanesPerHost:2}};
const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'continuous-count-v1',gameId:32799,profileHash:hash(profile),activation:profile.activation,captureMinutes:220,newBetAllowance:0,resourceObservation:'sg-resource-observation-v1',completePreserved:30000,remainingComplete:270000,
 secondaryPeer:{schema:'sg-count-peer-v1',group:'secondary',repository:'287113535qq-cmyk/sg-capture-runner',gameId:32721,trialId:'sg_r1_20260928_32721',run:'123:1',commit:'b'.repeat(40),activation:'c'.repeat(64),profileHash:'d'.repeat(64),lanesPerHost:1}};
const commit='e'.repeat(40),receipt={schema:'sg-count-runtime-v2',commit,profileHash:hash(profile),activation:profile.activation,revisionHash:hash(revision),newBetAllowance:0,sourceRequests:0};
test('continuous count reuses two independent sessions and remaining quota only after refresh',()=>assert.equal(rhinoContinuousMinutes(profile,revision,receipt,commit),220));
test('wrong target duration increased concurrency missing peer and unbound refresh refuse',()=>{
 for(const patch of [{captureMinutes:240},{newBetAllowance:1},{completePreserved:8320-1},{remainingComplete:300000},{purpose:'observation'},{secondaryPeer:{}}])assert.throws(()=>checkRhinoContinuousRevision(profile,{...revision,...patch}));
 assert.throws(()=>checkRhinoContinuousRevision({...profile,sessionLayout:{lanesPerHost:4}},revision));
 for(const patch of [{revisionHash:'f'.repeat(64)},{commit:'f'.repeat(40)},{sourceRequests:1}])assert.throws(()=>rhinoContinuousMinutes(profile,revision,{...receipt,...patch},commit));
});
test('continuous entry reaches only refresh and admit for the applied two-session profile',()=>{
 for(const mode of ['refresh','admit'])assert(countControlPolicy(mode,profile,'count-runtime-rhino-continuous-20261001.json').continuousCount);
 for(const mode of ['activate','repair','amend','sessions'])assert.throws(()=>countControlPolicy(mode,profile,'count-runtime-rhino-continuous-20261001.json'));
 assert.throws(()=>countControlPolicy('refresh',{...profile,sessionLayout:{lanesPerHost:4}},'count-runtime-rhino-continuous-20261001.json'));
});
