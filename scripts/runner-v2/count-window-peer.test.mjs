import test from 'node:test';import assert from 'node:assert/strict';
import {checkWindowPeerProfile} from './count-window-peer.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
const profile={gameId:32799,activation:'a'.repeat(64)},ended={id:123,run_attempt:1,head_sha:'b'.repeat(40),repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml',status:'completed',conclusion:'success'};
const peer={schema:'sg-count-peer-v1',group:'secondary',repository:'287113535qq-cmyk/sg-capture-runner',gameId:32721,trialId:'sg_r1_20260928_32721',run:'456:1',commit:'c'.repeat(40),activation:'d'.repeat(64),profileHash:'e'.repeat(64),lanesPerHost:1};
const witness={schema:'sg-count-window-peer-v1',profileHash:hash(profile),activation:profile.activation,sourceRun:'123:1',sourceCommit:ended.head_sha,sourceRequests:0,databaseWrites:0,createdAt:100,expiresAt:1000,secondaryPeer:peer};
test('read-only review binds the ended source and independent reciprocal peer',()=>assert.deepEqual(checkWindowPeerProfile(witness,profile,ended,500),peer));
test('no source quota, expiry, arbitrary peer, failed source or changed permission accepted',()=>{
 for(const patch of [{profileHash:'f'.repeat(64)},{activation:'f'.repeat(64)},{sourceRun:'124:1'},{sourceCommit:'f'.repeat(40)},{sourceRequests:1},{databaseWrites:1},{expiresAt:499},{createdAt:501},{expiresAt:7200101},{secondaryPeer:{...peer,group:'primary'}},{secondaryPeer:{...peer,gameId:32799}}])assert.throws(()=>checkWindowPeerProfile({...witness,...patch},profile,ended,500));
 assert.throws(()=>checkWindowPeerProfile(witness,profile,{...ended,conclusion:'failure'},500));
});
