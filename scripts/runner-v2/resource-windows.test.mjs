import test from 'node:test';import assert from 'node:assert/strict';
import {ResourceWindows,reviewResourceWindow,reviewResourceWorkers} from './resource-windows.mjs';
import {ResourceGate} from './resource-gate.mjs';
function sample(){const w=new ResourceWindows();for(let endMs=10000;endMs<=660000;endMs+=10000)
  w.observe({startMs:endMs-10000,endMs,cpuPercent:20,memoryPercent:40,diskFreeBytes:60*1024**3,allowed:endMs>60000});return w;}
test('startup pause does not contaminate a later fully covered stable ten minutes',()=>{
 const w=sample(),r=reviewResourceWindow(w.diagnostics(),60000,660000);
 assert.equal(r.resourceEvidenceComplete,true);assert.equal(r.peakCpuPercent,20);
 assert.throws(()=>reviewResourceWindow(w.diagnostics(),0,600000),/UNSAFE/);
});
for(const kind of ['missing','gap','duplicate','cpu','memory','disk','hold'])test('reject incomplete or unsafe '+kind,()=>{
 const d=sample().diagnostics();let b=d.buckets[3];
 if(kind==='missing')d.buckets.splice(3,1);if(kind==='gap')b.coveredMs=50000;
 if(kind==='duplicate')d.buckets.push({...b});if(kind==='cpu')b.peakCpuPercent=95;
 if(kind==='memory')b.peakMemoryPercent=95;if(kind==='disk')b.minDiskFreeBytes=29*1024**3;
 if(kind==='hold')b.blocked=true;assert.throws(()=>reviewResourceWindow(d,60000,660000));
});
test('mid-minute operator hold remains visible after release and sampling',()=>{
 const w=sample();w.block(180001);assert.throws(()=>reviewResourceWindow(w.diagnostics(),60000,660000),/UNSAFE/);
});
test('telemetry is bounded and detached from returned diagnostics',()=>{
 const w=new ResourceWindows();for(let i=0;i<400;i++)w.block(i*60000);
 const d=w.diagnostics();assert.equal(d.buckets.length,360);d.buckets[0].blocked=false;
 assert.equal(w.diagnostics().buckets[0].blocked,true);
 assert.throws(()=>reviewResourceWindow(d,0,600000),/MISSING/);
});
test('actual resource gate records covered intervals without weakening stale checks',()=>{
 let now=0,user=0,idle=0;const g=new ResourceGate({now:()=>now});
 for(let i=0;i<80;i++){now+=10000;user+=20;idle+=80;g.observe({sampledAtMs:now,bootId:'a',
  cpuTicks:[user,0,0,idle,0,0,0,0],memTotalKiB:100,memAvailableKiB:60,diskFreeBytes:60*1024**3});}
 assert.equal(reviewResourceWindow(g.diagnostics().windows,120000,720000).resourceEvidenceComplete,true);
 now+=30001;assert.equal(g.status().allowed,false);
 assert.equal(g.diagnostics().windows.buckets.at(-1).blocked,true);
});
function workers(){return {run:'100:1',commit:'a'.repeat(40),logSha256:'b'.repeat(64),
 expectedSlots:Array.from({length:40},(_,i)=>i),startMs:60000,endMs:660000,
 workers:Array.from({length:40},(_,slot)=>({slot,run:'100:1',commit:'a'.repeat(40),sourceErrors:0,unknown:0,
  diagnostics:{schema:'sg-resource-observation-v1',windows:sample().diagnostics()}}))};}
test('pool resource proof binds all forty lanes and the measured interval',()=>{
 const r=reviewResourceWorkers(workers());assert.equal(r.workers,40);assert.equal(r.sourceRequests,0);
});
for(const kind of ['missing-lane','duplicate-lane','foreign-run','foreign-commit','missing-errors','unknown','old-telemetry'])test('reject pool proof '+kind,()=>{
 const f=workers(),w=f.workers[3];if(kind==='missing-lane')f.workers.pop();
 if(kind==='duplicate-lane')w.slot=2;if(kind==='foreign-run')w.run='101:1';
 if(kind==='foreign-commit')w.commit='c'.repeat(40);if(kind==='missing-errors')delete w.sourceErrors;
 if(kind==='unknown')w.unknown=1;if(kind==='old-telemetry')delete w.diagnostics.windows;
 assert.throws(()=>reviewResourceWorkers(f));
});
