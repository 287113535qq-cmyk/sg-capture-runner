import test from 'node:test';import assert from 'node:assert/strict';
import {reviewFourLogs} from './session-four-log-review.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {HostResourceObservation} from './host-resource-observation.mjs';
function fixture(){let at=0;const gate=new ResourceGate({now:()=>at}),host=new HostResourceObservation({now:()=>at});
 for(let i=0;i<=150;i++){at=i*10000;const s={sampledAtMs:at,bootId:'offline',cpuTicks:[i*20,0,0,i*80,0,0,0,0],memTotalKiB:100,memAvailableKiB:60,diskFreeBytes:50*1024**3};gate.observe(s);host.observe(s);}
 const run='100:1',commit='a'.repeat(40),rows=Array.from({length:80},(_,i)=>({schema:'sg-capture-performance-v1',reason:'final',gameId:32799,
 shardId:i%20+40*Math.floor(i/20),sourceErrors:0,sourceRequests:10,rpcMetrics:{resourceObservation:gate.diagnostics(),hostResourceObservation:host.diagnostics()}}));
 return {run,commit,rows,logSha256:'b'.repeat(64),startMs:120000,endMs:720000,report:{sourceRun:run,sourceCommit:commit,fullReadback:true,trialId:'sg_r1_20261001_32799',activation:'a'.repeat(64),profileHash:'b'.repeat(64),sourcePermitHash:'d'.repeat(64),complete:2000,remainingComplete:298000,recordsHash:'c'.repeat(64),
 timing:{windows:[{startMs:120000,endMs:720000,stableIntervalCandidate:true,missing:0,invalid:0,complete:1000,histograms:{'BET.totalMs':{count:10,buckets:[0,0,0,0,0,10,0,0,0,0,0,0,0,0,0,0]}}}]}}};}
 test('all eighty final observations and the same ten-minute full readback verify with zero permission',()=>{const r=reviewFourLogs(fixture());assert.equal(r.safety.workers,80);assert.equal(r.sourceAllowance,0);assert.equal(r.comparisonApplied,false);});
 for(const kind of ['missing','duplicate','wrong-run','errors','missing-host','missing-readback','unstable','gap'])test('reject '+kind,()=>{const f=fixture();
 if(kind==='missing')f.rows.pop();if(kind==='duplicate')f.rows[79].shardId=0;if(kind==='wrong-run')f.report.sourceRun='101:1';
 if(kind==='errors')f.rows[10].sourceErrors=1;if(kind==='missing-host')delete f.rows[10].rpcMetrics.hostResourceObservation;
 if(kind==='missing-readback')f.report.fullReadback=false;if(kind==='unstable')f.report.timing.windows[0].stableIntervalCandidate=false;
 if(kind==='gap')f.rows[10].rpcMetrics.resourceObservation.windows.buckets[4].coveredMs=50000;assert.throws(()=>reviewFourLogs(f));});

function prefixFixture(){const f=fixture();Object.assign(f.report,{fullReadback:false,readbackScope:'current-source-with-preserved-proof-v1',currentSourceFullReadback:true,sourcePermitHash:'d'.repeat(64),complete:2000,sourceComplete:1000,history:{preservedReadbackReused:true,historicalReadbackFresh:false,rawRecordsRead:0,sourcePermitHash:'d'.repeat(64),complete:1000}});return f;}
test('explicit verified history prefix avoids old raw rescans while all new records remain fully checked',()=>assert.equal(reviewFourLogs(prefixFixture()).safety.workers,80));
for(const kind of ['hash','scope','count','fresh','new-readback'])test('reject incomplete history evidence '+kind,()=>{const f=prefixFixture();if(kind==='hash')f.report.history.sourcePermitHash='e'.repeat(64);if(kind==='scope')f.report.readbackScope='partial';if(kind==='count')f.report.complete++;if(kind==='fresh')f.report.history.historicalReadbackFresh=true;if(kind==='new-readback')f.report.currentSourceFullReadback=false;assert.throws(()=>reviewFourLogs(f));});
