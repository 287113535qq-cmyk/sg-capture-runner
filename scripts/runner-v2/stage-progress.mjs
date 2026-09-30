import {failureCode} from '../trial/failure-code.mjs';
const stages=new Set(['select','capture','audit','finalize','status','preflight','admission','readback']);
// Records actual running stages; does not grant permissions or repeat actions.
export function createStageProgress({emit=()=>{},now=()=>performance.now(),slowMs=300000}={}){
 let sequence=0;
 const send=row=>{try{emit({schema:'sg-stage-progress-v1',...row});}catch{}};
 return {async run(stage,fn){
  if(!stages.has(stage))throw Error('UNKNOWN_DIAGNOSTIC_STAGE');
  const id=++sequence,start=now();send({stage,id,event:'started'});
  const timer=setInterval(()=>send({stage,id,event:'running',elapsedMs:Math.round(now()-start),
   ...(stage!=='capture'?{thresholdExceeded:true}:{})}),slowMs);timer.unref?.();
  try{const value=await fn();send({stage,id,event:'completed',elapsedMs:Math.round(now()-start)});return value;}
  catch(error){send({stage,id,event:'blocked',elapsedMs:Math.round(now()-start),code:failureCode(error)});throw error;}
  finally{clearInterval(timer);}
 }};
}
