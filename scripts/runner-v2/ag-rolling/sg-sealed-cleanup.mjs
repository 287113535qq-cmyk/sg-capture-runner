import assert from 'node:assert/strict';

export const SEALED_CLEANUP_MS=90000;
export const UNSEALED_CLEANUP_MS=90000;

// This runs only after work unwinds into finally. A sealed source can retain
// its proven success on cleanup timeout. Every unsealed timeout exits failed
// with unknown state retained; it never seals, retries or releases DB fences.
export async function closeSealedSource({sourceSealed,close,writeSync,closeTransport,exit,
 setTimer=setTimeout,clearTimer=clearTimeout}){
 assert(typeof sourceSealed==='boolean'&&typeof close==='function','SG_AG_SEALED_CLEANUP_SCOPE');
 assert([writeSync,closeTransport,exit].every(f=>typeof f==='function'),'SG_AG_SEALED_CLEANUP_PORTS');
 const timer=setTimer(()=>{
  try{writeSync(JSON.stringify({code:sourceSealed?'SG_AG_SOURCE_SEALED_CLEANUP_TIMEOUT':'SG_AG_UNSEALED_CLEANUP_TIMEOUT',sourceSealed,
   businessCloseCompleted:false,...(!sourceSealed?{outcomeUnknown:true,stateRetained:true}:{}),sourceRequests:0})+'\n');}
  finally{try{closeTransport();}finally{exit(sourceSealed?0:2);}}
 },sourceSealed?SEALED_CLEANUP_MS:UNSEALED_CLEANUP_MS);
 try{return await close();}finally{clearTimer(timer);}
}
