import test from 'node:test';import assert from 'node:assert/strict';import {compareSessionWindows} from './session-window-comparison.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){const profile={schema:'sg-session-layout-rhino-v1',sessionLayout:{lanesPerHost:2},sourceRun:'11:1',parentProfileHash:'a'.repeat(64),activation:'b'.repeat(64)};
 const window=complete=>({startMs:0,endMs:600000,complete,stableIntervalCandidate:true,missing:0,invalid:0,histograms:{'Logic.totalMs':{count:100,buckets:[0,0,0,0,0,0,0,0,0,100,0,0,0,0,0,0]}}});
 const report=(complete)=>({fullReadback:true,recordsHash:'c'.repeat(64),timing:{windows:[null,window(complete)]}});
 return {profile,baseline:{...report(100),sourceRun:'11:1',profileHash:profile.parentProfileHash},candidate:{...report(180),sourceRun:'22:1',sourceCommit:'d'.repeat(40),profileHash:hash(profile),activation:profile.activation,previousLanesPerHost:2,trialId:'sg_r1_20261001_32799'},baselineSafety:{verified:true,sourceErrors:0,unknown:0,resourceHolds:0,resourceEvidenceComplete:true},candidateSafety:{verified:true,sourceErrors:0,unknown:0,resourceHolds:0,resourceEvidenceComplete:true}};}
test('matched verified steady windows require throughput gain without worse request tail',()=>{const r=compareSessionWindows(fixture());assert.equal(r.candidate.complete,180);assert.equal(r.baseline.requestP95Ms,2000);});
for(const bad of ['missing-resource-history','resource-hold','source-error','startup','different-duration','no-gain','worse-tail'])test('refuse '+bad,()=>{
 const f=fixture(),w=f.candidate.timing.windows[1];if(bad==='missing-resource-history')delete f.baselineSafety.resourceEvidenceComplete;
 if(bad==='resource-hold')f.candidateSafety.resourceHolds=1;if(bad==='source-error')f.candidateSafety.sourceErrors=1;
 if(bad==='startup')w.stableIntervalCandidate=false;if(bad==='different-duration')w.endMs++;
 if(bad==='no-gain')w.complete=100;if(bad==='worse-tail'){w.histograms['Logic.totalMs'].buckets[9]=0;w.histograms['Logic.totalMs'].buckets[10]=100;}
 assert.throws(()=>compareSessionWindows(f));
});
