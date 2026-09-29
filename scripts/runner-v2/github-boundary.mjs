import assert from 'node:assert/strict';
import {original} from './expired-run-review.mjs';
const repos=[original.repository,'287113535qq-cmyk/sg-capture-runner'];
export function githubBoundary({read,run,commit,now=Date.now}){
  assert(/^\d+:1$/.test(run) && Number(run.split(':')[0])!==original.id,'NEW_UNIQUE_RUN_REQUIRED');
  return async()=>{
    const start=now(),id=Number(run.split(':')[0]);
    for(const repository of repos)for(const status of ['in_progress','queued','pending','waiting','requested']){
      const result=await read(`repos/${repository}/actions/runs?status=${status}&per_page=100`);
      assert(Number.isInteger(result.total_count) && result.total_count<100
        && Array.isArray(result.workflow_runs) && result.workflow_runs.length===result.total_count,'GITHUB_RUN_LIST_TRUNCATED');
      for(const item of result.workflow_runs){
        assert(repository===original.repository && (item.id===id || item.id===original.id),'OTHER_RUN_ACTIVE');
        if(item.id===id)assert(item.head_sha===commit && item.run_attempt===1
          && item.path==='.github/workflows/trial-300k.yml','CURRENT_RUN_CHANGED');
      }
    }
    const old=await read(`repos/${original.repository}/actions/runs/${original.id}`);
    const jobs=await read(`repos/${original.repository}/actions/runs/${original.id}/jobs?filter=all&per_page=100`);
    assert(old.id===original.id && old.run_attempt===1 && old.head_sha===original.commit
      && old.repository.full_name===original.repository && old.event==='workflow_dispatch'
      && old.path==='.github/workflows/trial-300k.yml','OLD_RUN_IDENTITY_CHANGED');
    assert(old.status==='queued' && old.conclusion===null,'OLD_RUN_STATE_CHANGED');
    assert(jobs.total_count===0 && Array.isArray(jobs.jobs) && jobs.jobs.length===0,'OLD_JOB_EXISTS');
    assert(now()>=original.expiresAt+300000 && now()-start<=30000,'GITHUB_EVIDENCE_STALE');
  };
}
export function authenticatedRead(token){
  assert(typeof token==='string' && token.length>0,'GITHUB_AUTH_REQUIRED');
  return async path=>{
    assert(path.startsWith('repos/') && !path.includes('..'),'INVALID_GITHUB_PATH');
    const r=await fetch('https://api.github.com/'+path,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});
    assert(r.ok,'GITHUB_RUN_READ_FAILED');return r.json();
  };
}
