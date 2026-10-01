import test from 'node:test';import assert from 'node:assert/strict';
import {reviewCanaryFinalLogs} from './session-canary-log.mjs';
import {canarySourceActivity,canarySlots} from './session-canary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ResourceGate} from './resource-gate.mjs';import {HostResourceObservation} from './host-resource-observation.mjs';
function fixture(){
 const schedule={schema:'sg-session-canary-schedule-v1',run:'100:1',commit:'a'.repeat(40),activation:'b'.repeat(64),profileHash:'c'.repeat(64),
  revisionHash:'d'.repeat(64),sourcePermitHash:'e'.repeat(64),anchorMs:60000,
  baseline:{startMs:420000,endMs:1020000,activeSlots:canarySlots.slice(0,20)},
  candidate:{startMs:1140000,endMs:1740000,activeSlots:[...canarySlots]},secondLaneStartMs:1020000,endMs:1980000};
 let at=0;const gate=new ResourceGate({now:()=>at}),host=new HostResourceObservation({now:()=>at});
 for(let i=0;i<=190;i++){at=i*10000;const s={sampledAtMs:at,bootId:'private',cpuTicks:[i*20,0,0,i*80,0,0,0,0],memTotalKiB:100,memAvailableKiB:60,diskFreeBytes:50*1024**3};gate.observe(s);host.observe(s);}
 const rows=canarySlots.map(slot=>{
  const a=canarySourceActivity(schedule,slot);if(slot<40)a.record(schedule.baseline.startMs);a.record(schedule.candidate.startMs);
  return {schema:'sg-capture-performance-v1',reason:'final',gameId:32799,shardId:slot,sourceErrors:0,sourceRequests:slot<40?2:1,
   canarySourceActivity:a.diagnostics(),rpcMetrics:{resourceObservation:gate.diagnostics(),hostResourceObservation:host.diagnostics()}};
 });
 const window=(key,complete)=>({...schedule[key],complete,stableIntervalCandidate:true,missing:0,invalid:0,
  histograms:{'Logic.totalMs':{count:100,buckets:[0,0,0,100,0,0,0,0,0,0,0,0,0,0,0,0]}}});
 const report={fullReadback:true,recordsHash:'f'.repeat(64),sourceRun:schedule.run,sourceCommit:schedule.commit,
  activation:schedule.activation,profileHash:schedule.profileHash,sourcePermitHash:schedule.sourcePermitHash,
  timing:{schema:'sg-session-canary-timing-v1',scheduleHash:hash(schedule),baseline:window('baseline',100),candidate:window('candidate',180)}};
 return {schedule,rows,report,logSha256:'0'.repeat(64)};
}
test('final source log yields an immutable proof accepted by the existing four-lane comparison schema',()=>{
 const r=reviewCanaryFinalLogs(fixture());assert.equal(r.comparison.schema,'sg-session-comparison-v1');
 assert.equal(r.comparison.mode,'same-run-canary-v1');assert.equal(r.baselineSafety.workers,40);
 assert.equal(r.candidateSafety.hostEvidenceComplete,true);assert.equal(r.comparison.sourceRequests,0);
});
for(const kind of ['missing-worker','duplicate-worker','wrong-game','not-final','requests-unbound','errors','early-source','missing-history','missing-host','history-gap','readback-missing'])
 test('reject canary final source log '+kind,()=>{const f=fixture(),row=f.rows[20];
  if(kind==='missing-worker')f.rows.pop();if(kind==='duplicate-worker')row.shardId=0;if(kind==='wrong-game')row.gameId=32795;
  if(kind==='not-final')row.reason='interval';if(kind==='requests-unbound')row.sourceRequests=2;if(kind==='errors')row.sourceErrors=1;
  if(kind==='early-source')row.canarySourceActivity.earlySource=1;if(kind==='missing-history')delete row.rpcMetrics.resourceObservation.windows;
  if(kind==='missing-host')delete row.rpcMetrics.hostResourceObservation;if(kind==='history-gap')row.rpcMetrics.hostResourceObservation.buckets[10].coveredMs=50000;
  if(kind==='readback-missing')f.report.fullReadback=false;assert.throws(()=>reviewCanaryFinalLogs(f));});
