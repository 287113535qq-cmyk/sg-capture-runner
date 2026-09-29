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
