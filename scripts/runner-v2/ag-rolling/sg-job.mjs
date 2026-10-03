import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// The independent AG controller shares lane 20's hosted runner. It uses its
// own process/SSH connection and zero source credentials; it occupies no
// additional GitHub job slot and never blocks the original lane loop.
export async function runRollingJob({lane,environment,spawnProcess=spawn,signal,log=console.log}){
 assert(Number.isSafeInteger(lane)&&lane>=1&&lane<=20,'SG_AG_JOB_LANE');
 const children=new Set(),start=(mode,env)=>{
  const child=spawnProcess(process.execPath,['scripts/runner-v2/ag-rolling/sg-live.mjs',mode],
   {env,stdio:mode==='controller'?['inherit','inherit','inherit','ipc']:'inherit'});
  children.add(child);
  const ended=new Promise(resolve=>{
   child.once('error',()=>{children.delete(child);resolve({code:2,signal:null});});
   child.once('exit',(code,exitSignal)=>{children.delete(child);resolve({code,signal:exitSignal});});
  });return {child,ended};
 };
 const cancel=()=>{for(const child of children)child.kill('SIGTERM');};
 signal?.addEventListener('abort',cancel,{once:true});
 let controller,source;
 try{
  if(lane===20){const env={...environment,SG_AG_CONTROLLER_LANE:'20'};
   delete env.SG_TRIAL_DEMO_CONFIG;delete env.SG_AG_LANE;
   controller=start('controller',env);
   controller.ended.then(result=>log(JSON.stringify({phase:'controller-process-ended',...result,sourceRequests:0})));
  }
  source=start('lane',{...environment,SG_AG_LANE:String(lane)});
  if(signal?.aborted)cancel();
  const result=await source.ended;
  // Lane 20 may finish before the other lanes. Keep its zero-source
  // controller alive until those lanes finish or the AG deadline expires.
  if(controller?.child.connected)controller.child.send({type:'lane-source-ended',lane:20},()=>{});
  if(controller)await controller.ended;
  return result.code===0?0:2;
 }finally{signal?.removeEventListener('abort',cancel);cancel();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner',
  'SG_AG_GITHUB_JOB_OWNER');
 const stop=new AbortController(),cancel=()=>stop.abort();
 process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
 try{process.exitCode=await runRollingJob({lane:Number(process.env.SG_AG_LANE),environment:process.env,signal:stop.signal});}
 finally{process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);}
}
