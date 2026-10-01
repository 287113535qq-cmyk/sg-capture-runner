import test from 'node:test';import assert from 'node:assert/strict';
import {HostResourceObservation,reviewHostResourceWindow,readHostResourceSample} from './host-resource-observation.mjs';
function observed(){let now=0;const h=new HostResourceObservation({now:()=>now});
 for(let i=0;i<=66;i++){now=i*10000;h.observe({sampledAtMs:now,bootId:'host',cpuTicks:[i*20,0,0,i*80,0,0,0,0],memTotalKiB:100,memAvailableKiB:60});}return h;
}
test('worker host yields complete later minutes independently of backend counters',()=>{
 const d=observed().diagnostics(),r=reviewHostResourceWindow(d,60000,660000);
 assert.equal(r.peakCpuPercent,20);assert.equal(r.peakMemoryPercent,40);assert.equal(r.diskMeasured,false);
 assert.throws(()=>reviewHostResourceWindow(d,0,600000),/UNSAFE/);
});
for(const bad of ['missing','overlap','cpu','memory','duplicate','backend-scope'])test('host rejects '+bad,()=>{
 const d=observed().diagnostics(),b=d.buckets[3];
 if(bad==='missing')d.buckets.splice(3,1);if(bad==='overlap')b.coveredMs=70000;
 if(bad==='cpu')b.peakCpuPercent=95;if(bad==='memory')b.peakMemoryPercent=95;
 if(bad==='duplicate')d.buckets.push({...b});if(bad==='backend-scope')d.scope='backend';
 assert.throws(()=>reviewHostResourceWindow(d,60000,660000));
});
for(const bad of ['gap','reboot','counter-reset','future','bad-memory','read-failure'])test('host sampling preserves unavailable evidence '+bad,()=>{
 let now=60000;const h=new HostResourceObservation({now:()=>now,sample:()=>{throw Error('READ_FAILED');}});
 const s={sampledAtMs:now,bootId:'host',cpuTicks:[20,0,0,80,0,0,0,0],memTotalKiB:100,memAvailableKiB:60};h.observe(s);now+=10000;
 const next={...s,sampledAtMs:now,cpuTicks:[40,0,0,160,0,0,0,0]};
 if(bad==='gap'){now+=30000;next.sampledAtMs=now;}if(bad==='reboot')next.bootId='other';
 if(bad==='counter-reset')next.cpuTicks=[10,0,0,160,0,0,0,0];if(bad==='future')next.sampledAtMs=now+6000;
 if(bad==='bad-memory')next.memAvailableKiB=101;
 if(bad==='read-failure')h.tick();else h.observe(next);
 assert(h.diagnostics().buckets.some(b=>b.blocked));assert.throws(()=>reviewHostResourceWindow(h.diagnostics(),60000,660000));
});
test('host report retains only bounded numeric summaries, not raw host identity',()=>{
 const h=observed();for(let i=0;i<400;i++)h.bucket(i*60000);const d=h.diagnostics();assert.equal(d.buckets.length,360);
 d.buckets[0].blocked=true;assert.equal(h.diagnostics().buckets[0].blocked,false);
 assert.equal(JSON.stringify(d).includes('bootId'),false);
});
test('actual local OS reader reports CPU ticks and available memory without disk substitution',()=>{
 const s=readHostResourceSample(12345);assert.equal(s.sampledAtMs,12345);assert.equal(s.cpuTicks.length,8);
 assert(s.cpuTicks.every(v=>Number.isSafeInteger(v)&&v>=0));assert(s.memTotalKiB>0&&s.memAvailableKiB>=0&&s.memAvailableKiB<=s.memTotalKiB);
 assert.equal(Object.hasOwn(s,'diskFreeBytes'),false);
});
