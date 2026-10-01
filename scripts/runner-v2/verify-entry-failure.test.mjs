import test from 'node:test';import assert from 'node:assert/strict';
import {checkVerifyEntryFailure} from './verify-entry-failure.mjs';
const ended={id:36839677352,run_attempt:1,status:'completed',conclusion:'failure',head_sha:'ca9ea3f9c5f00718ea496a44b33c2d1b857c3a96',repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml',event:'workflow_dispatch'};
const jobs={total_count:22,jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},{name:'verify',status:'completed',conclusion:'failure'},...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'success'}))]};
const evidence={schema:'sg-known-verify-entry-failure-v1',sourceRun:'36839677352:1',sourceCommit:ended.head_sha,logSha256:'f94b062a08e35975e2a78da424ac787d986171a529f5e4a5e514dcbc757074a7',distinctWorkers:40,childComplete:17028,sourceErrors:0,verifyError:'COUNT_SESSION_WINDOW_PERMISSION'};
test('only the exact reviewed verify-entry failure accepts forty healthy captures',()=>assert.equal(checkVerifyEntryFailure({ended,jobs,evidence}),evidence));
test('changed run log child count extra failed job and arbitrary failure refuse',()=>{
 for(const patch of [{id:123},{run_attempt:2},{head_sha:'a'.repeat(40)},{conclusion:'success'}])assert.throws(()=>checkVerifyEntryFailure({ended:{...ended,...patch},jobs,evidence}));
 for(const patch of [{logSha256:'a'.repeat(64)},{childComplete:17029},{sourceErrors:1},{verifyError:'OTHER_ERROR'}])assert.throws(()=>checkVerifyEntryFailure({ended,jobs,evidence:{...evidence,...patch}}));
 const bad=structuredClone(jobs);bad.jobs[2].conclusion='failure';assert.throws(()=>checkVerifyEntryFailure({ended,jobs:bad,evidence}));
});
