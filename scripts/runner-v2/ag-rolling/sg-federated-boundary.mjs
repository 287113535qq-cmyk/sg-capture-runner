import assert from 'node:assert/strict';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {cohortRepos,inspectFederation} from './sg-federation.mjs';
// Authenticate the one reviewed companion, then apply the existing strict
// boundary (including its immutable, fixed historical jobless proofs).
export function companionBoundary({read,store,transport,oldProfile,profile,run,coordinatorRun,commit}){
 inspectFederation(profile);assert(run!==coordinatorRun&&/^\d+:1$/.test(run)&&/^\d+:1$/.test(coordinatorRun),'SG_AG_JOIN_RUN');
 return async()=>{
  const self=await read(`repos/${cohortRepos.secondary}/actions/runs/${run.split(':')[0]}`);
  assert(self.id===Number(run.split(':')[0])&&self.run_attempt===1&&self.head_sha===commit&&self.head_branch==='main'
   &&self.repository?.full_name===cohortRepos.secondary&&self.event==='workflow_dispatch'&&self.status==='in_progress'
   &&self.path==='.github/workflows/trial-300k.yml','SG_AG_COMPANION_IDENTITY');
  const records=await transport.request('rolling_boundary_records'),byKey=new Map(records.map(d=>[d._id.slice(8),d]));
  const fixedStore={get:async(c,k)=>c==='journal'&&(k.startsWith('demo-generation:')||k.startsWith('count-'))?byKey.get(k)??null:store.get(c,k),
   getMany:async(c,keys)=>c==='journal'&&keys.every(k=>k.startsWith('demo-generation:'))?keys.map(k=>byKey.get(k)??null):store.getMany(c,keys)};
  const filtered=async path=>{
   const result=await read(path);
   if(!path.startsWith(`repos/${cohortRepos.secondary}/actions/runs?`))return result;
   assert(result.total_count===result.workflow_runs?.length&&result.total_count<100,'SG_AG_JOIN_LIST_TRUNCATED');
   const found=result.workflow_runs.filter(r=>r.id===self.id);assert(found.length<=1,'SG_AG_JOIN_DUPLICATE');
   if(found.length)assert(found[0].head_sha===commit&&found[0].run_attempt===1&&found[0].path===self.path,'SG_AG_JOIN_LIST_CHANGED');
   return {...result,total_count:result.total_count-found.length,workflow_runs:result.workflow_runs.filter(r=>r.id!==self.id)};
  };
  await maintenanceBoundary({read:filtered,store:fixedStore,oldProfile,run:coordinatorRun,commit,workflowPath:'.github/workflows/trial-300k.yml'})();
 };
}
