import assert from 'node:assert/strict';
import {original} from './expired-run-review.mjs';
import {stalled} from './demo-run-fence.mjs';
// Neither failed source is allowed to coexist. Only this maintenance and the
// two already revoked, exact jobless historical queue entries are permitted.
export function sharedCloseBoundary({read,repository,run,commit,now=Date.now}){
 const repos=['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'],old=[original,stalled],id=Number(run.split(':')[0]);
 assert(repos.includes(repository)&&/^\d+:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit),'SHARED_BOUNDARY_SCOPE');
 return async()=>{
  const started=now(),queries=repos.flatMap(repo=>['in_progress','queued','pending','waiting','requested'].map(status=>({repo,status})));
  for(let n=0;n<queries.length;n+=5){const wave=queries.slice(n,n+5),rs=await Promise.allSettled(wave.map(q=>read(`repos/${q.repo}/actions/runs?status=${q.status}&per_page=100`)));
   for(const [i,result] of rs.entries()){
    assert(result.status==='fulfilled','SHARED_BOUNDARY_LIST');const q=wave[i],v=result.value;
    assert(v.total_count<100&&v.total_count===v.workflow_runs?.length,'SHARED_BOUNDARY_TRUNCATED');
    for(const r of v.workflow_runs){const historical=q.repo===repos[0]?old.find(o=>o.id===r.id):null;
     assert(r.run_attempt===1&&(historical?q.status==='queued'&&r.head_sha===historical.commit&&r.path==='.github/workflows/trial-300k.yml':
      q.repo===repository&&r.id===id&&q.status==='in_progress'&&r.head_sha===commit&&r.path==='.github/workflows/demo-maintenance.yml'),'OTHER_RUN_ACTIVE');
    }
   }
  }
  for(const o of old){const path=`repos/${repos[0]}/actions/runs/${o.id}`,r=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
   assert(r.id===o.id&&r.run_attempt===1&&r.repository.full_name===repos[0]&&r.head_sha===o.commit&&r.event==='workflow_dispatch'
    &&r.path==='.github/workflows/trial-300k.yml'&&r.status==='queued'&&r.conclusion===null&&jobs.total_count===0&&jobs.jobs?.length===0,'SHARED_OLD_RUN_CHANGED');
  }
  const self=await read(`repos/${repository}/actions/runs/${id}`);
  assert(self.id===id&&self.run_attempt===1&&self.repository.full_name===repository&&self.head_sha===commit&&self.event==='workflow_dispatch'
   &&self.status==='in_progress'&&self.path==='.github/workflows/demo-maintenance.yml'&&now()-started<=30000,'SHARED_BOUNDARY_SELF');
 };
}
