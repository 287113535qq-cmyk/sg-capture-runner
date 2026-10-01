import test from 'node:test';import assert from 'node:assert/strict';
import {checkParentTailFailure} from './parent-tail-failure.mjs';
function fixture(){const ended={id:36835017232,run_attempt:1,status:'completed',conclusion:'failure',head_sha:'47f2a64680d021e244f8fe8f4500edd9c6742458',repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml',event:'workflow_dispatch'};
 const jobs={total_count:22,jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},{name:'verify',status:'completed',conclusion:'success'},...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'failure'}))]};
 const evidence={schema:'sg-known-parent-tail-failure-v1',sourceRun:ended.id+':1',sourceCommit:ended.head_sha,logSha256:'228dbb93491cd97660dd8de5dffb00953bb541ad0093e1ad25c8b61dbe4e4663',distinctWorkers:40,childComplete:10374,sourceErrors:0,parentError:'CONCURRENT_PARENT_GATEWAY_READ'};return {ended,jobs,evidence};}
test('exact ended parent failure requires all child/log identities, never arbitrary failed source',()=>{
 assert.equal(checkParentTailFailure(fixture()).childComplete,10374);
 for(const reason of ['run','log','child','source','job','missing','commit']){const f=fixture();
  if(reason==='run')f.ended.id++;if(reason==='log')f.evidence.logSha256='a'.repeat(64);if(reason==='child')f.evidence.distinctWorkers=39;
  if(reason==='source')f.evidence.sourceErrors=1;if(reason==='job')f.jobs.jobs[0].conclusion='failure';if(reason==='missing')f.jobs.jobs.pop();if(reason==='commit')f.ended.head_sha='a'.repeat(40);
  assert.throws(()=>checkParentTailFailure(f),undefined,reason);
 }
});
