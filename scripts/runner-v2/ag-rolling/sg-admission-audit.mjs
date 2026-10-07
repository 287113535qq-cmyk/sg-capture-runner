import assert from 'node:assert/strict';
// Independent read channels and parsers; all metadata writes keep the main
// serialized connection. Drain issued audits before exposing any failure.
export async function auditTasks(items,{contexts,audit}){
 assert(Array.isArray(items)&&Array.isArray(contexts)&&contexts.length>0&&contexts.length<=8&&typeof audit==='function','SG_ADMISSION_AUDIT_BOUND');
 let cursor=0,failure;
 const results=await Promise.allSettled(contexts.map(async context=>{
  while(!failure&&cursor<items.length){const item=items[cursor++];
   try{await audit(item,context);}catch(error){failure??=error;throw error;}
  }
 }));
 if(failure)throw failure;
 assert(results.every(r=>r.status==='fulfilled'),'SG_ADMISSION_AUDIT_FAILED');
}
export function readOnlyAuditTransport(transport){
 return {request(op,fields){assert(['read','read_many','scan'].includes(op),'SG_ADMISSION_READ_ONLY');return transport.request(op,fields);},
  close:()=>transport.close(),metrics:()=>transport.metrics?.()};
}
export function preparingGuard({store,boundary,run,queueId,activation,commit,now=Date.now}){
 let boundaryAt=now(),boundaryPending,ownerAt=-Infinity,ownerPending;
 return async()=>{
  await store.writable();
  if(boundaryPending)await boundaryPending;
  else if(now()-boundaryAt>=15000){const p=boundary().then(()=>{boundaryAt=now();});boundaryPending=p;
   try{await p;}finally{if(boundaryPending===p)boundaryPending=null;}}
  if(ownerPending)await ownerPending;
  else if(now()-ownerAt>=1000){const p=(async()=>{
   const value=(await store.get('state','rolling-source'))?.value;
   assert(value?.owner===run&&value.queueId===queueId&&value.status==='preparing'
    &&value.activation===activation&&value.commit===commit,'SG_QUEUE_OWNERSHIP');ownerAt=now();})();ownerPending=p;
   try{await p;}finally{if(ownerPending===p)ownerPending=null;}}
  assert(now()-ownerAt<=1000,'SG_QUEUE_OWNER_READ_STALE');
 };
}
