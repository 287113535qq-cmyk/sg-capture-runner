import test from 'node:test';import assert from 'node:assert/strict';
import {sessionCanarySchedule,canaryLanePhase,canaryWindowTiming,compareCanaryWindows,canarySlots,waitCanaryLane,canarySourceActivity,reviewCanaryActivity} from './session-canary.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function permission(){
 const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,sessionLayout:{lanesPerHost:2},activation:'a'.repeat(64),completePreserved:100};
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'session-canary-v1',profileHash:hash(profile),activation:profile.activation,
  captureMinutes:32,resourceObservation:'sg-resource-observation-v1',hostResourceObservation:'sg-host-resource-observation-v1',newBetAllowance:0,
  completePreserved:200,remainingComplete:299800};
 const commit='b'.repeat(40),run='100:1',receipt={schema:'sg-count-runtime-v2',commit,profileHash:hash(profile),activation:profile.activation,
  revisionHash:hash(revision),newBetAllowance:0,sourceRequests:0};
 const permit={schema:'sg-count-run-v1',commit,run,profileHash:hash(profile),activation:profile.activation,createdAt:1234,expiresAt:3000000};
 return {profile,revision,receipt,permit,commit,run};
}
test('one admission clock controls warmup, single lane, double lane and drain without quota',()=>{
 const s=sessionCanarySchedule(permission());assert.equal(s.anchorMs,60000);
 assert.equal(canaryLanePhase(s,0,70000),'capture');assert.equal(canaryLanePhase(s,40,70000),'observe');
 assert.equal(canaryLanePhase(s,40,s.secondLaneStartMs),'capture');assert.equal(canaryLanePhase(s,0,s.endMs),'drain');
 assert.equal(canaryLanePhase(s,40,s.secondLaneStartMs+5000),'capture');assert.equal(s.newBetAllowance,0);
});
for(const kind of ['permit-missing','wrong-run','wrong-commit','wrong-receipt','short-permit','quota','missing-host','wrong-layout','fractional-count'])
 test('reject canary permission '+kind,()=>{const f=permission();
  if(kind==='permit-missing')delete f.permit;if(kind==='wrong-run')f.permit.run='101:1';if(kind==='wrong-commit')f.commit='c'.repeat(40);
  if(kind==='wrong-receipt')f.receipt.revisionHash='c'.repeat(64);if(kind==='short-permit')f.permit.expiresAt=100000;
  if(kind==='quota')f.revision.newBetAllowance=100;if(kind==='missing-host')delete f.revision.hostResourceObservation;
  if(kind==='wrong-layout')f.profile.sessionLayout.lanesPerHost=4;if(kind==='fractional-count')f.revision.completePreserved=200.5;
  assert.throws(()=>sessionCanarySchedule(f));});
function fixture(){const schedule=sessionCanarySchedule(permission());
 const timing=canaryWindowTiming(schedule);
 for(const [i,key]of ['baseline','candidate'].entries())for(let n=0;n<(i+1)*120;n++){
  const phase=schedule[key],at=phase.startMs+n*599999/((i+1)*120-1);
  timing.record({raw:{steps:[{ts:new Date(Math.floor(at)).toISOString(),msgId:'Logic',sourceTiming:{schema:'sg-source-timing-v1',headersMs:10,bodyMs:2,totalMs:20}}]}});
 }
 const report={fullReadback:true,recordsHash:'d'.repeat(64),sourceRun:schedule.run,sourceCommit:schedule.commit,
  activation:schedule.activation,profileHash:schedule.profileHash,sourcePermitHash:schedule.sourcePermitHash,timing:timing.finish()};
 const safety=key=>({schema:'sg-resource-workers-review-v1',run:schedule.run,commit:schedule.commit,workers:40,
  startMs:schedule[key].startMs,endMs:schedule[key].endMs,logSha256:'f'.repeat(64),verified:true,backendEvidenceComplete:true,hostEvidenceComplete:true,
  resourceEvidenceComplete:true,sourceErrors:0,unknown:0,resourceHolds:0,hostPeakCpuPercent:40,hostPeakMemoryPercent:50,
  peakCpuPercent:20,peakMemoryPercent:30,minDiskFreeBytes:40*1024**3});
 const activity={schema:'sg-session-canary-activity-v1',scheduleHash:hash(schedule),sourceRun:schedule.run,sourceCommit:schedule.commit,
  fullJournalReadback:true,journalHash:report.recordsHash,logSha256:'f'.repeat(64),noSourceBeforeSecondLaneStart:true,sourceErrors:0,unknown:0};
 for(const key of ['baseline','candidate'])activity[key]=canarySlots.map(slot=>({slot,sourceRequests:schedule[key].activeSlots.includes(slot)?120:0}));
 return {schedule,report,baselineSafety:safety('baseline'),candidateSafety:safety('candidate'),activity};
}
test('same source, same quota comparison observes forty slots in both phases',()=>{
 const f=fixture(),r=compareCanaryWindows(f);assert.equal(r.baseline.complete,120);assert.equal(r.candidate.complete,240);
 assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);
});
for(const kind of ['warmup','wrong-run','no-readback','missing-host','unsafe-host','disk','incomplete-resource','wrong-window',
 'missing-idle-slot','inactive-source','early-second-lane','missing-journal','unknown','no-gain','tail','changed-schedule','duplicate-slot'])
 test('reject canary evidence '+kind,()=>{const f=fixture();
  if(kind==='warmup')f.report.timing.baseline.stableIntervalCandidate=false;if(kind==='wrong-run')f.report.sourceRun='101:1';
  if(kind==='no-readback')f.report.fullReadback=false;if(kind==='missing-host')f.baselineSafety.hostEvidenceComplete=false;
  if(kind==='unsafe-host')f.candidateSafety.hostPeakMemoryPercent=95;if(kind==='disk')f.candidateSafety.minDiskFreeBytes=25*1024**3;
  if(kind==='incomplete-resource')f.baselineSafety.workers=20;if(kind==='wrong-window')f.candidateSafety.startMs++;
  if(kind==='missing-idle-slot')f.activity.baseline.pop();if(kind==='inactive-source')f.activity.baseline[20].sourceRequests=1;
  if(kind==='early-second-lane')f.activity.noSourceBeforeSecondLaneStart=false;if(kind==='missing-journal')f.activity.fullJournalReadback=false;
  if(kind==='unknown')f.activity.unknown=1;if(kind==='no-gain')f.report.timing.candidate.complete=120;
  if(kind==='tail'){const h=f.report.timing.candidate.histograms['Logic.totalMs'];h.buckets[3]=0;h.buckets[10]=h.count;}
  if(kind==='changed-schedule')f.schedule.baseline.activeSlots.push(40);if(kind==='duplicate-slot')f.activity.candidate[39].slot=0;
  assert.throws(()=>compareCanaryWindows(f));});
test('warmup frames do not enter either ten-minute window',()=>{const s=sessionCanarySchedule(permission()),t=canaryWindowTiming(s);
 t.record({raw:{steps:[{ts:new Date(s.anchorMs+17*60000).toISOString()}]}});
 const r=t.finish();assert.equal(r.baseline.complete+r.candidate.complete,0);assert.equal(r.baseline.frames+r.candidate.frames,0);});
test('idle lane observes without a source, uses the shared deadline, and does not release a hold',async()=>{
 const s=sessionCanarySchedule(permission());let at=s.secondLaneStartMs-25000,reads=0;
 const r=await waitCanaryLane({schedule:s,slot:40,now:()=>at,sleep:async ms=>{at+=ms;},
  observe:async()=>({status:'pending',resourceAllowed:++reads>4,resourceReason:'RESOURCE_WARMING'})});
 assert.equal(r.capture,true);assert(at>=s.secondLaneStartMs);assert(reads>4);assert.equal(r.endMs,s.endMs);
 const stopped=await waitCanaryLane({schedule:s,slot:40,now:()=>s.endMs,observe:async()=>{throw Error('SHOULD_NOT_READ');}});
 assert.equal(stopped.capture,false);
 await assert.rejects(waitCanaryLane({schedule:s,slot:40,now:()=>at,observe:async()=>({status:'halted'})}),/POOL_STOPPED/);
 await assert.rejects(waitCanaryLane({schedule:s,slot:40,now:()=>at,observe:async()=>({status:'pending',resourceAllowed:false,resourceReason:'OPERATOR_HOLD'})}),/WRITES_PAUSED/);
});
test('all forty final source observers bind the raw readback and reject early idle-lane traffic',()=>{
 const f=fixture(),workers=canarySlots.map(slot=>{const a=canarySourceActivity(f.schedule,slot);
  if(slot<40)a.record(f.schedule.baseline.startMs);a.record(f.schedule.candidate.startMs);
  return {slot,sourceErrors:0,unknown:0,final:true,finalActivity:a.diagnostics()};});
 const args={schedule:f.schedule,workers,fullReadback:true,recordsHash:f.report.recordsHash,logSha256:f.activity.logSha256};
 f.activity=reviewCanaryActivity(args);assert.equal(compareCanaryWindows(f).candidate.complete,240);
 workers[20].finalActivity.earlySource=1;assert.throws(()=>reviewCanaryActivity(args));
 workers[20].finalActivity.earlySource=0;workers[20].final=false;assert.throws(()=>reviewCanaryActivity(args));
});
test('canary source policy retains the independently applied two-lane activation',()=>{
 const {profile}=permission(),name='count-runtime-rhino-canary-20261001.json';
 for(const mode of ['refresh','admit'])assert.equal(countControlPolicy(mode,profile,name).canaryWindow,true);
 for(const mode of ['sessions','repair','activate','amend'])assert.throws(()=>countControlPolicy(mode,profile,name));
 assert.throws(()=>countControlPolicy('admit',{...profile,sessionLayout:{lanesPerHost:4}},name));
});

test('same-run comparison accepts explicit new-source full readback plus bound preserved history proofs',()=>{
 const f=fixture();Object.assign(f.report,{fullReadback:false,readbackScope:'current-source-with-preserved-proof-v1',currentSourceFullReadback:true,
  complete:12999,sourceComplete:999,history:{schema:'sg-window-history-reuse-review-v1',complete:12000,preservedReadbackReused:true,
   historicalReadbackFresh:false,rawRecordsRead:0,sourcePermitHash:f.schedule.sourcePermitHash,proofHash:hash('preserved')}});
 const r=compareCanaryWindows(f);assert.equal(r.currentSourceFullReadback,true);assert.equal(r.readbackScope,f.report.readbackScope);
 for(const change of [{currentSourceFullReadback:false},{complete:13000},{history:{...f.report.history,sourcePermitHash:hash('other')}},
  {history:{...f.report.history,historicalReadbackFresh:true}}])assert.throws(()=>compareCanaryWindows({...f,report:{...f.report,...change}}));
});

for(const mode of ['compact-worker-v1','unknown'])test('compact control mode is bound to native gateway '+mode,()=>{
 const f=permission();f.revision.controlReadMode=mode;f.revision.gatewayHash='e'.repeat(64);f.receipt.revisionHash=hash(f.revision);
 if(mode==='unknown')assert.throws(()=>sessionCanarySchedule(f),/CANARY_CONTROL_READ_MODE/);
 else {assert(sessionCanarySchedule(f));delete f.revision.gatewayHash;assert.throws(()=>sessionCanarySchedule(f),/CANARY_CONTROL_READ_MODE/);}
});
