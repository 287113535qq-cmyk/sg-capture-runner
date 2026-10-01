import {joblessFencedRead} from './count-jobless-fence.mjs';
import assert from 'node:assert/strict';
import {original} from './expired-run-review.mjs';
import {stalled,revokedMarker} from './demo-run-fence.mjs';
import {RECEIPT_KEY,NEW_PREFIX} from './supersession-receipt.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Only the two previously fenced, exact runs may be excluded. This is not an
// age-based queue bypass: identity, no jobs, and durable revocation are required.
export async function continuationHasOtherRun({read,store,repository,runId,now=Date.now}){
  read=joblessFencedRead({read,store});
  const started=now(),known=new Map([[original.id,original],[stalled.id,stalled]]),excluded=new Set();
  for(const status of ['queued','pending','waiting','requested','in_progress']){
    const result=await read(`repos/${repository}/actions/workflows/trial-300k.yml/runs?status=${status}&per_page=100`);
    assert(Number.isInteger(result.total_count)&&result.total_count<100
      &&Array.isArray(result.workflow_runs)&&result.workflow_runs.length===result.total_count,'RUN_LIST_INCOMPLETE');
    for(const r of result.workflow_runs){
      if(String(r.id)===String(runId))continue;
      const expected=repository===original.repository?known.get(r.id):null;
      if(!expected)return true;
      assert(status==='queued'&&r.head_sha===expected.commit&&r.run_attempt===1,'FENCED_RUN_CHANGED');
      excluded.add(r.id);
    }
  }
  for(const id of excluded){
    const expected=known.get(id);
    if(id===stalled.id){
      const c=(await store.get('state','campaign'))?.value;
      const done=(await store.get('journal',`demo-run-revoked:${id}:complete`))?.value;
      assert(hash(c?.demoRunRevoked)===hash(revokedMarker)
        &&done?.schema==='sg-demo-run-revoked-complete-v1'&&hash(done.marker)===hash(revokedMarker),'REVOCATION_REQUIRED');
    }else{
      const receipt=(await store.get('journal',RECEIPT_KEY))?.value;
      const done=(await store.get('journal',RECEIPT_KEY+':complete'))?.value;
      const proof=(await store.get('journal',receipt?.newPrefix+':proof'))?.value;
      assert(receipt?.schema==='sg-queued-supersession-v1'&&receipt.oldRun===id
        &&receipt.oldCommit===original.commit&&receipt.oldProfileHash===original.profileHash&&receipt.newPrefix===NEW_PREFIX
        &&/^[a-f0-9]{64}$/.test(done?.proofHash || '')
        &&done?.receiptHash===hash(receipt)&&done.proofHash===proof?.proofHash
        &&done.commit===receipt.newCommit&&now()>original.expiresAt,'SUPERSESSION_REQUIRED');
    }
    const r=await read(`repos/${repository}/actions/runs/${id}`);
    const jobs=await read(`repos/${repository}/actions/runs/${id}/jobs?filter=all&per_page=100`);
    assert(r.id===id&&r.run_attempt===1&&r.head_sha===expected.commit&&r.repository?.full_name===repository
      &&r.event==='workflow_dispatch'&&r.path==='.github/workflows/trial-300k.yml'
      &&r.status==='queued'&&r.conclusion===null,'FENCED_RUN_CHANGED');
    assert(jobs.total_count===0&&Array.isArray(jobs.jobs)&&jobs.jobs.length===0,'FENCED_JOB_EXISTS');
  }
  assert(now()-started<=30000,'GITHUB_EVIDENCE_STALE');return false;
}
