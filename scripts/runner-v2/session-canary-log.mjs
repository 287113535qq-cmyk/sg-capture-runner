import assert from 'node:assert/strict';
import {canarySlots,reviewCanaryActivity,compareCanaryWindows} from './session-canary.mjs';
import {reviewResourceWorkers} from './resource-windows.mjs';

// Input consists only of the final numeric rows extracted from the verified
// full source log. Protocol strings and other log content never enter a proof.
export function reviewCanaryFinalLogs({schedule,report,rows,logSha256}){
 assert(Array.isArray(rows)&&rows.length===40&&new Set(rows.map(r=>r.shardId)).size===40,'CANARY_FINAL_LOGS');
 const workers=rows.map(row=>{
  assert(row?.schema==='sg-capture-performance-v1'&&row.reason==='final'&&row.gameId===32799
   &&canarySlots.includes(row.shardId)&&row.sourceErrors===0&&Number.isSafeInteger(row.sourceRequests)
   &&row.sourceRequests>0&&row.canarySourceActivity?.requests===row.sourceRequests,'CANARY_FINAL_LOG_ROW');
  return {slot:row.shardId,run:schedule.run,commit:schedule.commit,sourceErrors:row.sourceErrors,unknown:0,
   final:true,finalActivity:row.canarySourceActivity,hostDiagnostics:row.rpcMetrics?.hostResourceObservation,
   diagnostics:row.rpcMetrics?.resourceObservation};
 });
 const activity=reviewCanaryActivity({schedule,workers,fullReadback:report.fullReadback,recordsHash:report.recordsHash,logSha256});
 const safety=key=>reviewResourceWorkers({run:schedule.run,commit:schedule.commit,logSha256,expectedSlots:[...canarySlots],workers,
  startMs:schedule[key].startMs,endMs:schedule[key].endMs});
 const baselineSafety=safety('baseline'),candidateSafety=safety('candidate');
 return {comparison:compareCanaryWindows({schedule,report,activity,baselineSafety,candidateSafety}),activity,baselineSafety,candidateSafety};
}
