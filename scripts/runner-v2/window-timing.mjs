import assert from 'node:assert/strict';
const bounds=[1,5,10,25,50,100,250,500,1000,2000,4000,8000,16000,30000,60000];
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
// Streaming numeric summaries only: raw protocol remains in its existing store.
export function windowTiming(startMs,endMs){
 assert(finite(startMs)&&finite(endMs)&&endMs>startMs,'TIMING_WINDOW');
 const windows=[];for(let start=startMs;start<endMs;start+=600000)windows.push({startMs:start,endMs:Math.min(start+600000,endMs),complete:0,frames:0,missing:0,invalid:0,reused:0,missingConnection:0,firstFrameMs:null,lastFrameMs:null,histograms:{}});
 function record(row){
  const steps=row.raw?.steps??[],last=Date.parse(steps.at(-1)?.ts);
  const completed=windows.find(w=>last>=w.startMs&&last<w.endMs);if(completed)completed.complete++;
  for(const step of steps){
   const at=Date.parse(step.ts),w=windows.find(w=>at>=w.startMs&&at<w.endMs);if(!w)continue;
   w.frames++;w.firstFrameMs=w.firstFrameMs===null?at:Math.min(w.firstFrameMs,at);w.lastFrameMs=w.lastFrameMs===null?at:Math.max(w.lastFrameMs,at);
   const t=step.sourceTiming;if(!t){w.missing++;continue;}
   if(t.schema!=='sg-source-timing-v1'||!['headersMs','bodyMs','totalMs'].every(k=>finite(t[k]))||t.headersMs+t.bodyMs>t.totalMs+.01){w.invalid++;continue;}
   const c=t.connection;if(c?.schema==='sg-connection-observation-v1'&&c.correlated===true&&c.requestsObserved===1&&c.reusedSocket===true)w.reused++;else w.missingConnection++;
   // Histogram names use fixed protocol message names, never arbitrary payload text.
   const name=['Logic','EndGame','BET','FREE_GAME','FEATURE_START','FEATURE_PICK','FEATURE_END'].includes(step.msgId)?step.msgId:'other';
   for(const key of ['headersMs','bodyMs','totalMs']){
    const h=w.histograms[name+'.'+key]??= {count:0,totalMs:0,maxMs:0,buckets:Array(bounds.length+1).fill(0)};
    h.count++;h.totalMs+=t[key];h.maxMs=Math.max(h.maxMs,t[key]);h.buckets[bounds.findIndex(b=>t[key]<=b)<0?bounds.length:bounds.findIndex(b=>t[key]<=b)]++;
   }
  }
 }
 function finish(){
  for(const w of windows){w.completePerMinute=w.complete*60000/(w.endMs-w.startMs);w.observedSpanMs=w.firstFrameMs===null?0:w.lastFrameMs-w.firstFrameMs;
   w.fullTenMinuteInterval=w.endMs-w.startMs===600000;
   // Startup and incomplete intervals must not be labeled stable.
   w.stableIntervalCandidate=w.fullTenMinuteInterval&&w.observedSpanMs>=590000&&w.missing===0&&w.invalid===0;
   for(const h of Object.values(w.histograms)){h.meanMs=h.totalMs/h.count;for(const [key,q] of [['p50UpperMs',.5],['p95UpperMs',.95],['p99UpperMs',.99]]){let sum=0;h[key]=null;for(let i=0;i<h.buckets.length;i++){sum+=h.buckets[i];if(sum>=Math.ceil(h.count*q)){h[key]=bounds[i]??null;break;}}}}
  }
  return {schema:'sg-streaming-window-timing-v1',windows,bucketUpperBoundsMs:[...bounds,null],sourceRequests:0,databaseWrites:0,limitations:'Completed records only; excludes abandoned and in-flight frames. Histogram percentiles are upper bounds. Startup intervals are not steady-state proof.'};
 }
 return {record,finish};
}
