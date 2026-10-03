import assert from 'node:assert/strict';
// Eight AG loops share a bounded native I/O connection. The SSH protocol has
// one in-flight ACK, so serialize transport calls without serializing SG HTTP
// sessions or allocating against a shared per-round campaign ledger.
export function serializeTransport(transport,{maxQueued=256}={}){
 assert(Number.isSafeInteger(maxQueued)&&maxQueued>0,'SG_TRANSPORT_QUEUE_BOUND');
 let tail=Promise.resolve(),queued=0,poison=null,closed=false;
 const unknown=error=>['GATEWAY_ACK_UNKNOWN','GATEWAY_DISCONNECTED','GATEWAY_RESPONSE_INVALID','GATEWAY_RESPONSE_TOO_LARGE'].includes(error.code);
 return {
  request(op,fields={}){
   if(closed||poison)return Promise.reject(Object.assign(new Error(poison??'GATEWAY_CLOSED'),{code:poison??'GATEWAY_CLOSED'}));
   if(queued>=maxQueued)return Promise.reject(Object.assign(new Error('GATEWAY_QUEUE_FULL'),{code:'GATEWAY_QUEUE_FULL'}));
   const snapshot=structuredClone(fields);queued++;
   const next=tail.then(async()=>{
    if(poison||closed)throw Object.assign(new Error(poison??'GATEWAY_CLOSED'),{code:poison??'GATEWAY_CLOSED'});
    try{return await transport.request(op,snapshot);}catch(error){
     if(unknown(error)){poison='GATEWAY_ACK_UNKNOWN';transport.close();}
     throw error;
    }
   }).finally(()=>{queued--;});
   tail=next.catch(()=>{});return next;
  },metrics:()=>transport.metrics?.(),close(){closed=true;transport.close();},
  status:()=>({queued,closed,poison}),
 };
}
