import test from 'node:test';
import assert from 'node:assert/strict';
import {githubBoundary} from './github-boundary.mjs';
import {original} from './expired-run-review.mjs';
const commit='b'.repeat(40);
function fixture(mode){
  let time=original.expiresAt+600000;
  const old={id:original.id,run_attempt:1,head_sha:original.commit,repository:{full_name:original.repository},
    event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'queued',conclusion:null};
  const read=async path=>{
    if(mode==='slow')time+=4000;
    if(path.includes('/jobs?'))return mode==='jobs'?{total_count:1,jobs:[{}]}:{total_count:0,jobs:[]};
    if(path.endsWith('/'+original.id))return {...old,...(mode==='starts'?{status:'in_progress'}:{}),...(mode==='rerun'?{run_attempt:2}:{})};
    const self={id:999,run_attempt:1,head_sha:commit,path:'.github/workflows/trial-300k.yml'};
    const rows=path.includes('zyzuoyang/') && path.includes('status=queued')?[old]:[];
    if(path.includes('status=in_progress')){
      if(path.includes('zyzuoyang/'))rows.push(self);
      if(mode==='other')rows.push({id:123});
    }
    return {workflow_runs:rows,total_count:mode==='truncated'?100:rows.length};
  };
  return githubBoundary({read,run:'999:1',commit,now:()=>time});
}
test('bounded two-repository reads permit only current and reviewed expired run',async()=>{await fixture()();});
for(const mode of ['jobs','starts','rerun','slow','other','truncated'])
  test('GitHub boundary rejects '+mode,async()=>{await assert.rejects(fixture(mode)());});

function controlledReader({fail=false,lateJob=false}={}){
  let active=0,peak=0,completed=0,lists=0;
  const read=async path=>{
    if(path.includes('/actions/runs?')){
      active++;peak=Math.max(peak,active);lists++;
      try{
        await new Promise(resolve=>setTimeout(resolve,5));
        if(fail && path.includes('status=queued'))throw new Error('READ_FAILED');
        return {total_count:0,workflow_runs:[]};
      }finally{active--;completed++;}
    }
    assert.equal(active,0,'final identity/jobs check waits for status lists');
    assert.equal(completed,10);
    if(path.includes('/jobs?'))return lateJob?{total_count:1,jobs:[{}]}:{total_count:0,jobs:[]};
    return {id:original.id,run_attempt:1,head_sha:original.commit,repository:{full_name:original.repository},
      event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'queued',conclusion:null};
  };
  return {read,stats:()=>({active,peak,completed,lists})};
}
test('status reads overlap in two bounded waves and final job check remains last',async()=>{
  const f=controlledReader();
  await githubBoundary({read:f.read,run:'999:1',commit,now:()=>original.expiresAt+600000})();
  assert.deepEqual(f.stats(),{active:0,peak:5,completed:10,lists:10});
});
test('failed wave drains every started read and never starts a second wave',async()=>{
  const f=controlledReader({fail:true});
  await assert.rejects(githubBoundary({read:f.read,run:'999:1',commit,now:()=>original.expiresAt+600000})(),/READ_FAILED/);
  assert.deepEqual(f.stats(),{active:0,peak:5,completed:5,lists:5});
});
test('job appearing after concurrent status reads still blocks writes',async()=>{
  const f=controlledReader({lateJob:true});
  await assert.rejects(githubBoundary({read:f.read,run:'999:1',commit,now:()=>original.expiresAt+600000})(),/OLD_JOB_EXISTS/);
  assert.equal(f.stats().active,0);
});
test('elapsed wall time across concurrent waves remains bounded',async()=>{
  const f=controlledReader();let calls=0;
  await assert.rejects(githubBoundary({read:f.read,run:'999:1',commit,
    now:()=>original.expiresAt+600000+(calls++?30001:0)})(),/GITHUB_EVIDENCE_STALE/);
});
