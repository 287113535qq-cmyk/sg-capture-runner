import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
export function checkVerifyEntryFailure({ended,jobs,evidence}){
 assert(ended?.id===36839677352&&ended.run_attempt===1&&ended.status==='completed'&&ended.conclusion==='failure'
  &&ended.head_sha==='ca9ea3f9c5f00718ea496a44b33c2d1b857c3a96'&&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'
  &&ended.path==='.github/workflows/trial-300k.yml'&&ended.event==='workflow_dispatch','VERIFY_ENTRY_IDENTITY');
 assert(jobs?.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'VERIFY_ENTRY_JOBS');
 const captures=jobs.jobs.filter(j=>/^capture-(?:[0-9]|1[0-9])$/.test(j.name));
 assert(captures.length===20&&new Set(captures.map(j=>j.name)).size===20&&captures.every(j=>j.conclusion==='success')
  &&jobs.jobs.filter(j=>j.name==='formal-admit'&&j.conclusion==='success').length===1
  &&jobs.jobs.filter(j=>j.name==='verify'&&j.conclusion==='failure').length===1
  &&jobs.jobs.filter(j=>!captures.includes(j)&&j.name!=='verify').every(j=>['success','skipped'].includes(j.conclusion)),'VERIFY_ENTRY_JOBS');
 assert(evidence?.schema==='sg-known-verify-entry-failure-v1'&&evidence.sourceRun===ended.id+':1'&&evidence.sourceCommit===ended.head_sha
  &&evidence.logSha256==='f94b062a08e35975e2a78da424ac787d986171a529f5e4a5e514dcbc757074a7'
  &&evidence.distinctWorkers===40&&evidence.childComplete===17028&&evidence.sourceErrors===0&&evidence.verifyError==='COUNT_SESSION_WINDOW_PERMISSION','VERIFY_ENTRY_PROOF');
 return evidence;
}
export function readVerifyEntryFailure(ended,jobs){
 const data=execFileSync('gh',['api','repos/zyzuoyang/sg-capture-runner/actions/runs/36839677352/logs'],{maxBuffer:64*1024*1024});
 const evidence=JSON.parse(execFileSync('python3',['scripts/review_verify_entry_failure.py'],{input:data,maxBuffer:1024*1024,encoding:'utf8'}));
 return checkVerifyEntryFailure({ended,jobs,evidence});
}
