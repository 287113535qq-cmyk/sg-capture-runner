import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {cohortRepos} from './sg-federation.mjs';
// The independent AG controller shares lane 20's hosted runner. It uses its
// own process/SSH connection and zero source credentials; it occupies no
// additional GitHub job slot and never blocks the original lane loop.
export async function runRollingJob({lane,environment,spawnProcess=spawn,signal,log=console.log}){
 assert(Number.isSafeInteger(lane)&&lane>=1&&lane<=20,'SG_AG_JOB_LANE');
 const children=new Set(),timers=new Map(),terminated=new Set(),start=(mode,env)=>{
  const child=spawnProcess(process.execPath,['scripts/runner-v2/ag-rolling/sg-live.mjs',mode],
   {env,stdio:mode==='controller'?['inherit','inherit','inherit','ipc']:'inherit'});
  children.add(child);
  const ended=new Promise(resolve=>{
   let failed=false;
   child.once('error',()=>{failed=true;});
   child.once('close',(code,exitSignal)=>{
    children.delete(child);clearTimeout(timers.get(child));timers.delete(child);
    resolve({code:failed?2:code,signal:exitSignal,sourceClosed:true,pid:child.pid??null});
   });
  });return {child,ended};
 };
 const cancel=()=>{for(const child of children){if(terminated.has(child))continue;terminated.add(child);child.kill('SIGTERM');
  if(children.has(child)){const timer=setTimeout(()=>{if(children.has(child))child.kill('SIGKILL');},5000);timer.unref?.();timers.set(child,timer);}
 }};
 signal?.addEventListener('abort',cancel,{once:true});
 let controller,source;
 try{
  if(lane===20&&environment.GITHUB_REPOSITORY!==cohortRepos.secondary){const env={...environment,SG_AG_CONTROLLER_LANE:'20'};
   delete env.SG_TRIAL_DEMO_CONFIG;delete env.SG_AG_LANE;
   controller=start('controller',env);
   controller.ended.then(result=>log(JSON.stringify({phase:'controller-process-ended',...result,sourceRequests:0})));
  }
  const sourceEnv={...environment,SG_AG_LANE:String(lane)};
  for(const key of Object.keys(sourceEnv))if(key.startsWith('SG_BUSINESS_'))delete sourceEnv[key];
  source=start('lane',sourceEnv);
  if(signal?.aborted)cancel();
  const result=await source.ended;
  // Lane 20 may finish before the other lanes. Keep its zero-source
  // controller alive until those lanes finish or the AG deadline expires.
  if(controller?.child.connected)controller.child.send({type:'lane-source-ended',lane:20,run:environment.GITHUB_RUN_ID+':'+environment.GITHUB_RUN_ATTEMPT,...result},()=>{});
  if(controller)await controller.ended;
  return result.code===0?0:2;
 }finally{signal?.removeEventListener('abort',cancel);cancel();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&Object.values(cohortRepos).includes(process.env.GITHUB_REPOSITORY),
  'SG_AG_GITHUB_JOB_OWNER');
 const stop=new AbortController(),cancel=()=>stop.abort();
 process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
 try{process.exitCode=await runRollingJob({lane:Number(process.env.SG_AG_LANE),environment:process.env,signal:stop.signal});}
 finally{process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);}
}
