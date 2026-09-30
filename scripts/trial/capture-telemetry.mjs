// Observation only: never retries, changes a request, or decides capture eligibility.
const bounds=[1,5,10,25,50,100,250,500,1000,2000,4000,8000,16000,30000,60000];
const messages=new Set(['INIT','REELSTRIP','BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END','Init','Logic','EndGame']);
const operations=new Set(['status','audit','register','next','claim','begin','intent','exchange','exchange_journal','bootstrap_intent','bootstrap_frame','release','finish_run','fail','ping','yield_protocol_stop']);
const histogram=()=>({count:0,totalMs:0,maxMs:0,buckets:Array(bounds.length+1).fill(0)});
function add(map,key,ms){
 if(!Number.isFinite(ms)||ms<0)return;
 const h=map[key]??=histogram();h.count++;h.totalMs+=ms;h.maxMs=Math.max(h.maxMs,ms);
 const index=bounds.findIndex(b=>ms<=b);h.buckets[index<0?bounds.length:index]++;
}
const rounded=v=>Math.round(v*1000)/1000;
function summarize(map){
 return Object.fromEntries(Object.entries(map).map(([key,h])=>[key,{
  count:h.count,totalMs:rounded(h.totalMs),meanMs:rounded(h.totalMs/h.count),maxMs:rounded(h.maxMs),
  bucketCounts:[...h.buckets]}]));
}
export function businessOutcome(result,error){
 if(result?.status==='halted'&&result.reason==='PROTOCOL_VALIDATION_FAILED')return 'parked-protocol';
 if(result?.status==='complete'&&!error)return 'complete';
 if(error?.category==='source_http'||error?.category==='source_network')return 'source-paused';
 if(result?.status==='halted'||error)return 'requires-review';
 return 'incomplete';
}
export function createCaptureTelemetry({gameId,shardId,evidence,emit=()=>{},now=()=>performance.now(),
 resource=()=>({cpu:process.cpuUsage(),rssBytes:process.memoryUsage().rss}),metrics=()=>({}),intervalMs=60000}={}){
 const start=now();let windowStart=start,lastRounds=0,timer=null,closed=false;
 const cumulative={},window={};let errors=0;
 const safe=fn=>{try{return fn();}catch{return undefined;}};
 const observe=(key,ms)=>safe(()=>{add(cumulative,key,ms);add(window,key,ms);});
 const resourceStart=safe(resource);
 const snapshot=()=>{
  const current=now(),r=safe(resource),cpu=r?.cpu&&resourceStart?.cpu;
  return {schema:'sg-capture-performance-v1',gameId:Number.isSafeInteger(gameId)?gameId:null,
   shardId:Number.isSafeInteger(shardId)?shardId:null,elapsedMs:rounded(current-start),windowMs:rounded(current-windowStart),
   completedThisRun:evidence.completedThisRun,windowComplete:evidence.completedThisRun-lastRounds,
   roundsPerMinute:current>windowStart?rounded((evidence.completedThisRun-lastRounds)*60000/(current-windowStart)):0,
   sourceRequests:evidence.sourceRequests,sourceErrors:errors,bucketUpperBoundsMs:[...bounds,null],
   totals:summarize(cumulative),window:summarize(window),
   ...(cpu?{nodeCpuMs:rounded((r.cpu.user+r.cpu.system-resourceStart.cpu.user-resourceStart.cpu.system)/1000)}:{}),
   ...(Number.isFinite(r?.rssBytes)?{rssBytes:r.rssBytes}:{})};
 };
 function report(reason){
  safe(()=>{const v=snapshot();emit({...v,reason,rpcMetrics:metrics()});
   windowStart=now();lastRounds=evidence.completedThisRun;for(const key of Object.keys(window))delete window[key];});
 }
 return {
  start(){if(!timer&&!closed){timer=setInterval(()=>report('interval'),intervalMs);timer.unref?.();}},
  progress(){if(evidence.completedThisRun-lastRounds>=100)report('rounds');},
  stop(){if(timer)clearInterval(timer);timer=null;if(!closed){closed=true;report('final');}},
  snapshot,observe,
  sync(key,fn){return (...args)=>{const at=now();try{return fn(...args);}finally{observe(key==='normalize'?'normalize':'local',now()-at);}};},
  async rpc(call,op,data){const at=now();try{return await call(op,data);}finally{observe('rpc.'+(operations.has(op)?op:'other'),now()-at);}},
  async fetch(call,message,...args){
   const name=messages.has(message)?message:'other',at=now();let response;
   try{response=await call(...args);}catch(error){errors++;observe('source.'+name+'.headersError',now()-at);throw error;}
   observe('source.'+name+'.headers',now()-at);
   if(!response.ok){errors++;observe('source.'+name+'.httpRejected',now()-at);}
   return new Proxy(response,{get(target,key){
    if(key==='text')return async()=>{const bodyAt=now();try{return await target.text();}
     catch(error){errors++;observe('source.'+name+'.bodyError',now()-bodyAt);throw error;}
     finally{observe('source.'+name+'.body',now()-bodyAt);observe('source.'+name+'.total',now()-at);}};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }});
  }
 };
}
