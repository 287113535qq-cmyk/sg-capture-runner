import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {windowTiming} from './window-timing.mjs';

const minute=60000;
export const canarySlots=Object.freeze(Array.from({length:40},(_,i)=>i%20+Math.floor(i/20)*40));
function checkSchedule(s){
 assert(s?.schema==='sg-session-canary-schedule-v1'&&/^\d+:1$/.test(s.run??'')
  &&/^[a-f0-9]{40}$/.test(s.commit??'')&&['activation','profileHash','revisionHash','sourcePermitHash'].every(k=>/^[a-f0-9]{64}$/.test(s[k]??''))
  &&Number.isSafeInteger(s.anchorMs)&&s.anchorMs>=0&&s.anchorMs%minute===0
  &&s.secondLaneStartMs===s.anchorMs+16*minute&&s.endMs===s.anchorMs+32*minute,'CANARY_SCHEDULE');
 for(const [key,start,end,slots]of [['baseline',6,16,canarySlots.slice(0,20)],['candidate',18,28,canarySlots]])
  assert(s[key]?.startMs===s.anchorMs+start*minute&&s[key].endMs===s.anchorMs+end*minute
   &&Array.isArray(s[key].activeSlots)&&s[key].activeSlots.length===slots.length
   &&s[key].activeSlots.every((v,i)=>v===slots[i]),'CANARY_SCHEDULE_PHASE');
}
// An observation schedule cannot create a source permit. All processes share
// the immutable admission timestamp; process startup never resets the phases.
export function checkSessionCanaryRevision(profile,revision){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799
  &&profile.sessionLayout?.lanesPerHost===2&&revision?.schema==='sg-count-runtime-refresh-profile-v1'
  &&revision.purpose==='session-canary-v1'&&revision.profileHash===hash(profile)
  &&revision.activation===profile.activation&&revision.newBetAllowance===0
  &&revision.captureMinutes===32&&revision.resourceObservation==='sg-resource-observation-v1'
  &&revision.hostResourceObservation==='sg-host-resource-observation-v1'
  &&Number.isSafeInteger(revision.completePreserved)&&revision.completePreserved>=profile.completePreserved&&revision.completePreserved<300000
  &&revision.remainingComplete===300000-revision.completePreserved,'CANARY_REVISION');
 return 32;
}
export function sessionCanarySchedule({profile,revision,receipt,permit,commit,run}){
 checkSessionCanaryRevision(profile,revision);
 assert(/^[a-f0-9]{40}$/.test(commit??'')&&/^\d+:1$/.test(run??'')
  &&receipt?.schema==='sg-count-runtime-v2'&&receipt.commit===commit
  &&receipt.revisionHash===hash(revision)&&receipt.profileHash===hash(profile)
  &&receipt.activation===profile.activation&&receipt.newBetAllowance===0&&receipt.sourceRequests===0,
 'CANARY_RUNTIME_RECEIPT');
 assert(permit?.schema==='sg-count-run-v1'&&permit.commit===commit&&permit.run===run
  &&permit.profileHash===hash(profile)&&permit.activation===profile.activation
  &&Number.isSafeInteger(permit.createdAt)&&Number.isSafeInteger(permit.expiresAt)
  &&permit.createdAt>=0,'CANARY_SOURCE_PERMIT');
 const anchor=Math.ceil(permit.createdAt/minute)*minute;
 assert(permit.expiresAt>=anchor+32*minute,'CANARY_PERMIT_TOO_SHORT');
 return {schema:'sg-session-canary-schedule-v1',run,commit,activation:profile.activation,
  profileHash:hash(profile),revisionHash:hash(revision),sourcePermitHash:hash(permit),anchorMs:anchor,
  baseline:{startMs:anchor+6*minute,endMs:anchor+16*minute,activeSlots:canarySlots.slice(0,20)},
  candidate:{startMs:anchor+18*minute,endMs:anchor+28*minute,activeSlots:[...canarySlots]},
  secondLaneStartMs:anchor+16*minute,endMs:anchor+32*minute,sourceRequests:0,newBetAllowance:0};
}
export function canaryLanePhase(schedule,slot,now){
 checkSchedule(schedule);
 assert(schedule?.schema==='sg-session-canary-schedule-v1'&&canarySlots.includes(slot)
  &&Number.isSafeInteger(now)&&now>=schedule.anchorMs-minute,'CANARY_PHASE_SCOPE');
 if(now>=schedule.endMs)return 'drain';
 return slot>=40&&now<schedule.secondLaneStartMs?'observe':'capture';
}
export async function waitCanaryLane({schedule,slot,observe,shouldStop=()=>false,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 checkSchedule(schedule);
 while(!shouldStop()){
  const phase=canaryLanePhase(schedule,slot,now());
  if(phase==='drain')return {capture:false,reason:'CANARY_DEADLINE',endMs:schedule.endMs};
  // Observing an idle lane never registers a worker, claims a batch, or sends
  // INIT/BET. It retains normal health protection without extending a deadline.
  const status=await observe();
  assert(status?.status==='pending'||status?.status==='complete','CANARY_POOL_STOPPED');
  if(status.status==='complete')return {capture:false,reason:'COUNT_ALREADY_COMPLETE',endMs:schedule.endMs};
  assert(status.resourceAllowed===true||String(status.resourceReason).startsWith('RESOURCE_'),'CANARY_WRITES_PAUSED');
  if(phase==='capture'&&status.resourceAllowed===true)return {capture:true,endMs:schedule.endMs};
  await sleep(Math.min(10000,Math.max(1,schedule.endMs-now())));
 }
 return {capture:false,reason:'CANARY_STOPPED',endMs:schedule.endMs};
}
export function canarySourceActivity(schedule,slot){
 checkSchedule(schedule);assert(canarySlots.includes(slot),'CANARY_ACTIVITY_SLOT');
 let requests=0,earlySource=0,invalid=0,firstSourceMs=null;
 const counts={baseline:0,candidate:0};
 return {record(at){
  if(!Number.isSafeInteger(at)||at<0){invalid++;return;}
  requests++;firstSourceMs=firstSourceMs===null?at:Math.min(firstSourceMs,at);
  if(slot>=40&&at<schedule.secondLaneStartMs)earlySource++;
  for(const key of ['baseline','candidate'])if(at>=schedule[key].startMs&&at<schedule[key].endMs)counts[key]++;
 },diagnostics(){return {schema:'sg-session-canary-source-activity-v1',slot,scheduleHash:hash(schedule),
  sourceRun:schedule.run,sourceCommit:schedule.commit,requests,earlySource,invalid,firstSourceMs,...counts};}};
}
// One pass over existing full-readback records, two disjoint measurement
// windows. Warmup records stay durable but do not inflate measured throughput.
export function canaryWindowTiming(schedule){
 checkSchedule(schedule);
 const groups=['baseline','candidate'].map(k=>windowTiming(schedule[k].startMs,schedule[k].endMs));
 return {record(row){for(const g of groups)g.record(row);},finish(){return {
  schema:'sg-session-canary-timing-v1',scheduleHash:hash(schedule),
  baseline:groups[0].finish().windows[0],candidate:groups[1].finish().windows[0],sourceRequests:0,databaseWrites:0};}};
}
function p95(w){
 const hist=Object.entries(w.histograms??{}).filter(([k])=>k.endsWith('.totalMs')).map(([,h])=>h);
 assert(hist.length&&hist.every(h=>Number.isSafeInteger(h.count)&&h.count>0&&h.buckets?.length===16
  &&h.buckets.every(n=>Number.isSafeInteger(n)&&n>=0)&&h.buckets.reduce((a,b)=>a+b,0)===h.count),'CANARY_HISTOGRAM');
 const buckets=Array(16).fill(0);for(const h of hist)h.buckets.forEach((n,i)=>buckets[i]+=n);
 const total=buckets.reduce((a,b)=>a+b,0);let n=0;
 for(let i=0;i<16;i++){n+=buckets[i];if(n>=Math.ceil(total*.95))return [1,5,10,25,50,100,250,500,1000,2000,4000,8000,16000,30000,60000][i]??null;}
}
export function compareCanaryWindows({schedule,report,baselineSafety,candidateSafety,activity}){
 checkSchedule(schedule);
 assert(report?.fullReadback===true&&/^[a-f0-9]{64}$/.test(report.recordsHash??'')
  &&report.sourceRun===schedule.run&&report.sourceCommit===schedule.commit
  &&report.activation===schedule.activation&&report.profileHash===schedule.profileHash
  &&report.sourcePermitHash===schedule.sourcePermitHash&&report.timing?.schema==='sg-session-canary-timing-v1'
  &&report.timing.scheduleHash===hash(schedule),'CANARY_READBACK_BINDING');
 assert(activity?.schema==='sg-session-canary-activity-v1'&&activity.scheduleHash===hash(schedule)
  &&activity.sourceRun===schedule.run&&activity.sourceCommit===schedule.commit
  &&activity.fullJournalReadback===true&&activity.journalHash===report.recordsHash
  &&activity.noSourceBeforeSecondLaneStart===true&&activity.sourceErrors===0&&activity.unknown===0,
 'CANARY_ACTIVITY_BINDING');
 const values=[];
 for(const [i,key]of ['baseline','candidate'].entries()){
  const phase=schedule[key],w=report.timing[key],s=[baselineSafety,candidateSafety][i],rows=activity[key];
  assert(w?.startMs===phase.startMs&&w.endMs===phase.endMs&&w.endMs-w.startMs===10*minute
   &&w.stableIntervalCandidate===true&&w.missing===0&&w.invalid===0
   &&Number.isSafeInteger(w.complete)&&w.complete>0,'CANARY_TIMING_WINDOW');
  // Both phases observe all forty slots, including the idle lane in baseline.
  assert(s?.schema==='sg-resource-workers-review-v1'&&s.run===schedule.run&&s.commit===schedule.commit
   &&s.workers===40&&s.startMs===phase.startMs&&s.endMs===phase.endMs&&s.verified===true
   &&s.backendEvidenceComplete===true&&s.hostEvidenceComplete===true&&s.resourceEvidenceComplete===true
   &&s.sourceErrors===0&&s.unknown===0&&s.resourceHolds===0
   &&s.logSha256===activity.logSha256&&/^[a-f0-9]{64}$/.test(s.logSha256??'')
   &&[s.hostPeakCpuPercent,s.hostPeakMemoryPercent,s.peakCpuPercent,s.peakMemoryPercent].every(n=>Number.isFinite(n)&&n>=0&&n<95)
   &&Number.isSafeInteger(s.minDiskFreeBytes)&&s.minDiskFreeBytes>=30*1024**3,'CANARY_RESOURCES');
  assert(Array.isArray(rows)&&rows.length===40&&new Set(rows.map(r=>r.slot)).size===40,'CANARY_ACTIVITY_SLOTS');
  for(const row of rows)assert(canarySlots.includes(row.slot)&&Number.isSafeInteger(row.sourceRequests)
   &&(phase.activeSlots.includes(row.slot)?row.sourceRequests>0:row.sourceRequests===0),'CANARY_INACTIVE_SOURCE');
  values.push({lanesPerHost:i+1,durationMs:10*minute,complete:w.complete,requestP95Ms:p95(w),
   recordsHash:report.recordsHash,errors:0,unknown:0,resourceHolds:0});
 }
 assert(values.every(w=>Number.isFinite(w.requestP95Ms)&&w.requestP95Ms>0)
  &&values[1].complete>values[0].complete&&values[1].requestP95Ms<=values[0].requestP95Ms,'CANARY_NOT_IMPROVED');
 return {schema:'sg-session-comparison-v1',mode:'same-run-canary-v1',trialId:'sg_r1_20261001_32799',run:schedule.run,commit:schedule.commit,
  activation:schedule.activation,profileHash:schedule.profileHash,sourcePermitHash:schedule.sourcePermitHash,
  scheduleHash:hash(schedule),recordsHash:report.recordsHash,activityHash:hash(activity),fullReadback:true,
  baselineResources:baselineSafety,candidateResources:candidateSafety,
  baseline:values[0],candidate:values[1],sourceRequests:0,newBetAllowance:0};
}
export function reviewCanaryActivity({schedule,workers,fullReadback,recordsHash,logSha256}){
 checkSchedule(schedule);
 assert(fullReadback===true&&/^[a-f0-9]{64}$/.test(recordsHash??'')&&/^[a-f0-9]{64}$/.test(logSha256??'')
  &&Array.isArray(workers)&&workers.length===40&&new Set(workers.map(w=>w.slot)).size===40,'CANARY_ACTIVITY_READBACK');
 const baseline=[],candidate=[];
 for(const w of workers){
  const d=w.finalActivity;
  assert(canarySlots.includes(w.slot)&&w.sourceErrors===0&&w.unknown===0&&w.final===true
   &&d?.schema==='sg-session-canary-source-activity-v1'&&d.slot===w.slot&&d.scheduleHash===hash(schedule)
   &&d.sourceRun===schedule.run&&d.sourceCommit===schedule.commit&&d.invalid===0&&d.earlySource===0
   &&[d.requests,d.baseline,d.candidate].every(n=>Number.isSafeInteger(n)&&n>=0)
   &&d.requests>=d.baseline+d.candidate&&Number.isSafeInteger(d.firstSourceMs)
   &&(w.slot<40||d.firstSourceMs>=schedule.secondLaneStartMs),'CANARY_SOURCE_ACTIVITY');
  baseline.push({slot:w.slot,sourceRequests:d.baseline});candidate.push({slot:w.slot,sourceRequests:d.candidate});
 }
 return {schema:'sg-session-canary-activity-v1',scheduleHash:hash(schedule),sourceRun:schedule.run,sourceCommit:schedule.commit,
  fullJournalReadback:true,journalHash:recordsHash,logSha256,noSourceBeforeSecondLaneStart:true,sourceErrors:0,unknown:0,baseline,candidate};
}
