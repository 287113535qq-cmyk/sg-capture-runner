import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
export function checkParentTailFailure({ended,jobs,evidence}){
 assert(ended?.id===36835017232&&ended.run_attempt===1&&ended.status==='completed'&&ended.conclusion==='failure'
  &&ended.head_sha==='47f2a64680d021e244f8fe8f4500edd9c6742458'&&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.event==='workflow_dispatch','TAIL_FAILURE_IDENTITY');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'TAIL_FAILURE_JOBS');
 const captures=jobs.jobs.filter(j=>/^capture-(?:[0-9]|1[0-9])$/.test(j.name));
 assert(captures.length===20&&new Set(captures.map(j=>j.name)).size===20&&captures.every(j=>j.conclusion==='failure')
  &&['formal-admit','verify'].every(name=>jobs.jobs.some(j=>j.name===name&&j.conclusion==='success'))
  &&jobs.jobs.filter(j=>!captures.includes(j)).every(j=>['success','skipped'].includes(j.conclusion)),'TAIL_FAILURE_JOBS');
 assert(evidence?.schema==='sg-known-parent-tail-failure-v1'&&evidence.sourceRun===ended.id+':1'&&evidence.sourceCommit===ended.head_sha
  &&evidence.logSha256==='228dbb93491cd97660dd8de5dffb00953bb541ad0093e1ad25c8b61dbe4e4663'
  &&evidence.distinctWorkers===40&&evidence.childComplete===10374&&evidence.sourceErrors===0
  &&evidence.parentError==='CONCURRENT_PARENT_GATEWAY_READ','TAIL_FAILURE_LOG_PROOF');return evidence;
}
export function readParentTailFailure(ended,jobs){
 const data=execFileSync('gh',['api','repos/zyzuoyang/sg-capture-runner/actions/runs/36835017232/logs'],{maxBuffer:64*1024*1024});
 const evidence=JSON.parse(execFileSync('python3',['scripts/review_parent_tail_failure.py'],{input:data,maxBuffer:1024*1024,encoding:'utf8'}));
 return checkParentTailFailure({ended,jobs,evidence});
}
