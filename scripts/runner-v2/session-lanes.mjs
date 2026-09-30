import {spawn} from 'node:child_process';
import {sessionLayout,sessionWorker} from './session-layout.mjs';

// Each process owns its own cookie jar, analyzer, spool, SSH RPC and one session.
// Never restart a failed lane. Siblings drain through the shared source control.
export async function captureSessionLanes({plan,host,group,env,history,spawnImpl=spawn,signal}){
 const lanes=sessionLayout(plan)?.lanesPerHost??1;
 const children=[];let stopping=false;
 const stop=()=>{stopping=true;for(const child of children)if(child.exitCode===null)child.kill('SIGTERM');};
 if(signal?.aborted)return 2;
 signal?.addEventListener('abort',stop,{once:true});
 try{
  const results=await Promise.all(Array.from({length:lanes},(_,lane)=>new Promise(resolve=>{
   sessionWorker(plan,host,group,lane);
   if(stopping){resolve(2);return;}
   const childEnv={...env,SG_SESSION_LANE:String(lane)};
   // Multiple children must not overwrite a shared Actions output key.
   if(lanes>1)delete childEnv.GITHUB_OUTPUT;
   let child;
   try{child=spawnImpl(process.execPath,['scripts/trial/worker.mjs','capture'],
    {stdio:['inherit','inherit','inherit','pipe'],env:childEnv});children.push(child);}
   catch{stop();resolve(2);return;}
   child.once('error',()=>{stop();resolve(2);});
   child.once('exit',(code)=>resolve(code===0?0:2));
   child.stdio[3].on('error',()=>{});
   child.stdio[3].end(JSON.stringify(history));
  })));
  return results.every(code=>code===0)?0:2;
 }finally{signal?.removeEventListener('abort',stop);}
}
