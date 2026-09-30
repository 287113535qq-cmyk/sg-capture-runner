// All thresholds and decisions run on the GitHub Runner. The test server only
// supplies OS counters; no game, scheduling, journal, or checkpoint logic.
export const resourcePolicy = Object.freeze({pausePercent:95, resumePercent:90,
  resumeStableMs:60_000, sampleEveryMs:10_000, maxAgeMs:30_000});

export class ResourceGate {
  constructor({now=Date.now}={}) {
    this.now=now; this.previous=null; this.latest=null;
    this.paused=true; this.reason='RESOURCE_SAMPLE_REQUIRED';
    this.lowSince=null; this.resumedAt=null; this.holds=new Set();this.history=[];
  }
  hold(reason) { this.holds.add(reason); }
  releaseHold(reason) { this.holds.delete(reason); }
  pause(reason) {
    this.paused=true; this.reason=reason; this.lowSince=null; this.resumedAt=null;
  }
  observe(sample) {
    // Only a new observation can release the handoff hold; invalid samples
    // still pause through the ordinary validation below. Other holds remain.
    this.holds.delete('RESOURCE_HANDOFF_FRESH_REQUIRED');
    const now=this.now(), valid=sample && Number.isFinite(sample.sampledAtMs)
      && sample.sampledAtMs<=now+5000 && now-sample.sampledAtMs<=resourcePolicy.maxAgeMs
      && typeof sample.bootId==='string' && sample.bootId.length>0
      && Array.isArray(sample.cpuTicks) && sample.cpuTicks.length===8
      && sample.cpuTicks.every(n=>Number.isSafeInteger(n) && n>=0)
      && Number.isSafeInteger(sample.memTotalKiB) && sample.memTotalKiB>0
      && Number.isSafeInteger(sample.memAvailableKiB) && sample.memAvailableKiB>=0
      && sample.memAvailableKiB<=sample.memTotalKiB
      && Number.isSafeInteger(sample.diskFreeBytes) && sample.diskFreeBytes>=0;
    if (!valid) {
      this.history=[];
      this.previous=null; this.latest=null; this.pause('RESOURCE_SAMPLE_INVALID'); return this.status();
    }
    const previous=this.previous;
    if (previous && sample.sampledAtMs<=previous.sampledAtMs) {
      this.history=[];
      this.pause('RESOURCE_SAMPLE_NOT_ADVANCING'); this.previous=null; this.latest=null;
      return this.status();
    }
    if (!previous || previous.bootId!==sample.bootId
        || sample.sampledAtMs-previous.sampledAtMs>resourcePolicy.maxAgeMs) {
      this.history=[structuredClone(sample)];
      this.previous=sample; this.latest=null; this.pause('RESOURCE_BASELINE_REQUIRED'); return this.status();
    }
    const delta=sample.cpuTicks.map((x,i)=>x-previous.cpuTicks[i]);
    this.previous=sample;
    const total=delta.reduce((a,b)=>a+b,0);
    if (delta.some(x=>x<0) || !Number.isSafeInteger(total) || total<=0) {
      this.history=[];
      this.latest=null; this.pause('RESOURCE_COUNTER_INVALID'); return this.status();
    }
    const cpu=100*(total-delta[3]-delta[4])/total;
    this.history.push(structuredClone(sample));this.history=this.history.slice(-16);
    const memory=100*(sample.memTotalKiB-sample.memAvailableKiB)/sample.memTotalKiB;
    this.latest={sampledAtMs:sample.sampledAtMs,cpuPercent:cpu,memoryPercent:memory,
      diskFreeBytes:sample.diskFreeBytes};
    if (cpu>=resourcePolicy.pausePercent || memory>=resourcePolicy.pausePercent) {
      this.pause('RESOURCE_OVERLOAD');
    } else if (this.paused) {
      if (cpu<resourcePolicy.resumePercent && memory<resourcePolicy.resumePercent) {
        this.lowSince ??= sample.sampledAtMs;
        if (sample.sampledAtMs-this.lowSince>=resourcePolicy.resumeStableMs) {
          this.paused=false; this.reason=null; this.resumedAt=now;
        }
      } else this.lowSince=null;
    }
    return this.status();
  }
  status() {
    const now=this.now();
    if (this.latest && (now-this.latest.sampledAtMs>resourcePolicy.maxAgeMs
        || this.latest.sampledAtMs>now+5000)) this.pause('RESOURCE_SAMPLE_STALE');
    const allowed=!this.paused && this.holds.size===0;
    const elapsed=this.resumedAt===null?0:Math.max(0,now-this.resumedAt);
    return {allowed,reason:this.holds.size?[...this.holds][0]:this.reason,
      maxBatchSize:allowed?(elapsed<30_000?10:elapsed<60_000?25:100):0,
      metrics:this.latest};
  }
}
