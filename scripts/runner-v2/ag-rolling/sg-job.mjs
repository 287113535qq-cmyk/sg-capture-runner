import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {cohortRepos} from './sg-federation.mjs';
import {LANE_BUDGET_MS} from './ag-core.mjs';
// The independent AG controller shares lane 20's hosted runner. It uses its
// own process/SSH connection and zero source credentials; it occupies no
// additional GitHub job slot and never blocks the original lane loop.
export async function runRollingJob({lane,environment,spawnProcess=spawn,signal,log=console.log,
 setTimer=setTimeout,clearTimer=clearTimeout}){
 assert(Number.isSafeInteger(lane)&&lane>=1&&lane<=20,'SG_AG_JOB_LANE');
 const children=new Map(),records=[],endings=[];let stopped=false,rejectUnclosed;
 const unclosed=new Promise((resolve,reject)=>{rejectUnclosed=reject;});
 const waitFor=promise=>Promise.race([promise,unclosed]);
 const clearChildTimers=record=>{
  if(record.killTimer!==undefined)clearTimer(record.killTimer);
  if(record.closeTimer!==undefined)clearTimer(record.closeTimer);
 };
 const terminate=record=>{
  if(record.closed||record.terminated)return;
  record.terminated=true;
  const kill=signal=>{
   // No PID means spawn has not established a child. Its real close event
   // remains authoritative; do not turn a failed kill into a closed source.
   if(record.child.pid===undefined)return;
   try{if(record.child.kill(signal)===false)record.failed=true;}catch{record.failed=true;}
  };
  kill('SIGTERM');
  if(record.closed)return;
  record.killTimer=setTimer(()=>{
   if(record.closed)return;kill('SIGKILL');
   if(record.closed)return;
   // An inherited pipe or failed kill can prevent close forever. Fail the
   // owner after a bounded close wait, retaining all native state as unknown.
   record.closeTimer=setTimer(()=>{
    if(record.closed)return;
    rejectUnclosed(Object.assign(Error('SG_AG_JOB_CLOSE_UNKNOWN_RETAINED'),{
     outcomeUnknown:true,sourceClosed:false,pid:record.child.pid??null}));
   },5000);
  },5000);
 };
 const cancel=()=>{stopped=true;for(const record of children.values())terminate(record);};
 // This process deadline also covers promises that never reach a cooperative
 // guard. The child still enforces its earlier original permit deadline.
 const budgetTimer=setTimer(cancel,LANE_BUDGET_MS);
 const start=(mode,env)=>{
  const child=spawnProcess(process.execPath,['scripts/runner-v2/ag-rolling/sg-live.mjs',mode],
   {env,stdio:mode==='controller'?['inherit','inherit','inherit','ipc']:'inherit'});
  const record={child,closed:false,failed:false,terminated:false};children.set(child,record);records.push(record);
  const ended=new Promise(resolve=>{
   child.on('error',()=>{record.failed=true;terminate(record);});
   child.once('close',(code,exitSignal)=>{
    record.closed=true;children.delete(child);clearChildTimers(record);
    resolve({code:record.failed?2:code,signal:exitSignal,sourceClosed:true,pid:child.pid??null});
   });
  });endings.push(ended);return {child,ended};
 };
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
  const result=await waitFor(source.ended);
  log(JSON.stringify({phase:'source-process-ended',lane,...result}));
  // Lane 20 may finish before the other lanes. Keep its zero-source
  // controller alive until those lanes finish or the AG deadline expires.
  if(controller?.child.connected)controller.child.send({type:'lane-source-ended',lane:20,run:environment.GITHUB_RUN_ID+':'+environment.GITHUB_RUN_ATTEMPT,...result},()=>{});
  if(controller)await waitFor(controller.ended);
  return !stopped&&result.code===0?0:2;
 }finally{
  signal?.removeEventListener('abort',cancel);cancel();
  try{await waitFor(Promise.all(endings));}
  finally{clearTimer(budgetTimer);for(const record of records)clearChildTimers(record);}
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
  &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&Object.values(cohortRepos).includes(process.env.GITHUB_REPOSITORY),
  'SG_AG_GITHUB_JOB_OWNER');
 const stop=new AbortController(),cancel=()=>stop.abort();
 process.on('SIGTERM',cancel);process.on('SIGINT',cancel);
 try{process.exitCode=await runRollingJob({lane:Number(process.env.SG_AG_LANE),environment:process.env,signal:stop.signal});}
 catch{
  // A kill error or missing close cannot free the source fence. Force only
  // this owner to fail; the hosted runner cleans up remaining OS children.
  writeSync(2,JSON.stringify({phase:'job-process-failed-retained',sourceClosed:false,stateRetained:true})+'\n');
  process.exit(2);
 }
 finally{process.removeListener('SIGTERM',cancel);process.removeListener('SIGINT',cancel);}
}
