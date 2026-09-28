import assert from 'node:assert/strict';

// Secondary writes are scoped by its trusted SSH key. A primary normal matrix
// may continue, but concurrent maintenance / unknown jobs never share this window.
export function reviewOtherGroupRun({policy,run,jobs,totalCount}){
  assert(policy.group==='secondary' && run.path==='.github/workflows/trial-300k.yml'
    && ['schedule','workflow_dispatch'].includes(run.event),'OTHER_RUN_ACTIVE');
  assert(Number.isInteger(totalCount) && totalCount===jobs.length && totalCount<100,'GITHUB_JOB_LIST_TRUNCATED');
  const capture=jobs.filter(j=>/^capture-(?:[0-9]|1[0-9])$/.test(j.name));
  assert(capture.length===20 && new Set(capture.map(j=>j.name)).size===20,'OTHER_RUN_NOT_CAPTURE');
  assert(capture.some(j=>j.steps?.some(s=>s.name==='Capture complete rounds with independent sessions')),'OTHER_RUN_NOT_CAPTURE');
  assert(capture.every(j=>j.conclusion===null || ['success','skipped'].includes(j.conclusion)),'OTHER_CAPTURE_FAILED');
  assert(jobs.every(j=>capture.includes(j) || j.name==='verify' || j.status==='completed' && j.conclusion==='skipped'),'OTHER_MAINTENANCE_ACTIVE');
  assert(jobs.filter(j=>j.name==='verify').every(j=>j.conclusion===null || ['success','skipped'].includes(j.conclusion)),'OTHER_VERIFY_FAILED');
  return {id:run.id,attempt:run.run_attempt,head:run.head_sha,status:run.status};
}
