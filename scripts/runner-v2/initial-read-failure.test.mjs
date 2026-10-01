import test from 'node:test';import assert from 'node:assert/strict';
import {checkInitialReadFailure} from './initial-read-failure.mjs';
import {checkFourReadRecovery,fourReadRecoveryMinutes,fourReadRecoveryName} from './four-read-recovery-runtime.mjs';
import {countControlPolicy} from './count-control-policy.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const ended={id:36908875451,run_attempt:1,status:'completed',conclusion:'failure',head_sha:'f1cf4b3c82216daf35c03957e88ac96d55e1a549',repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},{name:'verify',status:'completed',conclusion:'success'},...Array.from({length:20},(_,h)=>({name:'capture-'+h,status:'completed',conclusion:[0,7,11].includes(h)?'failure':'success'}))]};jobs.total_count=jobs.jobs.length;
 let first=true;const rows=Array.from({length:80},(_,i)=>{
  const slot=i%20+40*Math.floor(i/20),failed=[47,51,120].includes(slot),counts=!failed&&first; if(counts)first=false;
  return {slot,gameId:32799,sourceRequests:failed?0:counts?33922:1,sourceErrors:0,complete:counts?16056:0,
   outcome:failed?'stopped':'success',error:failed?'GATEWAY_DISCONNECTED':null,businessOutcome:failed?'requires-review':'incomplete',
   firstReadyAtMs:failed?null:1,operationRequests:failed?{read:1}:{read:2,cas:1}};
 });
 const evidence={schema:'sg-initial-read-failure-v1',sourceRun:'36908875451:1',commit:ended.head_sha,logSha256:'37d62b912661757e34c61211768e9367e76d5bccf952012c7c5be1183f937bd9',rows};
 return {ended,jobs,evidence};
}
test('only the authenticated three initial pure-read failures qualify',()=>assert.equal(checkInitialReadFailure(fixture()).childComplete,16056));
test('missing, duplicate, mutation, source, ready, or unknown failures reject',()=>{
 for(const change of [f=>f.evidence.rows.pop(),f=>f.evidence.rows[1].slot=f.evidence.rows[0].slot,
  f=>f.evidence.rows.find(r=>r.slot===47).operationRequests.cas=1,
  f=>f.evidence.rows.find(r=>r.slot===47).sourceRequests=1,
  f=>f.evidence.rows.find(r=>r.slot===47).firstReadyAtMs=1,
  f=>f.evidence.rows.find(r=>r.slot===47).error='GATEWAY_ACK_UNKNOWN',
  f=>f.ended.head_sha='a'.repeat(40),f=>f.jobs.jobs[2].conclusion='success',
  f=>f.evidence.rows[0].sourceErrors=1,f=>f.evidence.logSha256='a'.repeat(64)]){
  const f=fixture();change(f);assert.throws(()=>checkInitialReadFailure(f));
 }
});
test('recovery remains twenty minutes, four lanes, existing target, and bound receipt',()=>{
 const f=fixture(),profile={schema:'sg-session-layout-rhino-v1',gameId:32799,sessionLayout:{lanesPerHost:4},activation:'a'.repeat(64)};
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'bounded-four-read-recovery-v1',gameId:32799,profileHash:hash(profile),activation:profile.activation,sourceRun:f.evidence.sourceRun,fromCommit:f.ended.head_sha,captureMinutes:20,newBetAllowance:0,completePreserved:247434,remainingComplete:52566,resourceObservation:'sg-resource-observation-v1',hostResourceObservation:'sg-host-resource-observation-v1',controlReadMode:'compact-worker-v1',initialReadFailureHash:hash(checkInitialReadFailure(f))};
 const receipt={schema:'sg-count-runtime-v2',commit:'b'.repeat(40),profileHash:hash(profile),activation:profile.activation,revisionHash:hash(revision),initialReadFailureHash:revision.initialReadFailureHash,newBetAllowance:0,sourceRequests:0};
 assert.equal(fourReadRecoveryMinutes(profile,revision,receipt,receipt.commit),20);
 for(const patch of [{captureMinutes:220},{newBetAllowance:1},{remainingComplete:52567},{initialReadFailureHash:null}])assert.throws(()=>checkFourReadRecovery(profile,{...revision,...patch}));
 assert.throws(()=>fourReadRecoveryMinutes(profile,revision,{...receipt,initialReadFailureHash:'b'.repeat(64)},receipt.commit));
 for(const mode of ['refresh','admit'])assert(countControlPolicy(mode,profile,fourReadRecoveryName).fourReadRecovery);
 assert.throws(()=>countControlPolicy('refresh',{...profile,sessionLayout:{lanesPerHost:2}},fourReadRecoveryName));
});
