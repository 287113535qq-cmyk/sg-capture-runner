import {performance} from 'node:perf_hooks';
import {failureCode} from '../trial/failure-code.mjs';

// Diagnostic only: no record identities, raw fields, permissions or writes.
export function createAuditProgress({emit=()=>{},now=()=>performance.now()}={}){
 const allowed=new Set(['readback','python','recordChecks','commitProof']);
 const start=now(),phases={},send=row=>{try{emit({schema:'sg-audit-progress-v1',...row});}catch{}};
 let pages=0,verified=0,next=10000;
 const snapshot=event=>({event,pages,verified,elapsedMs:Math.round(now()-start),phases:structuredClone(phases)});
 return {
  async run(phase,fn){
   if(!allowed.has(phase))throw Error('UNKNOWN_AUDIT_PHASE');
   const at=now();
   try{return await fn();}finally{
    const value=phases[phase]??={calls:0,elapsedMs:0};value.calls++;value.elapsedMs+=Math.max(0,now()-at);
   }
  },
  page(rows,count){
   if(!Number.isSafeInteger(rows)||rows<1||rows>100||count!==verified+rows)throw Error('AUDIT_PROGRESS_COUNT');
   pages++;verified=count;
   if(verified>=next){send(snapshot('page-checks-complete'));next=verified+10000;}
  },
  finish(){send({...snapshot('proof-committed'),gameCompletionProved:true});},
  failed(error){send({...snapshot('failed'),gameCompletionProved:false,code:failureCode(error)});}
 };
}
