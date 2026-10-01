import fs from 'node:fs';import os from 'node:os';import assert from 'node:assert/strict';

// AG canary observes the actual worker host as well as the storage backend.
// Numeric observation only: this cannot release any source/resource hold.
export function readHostResourceSample(now=Date.now()){
 if(process.platform==='linux'){
  const cpuTicks=fs.readFileSync('/proc/stat','utf8').split('\n')[0].trim().split(/\s+/).slice(1,9).map(Number);
  const text=fs.readFileSync('/proc/meminfo','utf8');
  const memory=k=>Number(text.match(new RegExp('^'+k+':\\s+(\\d+)\\s+kB$','m'))?.[1]);
  return {sampledAtMs:now,bootId:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),cpuTicks,
   memTotalKiB:memory('MemTotal'),memAvailableKiB:memory('MemAvailable')};
 }
 const times=os.cpus().reduce((p,c)=>{for(const k of Object.keys(p))p[k]+=c.times[k];return p;},{user:0,nice:0,sys:0,idle:0,irq:0});
 return {sampledAtMs:now,bootId:'process-host',cpuTicks:[times.user,times.nice,times.sys,times.idle,0,times.irq,0,0],
  memTotalKiB:Math.floor(os.totalmem()/1024),memAvailableKiB:Math.floor(os.freemem()/1024)};
}
export class HostResourceObservation{
 constructor({now=Date.now,sample=readHostResourceSample}={}){this.now=now;this.sample=sample;this.previous=null;this.buckets=new Map();this.timer=null;}
 bucket(at){const startMs=Math.floor(at/60000)*60000;
  if(!this.buckets.has(startMs))this.buckets.set(startMs,{startMs,endMs:startMs+60000,coveredMs:0,samples:0,blocked:false,peakCpuPercent:0,peakMemoryPercent:0});
  while(this.buckets.size>360)this.buckets.delete(this.buckets.keys().next().value);
  return this.buckets.get(startMs);
 }
 observe(s){const now=this.now(),p=this.previous;
  const valid=s&&Number.isSafeInteger(s.sampledAtMs)&&s.sampledAtMs<=now+5000&&now-s.sampledAtMs<=30000
   &&typeof s.bootId==='string'&&s.bootId.length>0&&Array.isArray(s.cpuTicks)&&s.cpuTicks.length===8
   &&s.cpuTicks.every(v=>Number.isSafeInteger(v)&&v>=0)&&Number.isSafeInteger(s.memTotalKiB)&&s.memTotalKiB>0
   &&Number.isSafeInteger(s.memAvailableKiB)&&s.memAvailableKiB>=0&&s.memAvailableKiB<=s.memTotalKiB;
  if(!valid){this.previous=null;this.bucket(now).blocked=true;return;}
  this.previous=structuredClone(s);
  if(!p||p.bootId!==s.bootId||s.sampledAtMs<=p.sampledAtMs||s.sampledAtMs-p.sampledAtMs>30000){this.bucket(now).blocked=true;return;}
  const delta=s.cpuTicks.map((v,i)=>v-p.cpuTicks[i]),total=delta.reduce((a,b)=>a+b,0);
  if(delta.some(v=>v<0)||!Number.isSafeInteger(total)||total<=0){this.bucket(now).blocked=true;return;}
  const cpu=100*(total-delta[3]-delta[4])/total,memory=100*(s.memTotalKiB-s.memAvailableKiB)/s.memTotalKiB;
  for(let at=p.sampledAtMs;at<s.sampledAtMs;){const b=this.bucket(at),stop=Math.min(s.sampledAtMs,b.endMs);
   b.coveredMs+=stop-at;b.samples++;b.blocked||=cpu>=95||memory>=95;
   b.peakCpuPercent=Math.max(b.peakCpuPercent,cpu);b.peakMemoryPercent=Math.max(b.peakMemoryPercent,memory);at=stop;
  }
 }
 tick(){try{this.observe(this.sample(this.now()));}catch{this.previous=null;this.bucket(this.now()).blocked=true;}}
 start(){if(!this.timer){this.tick();this.timer=setInterval(()=>this.tick(),10000);this.timer.unref?.();}}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
 diagnostics({includeWindows=true}={}){return {schema:'sg-host-resource-observation-v1',scope:'worker-host',bucketMs:60000,maxBuckets:360,
  ...(includeWindows?{buckets:structuredClone([...this.buckets.values()])}:{windowsOmitted:true,retainedMinuteBuckets:this.buckets.size}),diskMeasured:false,observationOnly:true};}
}
export function reviewHostResourceWindow(d,startMs,endMs){
 assert(d?.schema==='sg-host-resource-observation-v1'&&d.scope==='worker-host'&&d.diskMeasured===false&&d.observationOnly===true
  &&d.bucketMs===60000&&d.maxBuckets===360&&Array.isArray(d.buckets)&&d.buckets.length<=360
  &&Number.isSafeInteger(startMs)&&Number.isSafeInteger(endMs)&&startMs%60000===0&&endMs%60000===0&&endMs-startMs>=600000,'HOST_RESOURCE_SCOPE');
 const seen=new Set();for(const b of d.buckets){assert(Number.isSafeInteger(b.startMs)&&b.startMs%60000===0
  &&b.endMs===b.startMs+60000&&!seen.has(b.startMs),'HOST_RESOURCE_DUPLICATE');seen.add(b.startMs);}
 const selected=d.buckets.filter(b=>b.startMs>=startMs&&b.endMs<=endMs);
 assert(selected.length===(endMs-startMs)/60000,'HOST_RESOURCE_MISSING');
 for(const b of selected)assert(b.coveredMs===60000&&Number.isSafeInteger(b.samples)&&b.samples>=2&&b.blocked===false
  &&[b.peakCpuPercent,b.peakMemoryPercent].every(v=>Number.isFinite(v)&&v>=0&&v<95),'HOST_RESOURCE_UNSAFE');
 return {scope:'worker-host',startMs,endMs,resourceEvidenceComplete:true,peakCpuPercent:Math.max(...selected.map(b=>b.peakCpuPercent)),
  peakMemoryPercent:Math.max(...selected.map(b=>b.peakMemoryPercent)),diskMeasured:false,sourceRequests:0,databaseWrites:0};
}
