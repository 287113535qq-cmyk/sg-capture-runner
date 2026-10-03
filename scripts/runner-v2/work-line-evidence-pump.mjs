// GET-only artifact reads must not delay already prepared local handoffs.
// At most one bounded read is active; business delivery retains its own
// immutable-file checks. This pump has no dispatch or source authority.
export function workLineEvidencePump({read,log,now=Date.now,intervalMs=60000}){
 let inFlight=null,nextRead=0;
 return {tick(){
  if(inFlight)return inFlight;
  if(now()<nextRead)return Promise.resolve();
  inFlight=Promise.resolve().then(read).then(r=>{
   if(r.delivered||r.errors?.length)log({at:now(),...r});
  }).catch(error=>log({at:now(),status:'evidence-read-requires-review',
   reason:error.code||error.message?.split('\n')[0],sourceRequests:0}))
   .finally(()=>{nextRead=now()+intervalMs;inFlight=null;});
  return inFlight;
 }};
}
