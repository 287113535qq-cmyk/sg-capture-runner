import assert from 'node:assert/strict';
import {reviewHostResourceWindow} from './host-resource-observation.mjs';

// Bounded numeric telemetry. A bucket proves coverage, not permission to write.
// AG canary comparison needs the measured interval, rather than startup peaks.
export class ResourceWindows {
  constructor(){this.buckets=new Map();this.limit=360;}
  bucket(at){
    const startMs=Math.floor(at/60000)*60000;
    if(!this.buckets.has(startMs))this.buckets.set(startMs,{startMs,endMs:startMs+60000,
      coveredMs:0,samples:0,blocked:false,peakCpuPercent:0,peakMemoryPercent:0,minDiskFreeBytes:null});
    while(this.buckets.size>this.limit)this.buckets.delete(this.buckets.keys().next().value);
    return this.buckets.get(startMs);
  }
  block(at){if(Number.isFinite(at))this.bucket(at).blocked=true;}
  observe({startMs,endMs,cpuPercent,memoryPercent,diskFreeBytes,allowed}){
    assert(endMs>startMs&&endMs-startMs<=30000,'RESOURCE_WINDOW_INTERVAL');
    for(let at=startMs;at<endMs;){
      const b=this.bucket(at),stop=Math.min(endMs,b.endMs);
      b.coveredMs+=stop-at;b.samples++;b.blocked||=!allowed;
      b.peakCpuPercent=Math.max(b.peakCpuPercent,cpuPercent);
      b.peakMemoryPercent=Math.max(b.peakMemoryPercent,memoryPercent);
      b.minDiskFreeBytes=Math.min(b.minDiskFreeBytes??diskFreeBytes,diskFreeBytes);
      at=stop;
    }
  }
  diagnostics(){return {schema:'sg-resource-windows-v1',bucketMs:60000,
    maxBuckets:this.limit,buckets:structuredClone([...this.buckets.values()])};}
}

export function reviewResourceWindow(report,startMs,endMs){
  assert(report?.schema==='sg-resource-windows-v1'&&report.bucketMs===60000
    &&report.maxBuckets===360&&Array.isArray(report.buckets)&&report.buckets.length<=360
    &&Number.isSafeInteger(startMs)&&Number.isSafeInteger(endMs)
    &&startMs%60000===0&&endMs%60000===0&&endMs-startMs>=600000,'RESOURCE_WINDOW_SCOPE');
  const seen=new Set();
  for(const b of report.buckets){
    assert(Number.isSafeInteger(b.startMs)&&b.startMs%60000===0&&b.endMs===b.startMs+60000
      &&!seen.has(b.startMs),'RESOURCE_WINDOW_DUPLICATE');seen.add(b.startMs);
  }
  const selected=report.buckets.filter(b=>b.startMs>=startMs&&b.endMs<=endMs);
  assert(selected.length===(endMs-startMs)/60000,'RESOURCE_WINDOW_MISSING');
  for(const b of selected)assert(b.coveredMs===60000&&Number.isSafeInteger(b.samples)&&b.samples>=2
    &&b.blocked===false&&[b.peakCpuPercent,b.peakMemoryPercent].every(v=>Number.isFinite(v)&&v>=0&&v<95)
    &&Number.isSafeInteger(b.minDiskFreeBytes)&&b.minDiskFreeBytes>=30*1024**3,'RESOURCE_WINDOW_UNSAFE');
  return {schema:'sg-resource-window-review-v1',startMs,endMs,buckets:selected.length,
    peakCpuPercent:Math.max(...selected.map(b=>b.peakCpuPercent)),
    peakMemoryPercent:Math.max(...selected.map(b=>b.peakMemoryPercent)),
    minDiskFreeBytes:Math.min(...selected.map(b=>b.minDiskFreeBytes)),
    resourceEvidenceComplete:true,resourceHolds:0,sourceRequests:0,databaseWrites:0};
}

// Call after authenticating the source/jobs and hashing the full saved log.
// Require every admitted lane; a healthy subset cannot stand in for the pool.
export function reviewResourceWorkers({run,commit,logSha256,expectedSlots,workers,startMs,endMs}){
  // Actual session ids reserve forty positions per lane: primary host 0..19,
  // secondary host 20..39. A contiguous forty-id set mixes two owners and
  // cannot prove the primary's two-lane pool. Four lanes reach ids 120..159.
  const lanes=expectedSlots?.length/20,offset=Math.min(...(expectedSlots??[]));
  const layout=[1,2,4].includes(lanes)&&[0,20].includes(offset)?
    Array.from({length:lanes*20},(_,i)=>offset+i%20+Math.floor(i/20)*40):[];
  assert(/^\d+:1$/.test(run??'')&&/^[a-f0-9]{40}$/.test(commit??'')
    &&/^[a-f0-9]{64}$/.test(logSha256??'')&&Array.isArray(expectedSlots)
    &&[20,40,80].includes(expectedSlots.length)&&new Set(expectedSlots).size===expectedSlots.length
    &&layout.length===expectedSlots.length&&expectedSlots.every(v=>Number.isSafeInteger(v)&&layout.includes(v))
    &&Array.isArray(workers)&&workers.length===expectedSlots.length,'RESOURCE_WORKERS_SCOPE');
  const seen=new Set(),reviews=[],hostReviews=[];
  for(const w of workers){
    assert(expectedSlots.includes(w.slot)&&!seen.has(w.slot)&&w.run===run&&w.commit===commit
      &&w.sourceErrors===0&&w.unknown===0&&w.diagnostics?.schema==='sg-resource-observation-v1',
    'RESOURCE_WORKER_EVIDENCE');
    seen.add(w.slot);reviews.push(reviewResourceWindow(w.diagnostics.windows,startMs,endMs));
    hostReviews.push(reviewHostResourceWindow(w.hostDiagnostics,startMs,endMs));
  }
  return {schema:'sg-resource-workers-review-v1',run,commit,logSha256,startMs,endMs,
    workers:reviews.length,verified:true,sourceErrors:0,unknown:0,resourceHolds:0,
    resourceEvidenceComplete:true,peakCpuPercent:Math.max(...reviews.map(r=>r.peakCpuPercent)),
    peakMemoryPercent:Math.max(...reviews.map(r=>r.peakMemoryPercent)),
    minDiskFreeBytes:Math.min(...reviews.map(r=>r.minDiskFreeBytes)),backendEvidenceComplete:true,hostEvidenceComplete:true,
    hostPeakCpuPercent:Math.max(...hostReviews.map(r=>r.peakCpuPercent)),
    hostPeakMemoryPercent:Math.max(...hostReviews.map(r=>r.peakMemoryPercent)),sourceRequests:0,databaseWrites:0};
}
