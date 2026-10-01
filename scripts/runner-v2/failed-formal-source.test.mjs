import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {checkFailedFormalSource} from './failed-formal-source.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
const e={run:{id:36791455132,run_attempt:1,status:'completed',conclusion:'failure',event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',head_sha:'876797180569bb1134fd7cc6c6934dc347cd0cb1',repository:{full_name:'287113535qq-cmyk/sg-capture-runner'}},jobs:{total_count:22,jobs:[...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'failure'})),...['pyramids-formal-admit','verify'].map(name=>({name,status:'completed',conclusion:'success'}))]}};
const p={schema:'sg-formal-stopped-retire-pyramids-v2',group:'secondary',gameId:32721,trialId:'sg_r1_20260928_32721',sourceRun:'36791455132:1',sourceCommit:'876797180569bb1134fd7cc6c6934dc347cd0cb1',sourceFailure:{schema:'sg-ended-protocol-failure-v1',reason:'PROTOCOL_VALIDATION_FAILED',jobsHash:hash(e.jobs)}};
test('only exact ended failed source and all jobs are accepted',()=>{assert.doesNotThrow(()=>checkFailedFormalSource({ended:e.run,jobs:e.jobs,profile:p}));});
test('wrong identities, incomplete jobs and arbitrary source failures are rejected',()=>{
 for(const change of [{id:e.run.id+1},{run_attempt:2},{status:'in_progress'},{conclusion:'success'},{event:'schedule'},{head_sha:'a'.repeat(40)}])assert.throws(()=>checkFailedFormalSource({ended:{...e.run,...change},jobs:e.jobs,profile:p}));
 for(const change of [{gameId:32799},{group:'primary'},{schema:'sg-formal-stopped-retire-pyramids-v1'},{sourceRun:'1:1'}])assert.throws(()=>checkFailedFormalSource({ended:e.run,jobs:e.jobs,profile:{...p,...change}}));
 const mutate=[j=>j.jobs.pop(),j=>{j.jobs[0].status='in_progress'},j=>{j.jobs.find(x=>x.name==='capture-0').name='capture-1'},j=>{j.jobs.find(x=>x.name==='verify').conclusion='failure'},j=>{j.jobs.find(x=>x.name==='capture-0').conclusion='cancelled'}];
 for(const fn of mutate){const j=structuredClone(e.jobs);fn(j);assert.throws(()=>checkFailedFormalSource({ended:e.run,jobs:j,profile:{...p,sourceFailure:{...p.sourceFailure,jobsHash:hash(j)}}}));}
});


test('new display source uses its own exact ended identity without allowing arbitrary failures',()=>{
 const run={...e.run,id:36842835455,head_sha:'819b429562e3c011305b2366e8ceac7354999dec'};
 const profile={...p,sourceRun:'36842835455:1',sourceCommit:run.head_sha};
 assert.doesNotThrow(()=>checkFailedFormalSource({ended:run,jobs:e.jobs,profile}));
 for(const change of [{id:run.id+1},{head_sha:e.run.head_sha},{status:'in_progress'}])
  assert.throws(()=>checkFailedFormalSource({ended:{...run,...change},jobs:e.jobs,profile}));
});

test('new mixed feature source requires its exact failed relay-choice evidence',()=>{
 const run={...e.run,id:36860241790,head_sha:'d2d38028883eef3a609ba3209e19785857a54e56'};
 const jobs=structuredClone(e.jobs);jobs.jobs.find(j=>j.name==='verify').conclusion='failure';
 const verifyFailure={schema:'sg-known-relay-choice-failure-v1',logSha256:'7ecc23b75814e9ca3b3d377eb147aa0ca5bd011febd6b3a19c60da07c0bec729',code:'ENOENT',runtimeChoice:'none'};
 const profile={...p,sourceRun:'36860241790:1',sourceCommit:run.head_sha,sourceFailure:{...p.sourceFailure,jobsHash:hash(jobs),verifyFailure}};
 assert.doesNotThrow(()=>checkFailedFormalSource({ended:run,jobs,profile}));
 for(const change of [{code:'OTHER'},{logSha256:'a'.repeat(64)},{runtimeChoice:'other.json'}])
  assert.throws(()=>checkFailedFormalSource({ended:run,jobs,profile:{...profile,sourceFailure:{...profile.sourceFailure,verifyFailure:{...verifyFailure,...change}}}}));
 assert.throws(()=>checkFailedFormalSource({ended:{...run,head_sha:e.run.head_sha},jobs,profile}));
});
