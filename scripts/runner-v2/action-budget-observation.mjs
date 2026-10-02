// Keep read-only resource observation alive after a bounded worker finishes.
// This grants no requests or writes, and never fabricates missing samples.
export async function observeBudgetWindow({endMs,sample,shouldStop=()=>false,now=Date.now,
 sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 let samples=0,allAllowed=true;const startedAt=now();
 while(now()<endMs&&!shouldStop()){
  const result=await sample();samples++;allAllowed=allAllowed&&result.allowed===true;
  await sleep(Math.min(10000,Math.max(0,endMs-now())));
 }
 return {startedAt,endedAt:now(),requiredEndMs:endMs,samples,allAllowed,
  observationFinished:now()>=endMs&&!shouldStop(),sourceRequests:0,databaseWrites:0};
}
