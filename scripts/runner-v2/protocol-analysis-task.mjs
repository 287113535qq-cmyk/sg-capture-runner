import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

// Structural observations are sidecars. They cannot approve a request route,
// change the original evidence or release a game for capture.
export function observeProtocolTask(task){
  assert(task?.schema==='sg-offline-protocol-task-v1'&&Number.isSafeInteger(task.gameId)
    &&task.rawHash===hash(task.evidence),'PROTOCOL_ANALYSIS_INPUT_CHANGED');
  const fields=new Map();let nodes=0;
  const visit=(v,p,depth)=>{
    assert(depth<=64&&++nodes<=200000,'PROTOCOL_ANALYSIS_BOUND');
    if(Array.isArray(v)){for(const value of v)visit(value,p+'[]',depth+1);}
    else if(v&&typeof v==='object')for(const [key,value] of Object.entries(v)){
      const next=p?`${p}.${key}`:key;fields.set(next,(fields.get(next)??0)+1);visit(value,next,depth+1);
    }
  };
  visit(task.evidence,'',0);
  return {schema:'sg-offline-protocol-observation-v1',gameId:task.gameId,rawHash:task.rawHash,
    fields:[...fields.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([field,occurrences])=>({field,occurrences})),
    status:'semantic-review-required',classification:null,sourceAllowance:0,captureAuthorization:false};
}
