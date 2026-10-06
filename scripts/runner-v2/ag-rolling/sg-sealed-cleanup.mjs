import assert from 'node:assert/strict';

export const SEALED_CLEANUP_MS=90000;

// The caller may enable this only after finalizeEndedSource returned, including
// the idle CAS and its complete readback. Its reconciliation has then settled;
// only resource close remains. A timeout terminates the process, never pretends
// that Mongo close resolved, and is unavailable before that source proof.
export async function closeSealedSource({sourceSealed,close,writeSync,closeTransport,exit,
 setTimer=setTimeout,clearTimer=clearTimeout}){
 assert(typeof sourceSealed==='boolean'&&typeof close==='function','SG_AG_SEALED_CLEANUP_SCOPE');
 if(!sourceSealed)return close();
 assert([writeSync,closeTransport,exit].every(f=>typeof f==='function'),'SG_AG_SEALED_CLEANUP_PORTS');
 const timer=setTimer(()=>{
  try{writeSync(JSON.stringify({code:'SG_AG_SOURCE_SEALED_CLEANUP_TIMEOUT',sourceSealed:true,
   businessCloseCompleted:false,sourceRequests:0})+'\n');}
  finally{try{closeTransport();}finally{exit(0);}}
 },SEALED_CLEANUP_MS);
 try{return await close();}finally{clearTimer(timer);}
}
