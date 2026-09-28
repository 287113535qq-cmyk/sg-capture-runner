import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {continueAfterGame} from './continue-core.mjs';
import {repositories} from '../trial/runner-group.mjs';

const repo=process.env.GITHUB_REPOSITORY,runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
assert(repositories[repo] && process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+10*60000});
async function api(suffix,options={}){
  const response=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/trial-300k.yml/${suffix}`,{
    ...options,headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
  assert(response.ok,'CONTINUATION_API_FAILED');return response.status===204?null:response.json();
}
try{
  const result=await continueAfterGame({store,transport,runId,attempt,github:{
    async hasOtherRun(){
      for(const status of ['queued','pending','waiting','requested','in_progress']){
        const result=await api(`runs?status=${status}&per_page=100`);
        assert(result.total_count<100,'RUN_LIST_INCOMPLETE');
        if(result.workflow_runs.some(r=>String(r.id)!==runId))return true;
      }
      return false;
    },
    dispatch:()=>api('dispatches',{method:'POST',body:JSON.stringify({ref:'main',inputs:{role:'capture',allocation:'round-one',round_one_limit:'0',active_shards:'20'}})})
  }});
  console.log(JSON.stringify(result));
}catch{console.log(JSON.stringify({error:'CONTINUATION_REQUIRES_REVIEW'}));process.exitCode=2;}
finally{transport.close();}
