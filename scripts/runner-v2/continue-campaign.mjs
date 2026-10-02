import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {continueAfterGame} from './continue-core.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {continuationHasOtherRun} from './continuation-boundary.mjs';
import {authenticatedRead} from './github-boundary.mjs';
import fs from 'node:fs';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';

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
  // Same reviewed inventory as capture selection, before spending a matrix run.
  // This prevents an empty preparation queue from dispatching old ready rows.
  const publication=JSON.parse(fs.readFileSync('config/prepared-inventory.json','utf8'));
  const preparedSelector=publishedPreparedSelector({publication,
    plans:JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),
    readEvidence:ref=>JSON.parse(fs.readFileSync(ref,'utf8'))});
  const result=await continueAfterGame({store,transport,runId,attempt,preparedSelector,group:repositories[repo].name,github:{
    hasOtherRun:()=>continuationHasOtherRun({read:authenticatedRead(process.env.GH_TOKEN),store,repository:repo,runId}),
    dispatch:()=>api('dispatches',{method:'POST',body:JSON.stringify({ref:'main',inputs:{role:'capture',allocation:'round-one',round_one_limit:'0',active_shards:'20'}})})
  }});
  console.log(JSON.stringify(result));
}catch{console.log(JSON.stringify({error:'CONTINUATION_REQUIRES_REVIEW'}));process.exitCode=2;}
finally{transport.close();}
