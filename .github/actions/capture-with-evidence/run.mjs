import assert from 'node:assert/strict';import path from 'node:path';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
import {publishSealedChunks} from '../../../scripts/runner-v2/sealed-evidence-publisher.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'&&process.env.RUNNER_ENVIRONMENT==='github-hosted','SEALED_ACTION_RUNNER');
const mode=process.env.INPUT_MODE;assert(['round-one','legacy-fixed','readonly-export'].includes(mode),'SEALED_ACTION_MODE');
const root=process.env.GITHUB_WORKSPACE,env={...process.env};
if(mode==='round-one')env.SG_ENCRYPTED_EVIDENCE='1';
if(mode==='legacy-fixed')delete env.SG_POOL_RUN_LIMIT;
const command=mode==='readonly-export'?['scripts/runner-v2/work-line-evidence-export.mjs']:
 [mode==='round-one'?'scripts/runner-v2/campaign-worker.mjs':'scripts/trial/worker.mjs','capture'];
// Preserve the capture job's configured Node executable. The action runtime
// is only the independent publisher and must not silently migrate capture.
const child=spawn('node',command,{cwd:root,env,stdio:'inherit'});let ended=false,exitCode=1;
child.on('error',()=>{ended=true;});child.on('close',code=>{exitCode=code??1;ended=true;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
const origin={runId:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT},attempted=new Set(),execute=promisify(execFile);let deliveryErrors=0;
const shard=mode==='readonly-export'?'recovery':env.SG_TRIAL_SHARD;
const upload=async({name,folder})=>{
 const uploadEnv={...env,INPUT_NAME:name,INPUT_PATH:path.join(folder,'*.json'),'INPUT_IF-NO-FILES-FOUND':'error',
  'INPUT_RETENTION-DAYS':'7','INPUT_COMPRESSION-LEVEL':'0','INPUT_INCLUDE-HIDDEN-FILES':'true',INPUT_OVERWRITE:'false'};
 // Official bundled action is checked out at the fixed reviewed commit. Its
 // runtime token stays in the Actions process; it never reaches local readers.
 await execute(process.execPath,[path.join(root,'.local/pinned-upload-artifact/dist/upload/index.js')],
  {cwd:root,env:uploadEnv,timeout:60000,maxBuffer:1024*1024});
};
do{
 const endedBeforeDrain=ended;
 try{const r=await publishSealedChunks({dir:path.join(root,'work-line-sealed'),staging:path.join(root,'.local/sealed-upload'),origin,shard,attempted,upload});
  deliveryErrors+=r.deliveryPending;
  if(r.uploaded||r.deliveryPending)console.log(JSON.stringify({status:'sealed-evidence-publication',...r,sourceRequests:0}));}
 catch{deliveryErrors++;console.log(JSON.stringify({status:'sealed-evidence-publication-requires-review',sourceRequests:0}));}
 if(endedBeforeDrain)break;
 if(!ended)await new Promise(r=>setTimeout(r,10000));
}while(true);
// Keep the capture controller's exit result. Independent analysis delivery
// does not convert an acknowledged healthy capture into a protocol failure.
process.exitCode=mode==='readonly-export'&&deliveryErrors?1:exitCode;
