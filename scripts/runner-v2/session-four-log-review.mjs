import assert from 'node:assert/strict';
import {sessionWindowP95} from './session-canary.mjs';
import {reviewResourceWorkers} from './resource-windows.mjs';
const slots=Array.from({length:80},(_,i)=>i%20+40*Math.floor(i/20));
// Read-only review. Full current-source records and immutable history proofs precede telemetry.
export function reviewFourLogs({run,commit,rows,report,logSha256,startMs,endMs}){
 const preserved=report?.fullReadback===false&&report.readbackScope==='current-source-with-preserved-proof-v1'
  &&report.currentSourceFullReadback===true&&report.history?.preservedReadbackReused===true
  &&report.history.historicalReadbackFresh===false&&report.history.rawRecordsRead===0
  &&/^[a-f0-9]{64}$/.test(report.sourcePermitHash??'')&&report.history.sourcePermitHash===report.sourcePermitHash
  &&Number.isSafeInteger(report.history.complete)&&report.history.complete>=0
  &&Number.isSafeInteger(report.sourceComplete)&&report.sourceComplete>0
  &&report.complete===report.history.complete+report.sourceComplete;
 assert(report?.sourceRun===run&&report.sourceCommit===commit&&(report.fullReadback===true||preserved)
  &&report.trialId==='sg_r1_20261001_32799'&&Number.isSafeInteger(report.complete)&&report.complete>0&&report.complete<=300000&&report.remainingComplete===300000-report.complete&&['activation','profileHash','sourcePermitHash','recordsHash'].every(k=>/^[a-f0-9]{64}$/.test(report[k]??'')),'FOUR_READBACK_REQUIRED');
 assert(Array.isArray(rows)&&rows.length===80&&new Set(rows.map(r=>r.shardId)).size===80,'FOUR_FINAL_ROWS');
 const workers=rows.map(r=>{
  assert(r?.schema==='sg-capture-performance-v1'&&r.reason==='final'&&r.gameId===32799
   &&slots.includes(r.shardId)&&r.sourceErrors===0&&Number.isSafeInteger(r.sourceRequests)&&r.sourceRequests>0,'FOUR_FINAL_ROW');
  return {slot:r.shardId,run,commit,sourceErrors:0,unknown:0,diagnostics:r.rpcMetrics?.resourceObservation,
   hostDiagnostics:r.rpcMetrics?.hostResourceObservation};
 });
 const safety=reviewResourceWorkers({run,commit,logSha256,expectedSlots:slots,workers,startMs,endMs});
 const window=report.timing?.windows?.find(w=>w.startMs===startMs&&w.endMs===endMs);
 assert(window?.stableIntervalCandidate===true&&window.missing===0&&window.invalid===0
  &&Number.isSafeInteger(window.complete)&&window.complete>0,'FOUR_TIMING_REQUIRED');
 return {schema:'sg-four-session-window-review-v1',run,commit,logSha256,recordsHash:report.recordsHash,
  trialId:report.trialId,activation:report.activation,profileHash:report.profileHash,sourcePermitHash:report.sourcePermitHash,complete:report.complete,remainingComplete:report.remainingComplete,
  metrics:{lanesPerHost:4,durationMs:endMs-startMs,complete:window.complete,requestP95Ms:sessionWindowP95(window)},
  safety,window,sourceRequests:0,databaseWrites:0,sourceAllowance:0,comparisonApplied:false};
}
