import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
function p95(window){
 const hist=Object.entries(window.histograms).filter(([k])=>k.endsWith('.totalMs')).map(([,v])=>v);
 assert(hist.length&&hist.every(h=>h.count>0&&h.buckets.length===16),'COMPARISON_HISTOGRAM');
 const buckets=Array(16).fill(0);for(const h of hist)h.buckets.forEach((n,i)=>buckets[i]+=n);
 const count=buckets.reduce((a,b)=>a+b,0);let sum=0;
 for(let i=0;i<buckets.length;i++){sum+=buckets[i];if(sum>=Math.ceil(count*.95))return [1,5,10,25,50,100,250,500,1000,2000,4000,8000,16000,30000,60000][i]??null;}
}
// Called only after independent source identity, full readback and resource
// diagnostics checks. Absence of telemetry never means zero errors or holds.
export function compareSessionWindows({profile,baseline,candidate,baselineSafety,candidateSafety,index=1}){
 assert(profile?.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===2
  &&baseline.sourceRun===profile.sourceRun&&baseline.profileHash===profile.parentProfileHash
  &&candidate.profileHash===hash(profile)&&candidate.activation===profile.activation
  &&candidate.previousLanesPerHost===2,'COMPARISON_SCOPE');
 const reports=[baseline,candidate],safety=[baselineSafety,candidateSafety],windows=reports.map(r=>r.timing?.windows[index]);
 for(let i=0;i<2;i++)assert(reports[i].fullReadback===true&&/^[a-f0-9]{64}$/.test(reports[i].recordsHash??'')
  &&windows[i]?.stableIntervalCandidate===true&&windows[i].missing===0&&windows[i].invalid===0
  &&safety[i]?.verified===true&&safety[i].sourceErrors===0&&safety[i].unknown===0
  &&safety[i].resourceHolds===0&&safety[i].resourceEvidenceComplete===true,'COMPARISON_EVIDENCE_INCOMPLETE');
 assert(windows[0].endMs-windows[0].startMs===windows[1].endMs-windows[1].startMs,'COMPARISON_DURATION');
 for(let i=0;i<2;i++)if(safety[i].schema==='sg-resource-workers-review-v1')assert(
  safety[i].run===reports[i].sourceRun&&safety[i].commit===reports[i].sourceCommit
  &&safety[i].startMs===windows[i].startMs&&safety[i].endMs===windows[i].endMs
  &&safety[i].workers===(i+1)*20,'COMPARISON_RESOURCE_WINDOW_CHANGED');
 const values=windows.map((w,i)=>({lanesPerHost:i+1,durationMs:w.endMs-w.startMs,complete:w.complete,
  requestP95Ms:p95(w),recordsHash:reports[i].recordsHash,errors:0,unknown:0,resourceHolds:0}));
 assert(values.every(w=>Number.isSafeInteger(w.complete)&&w.complete>0&&Number.isFinite(w.requestP95Ms)&&w.requestP95Ms>0)
  &&values[1].complete>values[0].complete&&values[1].requestP95Ms<=values[0].requestP95Ms,'COMPARISON_NOT_IMPROVED');
 return {schema:'sg-session-comparison-v1',trialId:candidate.trialId,profileHash:hash(profile),activation:profile.activation,
  run:candidate.sourceRun,commit:candidate.sourceCommit,fullReadback:true,baseline:values[0],candidate:values[1]};
}
