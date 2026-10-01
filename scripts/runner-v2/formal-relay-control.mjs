import fs from 'node:fs';import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {secondaryParallelBoundary} from './secondary-parallel-boundary.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {formalCountProfilePath,applyFormalCount} from './formal-count-plan.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';import {relayFormalRun,formalRelayInputs,formalRelayRuntimePath} from './formal-relay.mjs';
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),inputs=formalRelayInputs(event.inputs);
if(inputs.formal_relay!=='same-allocation-v1'){console.log(JSON.stringify({continued:false,reason:'FORMAL_RELAY_DISABLED'}));process.exit(0);}
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GH_TOKEN,'GITHUB_REQUIRED');
const repository=process.env.GITHUB_REPOSITORY,group=repository==='zyzuoyang/sg-capture-runner'?'primary':'secondary';
assert(['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(repository),'REPOSITORY_SCOPE');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load(formalCountProfilePath()),plans=applyFormalCount(load('config/round-one-plans.json'),profile),plan=plans[profile.gameId];
const runtimePath=formalRelayRuntimePath(inputs),revision=runtimePath?load(runtimePath):null,peer=revision?.secondaryPeer??profile.primaryPeer;
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,read=authenticatedRead(process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+10*60000});let claimed=false;
const idle=peer?countPeerBoundary({read,transport,peer,selfGroup:group,run,commit,workflowPath:'.github/workflows/trial-300k.yml'}):
 group==='primary'?maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/trial-300k.yml'}):
 secondaryParallelBoundary({read,transport,run,commit,primaryRun:pyramidsRepairEntry('admit',inputs.formal_profile).primaryRun,allowEndedPrimary:true,workflowPath:'.github/workflows/trial-300k.yml'});
async function api(path,method,body){
 const r=await fetch(`https://api.github.com/repos/${repository}/${path}`,{method,body:body===undefined?undefined:JSON.stringify(body),
  headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
 assert(r.ok,'FORMAL_RELAY_API_FAILED');
}
try{
 const boundary=async()=>{await idle();await store.writable();await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(h=>h&&h.value.active===false),'FORMAL_RELAY_HOLD');
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');};
 const source=await read(`repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`),jobs=await read(`repos/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=all&per_page=100`);
 const result=await relayFormalRun({store,plan,profile,inputs,source,jobs,commit,repository,boundary,
  createIntent:async(key,value)=>{await store.writable();const r=await transport.request('create',{collection:'journal',key,value});claimed=r.created===true;return claimed;},
  dispatch:async({ref,inputs})=>{
   const branch=await read(`repos/${repository}/git/ref/heads/${ref}`);assert(branch.object?.sha===commit,'FORMAL_RELAY_REF_CHANGED');
   await api('actions/workflows/trial-300k.yml/enable','PUT');
   try{await api('actions/workflows/trial-300k.yml/dispatches','POST',{ref,inputs});}
   finally{await api('actions/workflows/trial-300k.yml/disable','PUT');}
  }});
 console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({continued:false,error:/^[A-Z0-9_]+$/.test(error.message)?error.message:'FORMAL_RELAY_REQUIRES_REVIEW',intentCreated:claimed}));if(claimed)process.exitCode=2;}
finally{transport.close();}
