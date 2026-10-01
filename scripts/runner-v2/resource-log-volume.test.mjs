import test from 'node:test';import assert from 'node:assert/strict';
import {ResourceGate} from './resource-gate.mjs';import {HostResourceObservation,reviewHostResourceWindow} from './host-resource-observation.mjs';
import {createCaptureTelemetry} from '../trial/capture-telemetry.mjs';
test('numeric histories remain complete at final while progress avoids repeated minute arrays',()=>{
 let now=0;const gate=new ResourceGate({now:()=>now}),host=new HostResourceObservation({now:()=>now});
 for(let i=0;i<=1080;i++){now=i*10000;const sample={sampledAtMs:now,bootId:'private',cpuTicks:[i*20,0,0,i*80,0,0,0,0],
  memTotalKiB:100,memAvailableKiB:60,diskFreeBytes:60*1024**3};gate.observe(sample);host.observe(sample);}
 const before=host.diagnostics(),full={backend:gate.diagnostics(),host:before};
 const compact={backend:gate.diagnostics({includeWindows:false}),host:host.diagnostics({includeWindows:false})};
 assert(!compact.host.buckets&&!compact.backend.windows);assert(compact.host.windowsOmitted);
 assert(JSON.stringify(compact).length<JSON.stringify(full).length/20);
 assert.deepEqual(host.diagnostics(),before);assert.throws(()=>reviewHostResourceWindow(compact.host,60000,660000));
 assert.equal(reviewHostResourceWindow(before,60000,660000).resourceEvidenceComplete,true);
 const rows=[],evidence={completedThisRun:0,sourceRequests:0},telemetry=createCaptureTelemetry({gameId:32799,shardId:0,evidence,
  emit:r=>rows.push(r),metrics:({final})=>final?full:compact});
 evidence.completedThisRun=100;telemetry.progress();telemetry.stop();telemetry.stop();
 assert.equal(rows.length,2);assert(!rows[0].rpcMetrics.host.buckets);assert.deepEqual(rows[1].rpcMetrics.host,before);
});
