import test from 'node:test';import assert from 'node:assert/strict';
import {directCaptureJobs,extractDirectJobFinal,loadDirectCaptureLogs,reviewDirectSourceResource} from './action-direct-resource.mjs';
import {ResourceWindows} from './resource-windows.mjs';import {HostResourceObservation} from './host-resource-observation.mjs';

function fixture(){
 const commit='a'.repeat(40),source={id:123,run_attempt:1,head_sha:commit,event:'workflow_dispatch',status:'in_progress',
  path:'.github/workflows/trial-300k.yml',repository:{full_name:'287113535qq-cmyk/sg-capture-runner'}};
 const jobs={total_count:20,jobs:Array.from({length:20},(_,i)=>({id:1000+i,name:'capture-'+i,status:'completed',conclusion:'success'}))};
 let sampledAt=0;const windows=new ResourceWindows(),host=new HostResourceObservation({now:()=>sampledAt});
 for(let at=0;at<=660000;at+=10000){
  sampledAt=at;
  host.observe({sampledAtMs:at,bootId:'h',cpuTicks:[at/10000*20,0,0,at/10000*80,0,0,0,0],memTotalKiB:100,memAvailableKiB:60});
  if(at)windows.observe({startMs:at-10000,endMs:at,cpuPercent:20,memoryPercent:40,diskFreeBytes:60*1024**3,allowed:true});
 }
 const rows=Array.from({length:20},(_,i)=>({schema:'sg-capture-performance-v1',reason:'final',shardId:20+i,gameId:32721,
  sourceErrors:0,sourceRequests:100,completedThisRun:100,rpcMetrics:{resourceObservation:{schema:'sg-resource-observation-v1',
   firstReadyAtMs:1,windows:windows.diagnostics()},hostResourceObservation:host.diagnostics()}}));
 return {commit,source,jobs,rows};
}
test('successful completed job logs can be read while parent is running; ordered private log manifest binds all twenty jobs',async()=>{
 const f=fixture();let inflight=0,peak=0;const saved=[];
 const args={...f,download:async id=>{inflight++;peak=Math.max(peak,inflight);await new Promise(r=>setTimeout(r,1));
  inflight--;return Buffer.from('2026-10-02T00:00:00Z '+JSON.stringify(f.rows[id-1000]));},save:async(id,bytes)=>saved.push({id,bytes:bytes.length})};
 const result=await loadDirectCaptureLogs(args);assert.equal(peak,4);assert.equal(saved.length,20);
 assert.deepEqual(result.rows.map(r=>r.shardId),Array.from({length:20},(_,i)=>i+20));
 const review=reviewDirectSourceResource({run:'123:1',commit:f.commit,...result,completeDelta:2000});
 assert.equal(review.workers,20);assert.equal(review.endMs-review.startMs,600000);assert.equal(review.verified,true);
 assert.throws(()=>reviewDirectSourceResource({run:'123:1',commit:f.commit,...result,completeDelta:1999}),/FINAL_COUNTS/);
});
test('missing/failed/duplicate captures and missing/duplicate final rows refuse evidence before relay',async()=>{
 const f=fixture();for(const change of ['failed','missing','duplicate']){
  const jobs=structuredClone(f.jobs);if(change==='failed')jobs.jobs[0].conclusion='failure';
  if(change==='missing'){jobs.jobs.pop();jobs.total_count--;}
  if(change==='duplicate')jobs.jobs[1].id=jobs.jobs[0].id;
  assert.throws(()=>directCaptureJobs({...f,jobs}));
 }
 const row=JSON.stringify(f.rows[0]);assert.throws(()=>extractDirectJobFinal('',20));
 assert.throws(()=>extractDirectJobFinal(row+'\n'+row,20));assert.throws(()=>extractDirectJobFinal(row,21));
 let reads=0;await assert.rejects(loadDirectCaptureLogs({...f,jobs:{total_count:0,jobs:[]},download:async()=>{reads++;}}));assert.equal(reads,0);
});
test('missing common ten-minute coverage and unhealthy host telemetry cannot authorize tail',()=>{
 const f=fixture(),args={run:'123:1',commit:f.commit,rows:f.rows,logSha256:'b'.repeat(64),completeDelta:2000};
 f.rows[0].rpcMetrics.resourceObservation.windows.buckets.splice(3,1);assert.throws(()=>reviewDirectSourceResource(args),/MISSING/);
 const g=fixture();g.rows[0].rpcMetrics.hostResourceObservation.buckets[3].peakMemoryPercent=95;
 assert.throws(()=>reviewDirectSourceResource({...args,rows:g.rows}));
});
