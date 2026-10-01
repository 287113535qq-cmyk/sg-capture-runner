import test from 'node:test';import assert from 'node:assert/strict';
import {checkRhinoContinuousRevision,rhinoContinuousMinutes,checkFourContinuousProof} from './rhino-continuous-runtime.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,activation:'a'.repeat(64),completePreserved:8320,sessionLayout:{lanesPerHost:2}};
const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'continuous-count-v1',gameId:32799,profileHash:hash(profile),activation:profile.activation,captureMinutes:220,newBetAllowance:0,resourceObservation:'sg-resource-observation-v1',completePreserved:30000,remainingComplete:270000,
 secondaryPeer:{schema:'sg-count-peer-v1',group:'secondary',repository:'287113535qq-cmyk/sg-capture-runner',gameId:32721,trialId:'sg_r1_20260928_32721',run:'123:1',commit:'b'.repeat(40),activation:'c'.repeat(64),profileHash:'d'.repeat(64),lanesPerHost:1}};
const commit='e'.repeat(40),receipt={schema:'sg-count-runtime-v2',commit,profileHash:hash(profile),activation:profile.activation,revisionHash:hash(revision),newBetAllowance:0,sourceRequests:0};
test('continuous count reuses two independent sessions and remaining quota only after refresh',()=>assert.equal(rhinoContinuousMinutes(profile,revision,receipt,commit),220));
test('wrong target duration increased concurrency missing peer and unbound refresh refuse',()=>{
 for(const patch of [{captureMinutes:240},{newBetAllowance:1},{completePreserved:8320-1},{remainingComplete:300000},{purpose:'observation'},{secondaryPeer:{}}])assert.throws(()=>checkRhinoContinuousRevision(profile,{...revision,...patch}));
 assert.throws(()=>checkRhinoContinuousRevision({...profile,sessionLayout:{lanesPerHost:4}},revision));
 for(const patch of [{revisionHash:'f'.repeat(64)},{commit:'f'.repeat(40)},{sourceRequests:1}])assert.throws(()=>rhinoContinuousMinutes(profile,revision,{...receipt,...patch},commit));
});
test('continuous entry reaches only refresh and admit for the applied two-session profile',()=>{
 for(const filename of ['count-runtime-rhino-continuous-20261001.json','count-runtime-rhino-ag-continuation-20261001.json','count-runtime-rhino-ag-continuation-entryfix-20261001.json'])
 for(const mode of ['refresh','admit'])assert(countControlPolicy(mode,profile,filename).continuousCount);
 for(const mode of ['activate','repair','amend','sessions'])assert.throws(()=>countControlPolicy(mode,profile,'count-runtime-rhino-continuous-20261001.json'));
 assert.throws(()=>countControlPolicy('refresh',{...profile,sessionLayout:{lanesPerHost:4}},'count-runtime-rhino-continuous-20261001.json'));
});

function fourFixture(){
 const comparison={schema:'sg-session-comparison-v1',mode:'same-run-canary-v1',trialId:'sg_r1_20261001_32799',profileHash:'e'.repeat(64),activation:'f'.repeat(64),fullReadback:true,candidate:{lanesPerHost:2,durationMs:600000,errors:0,unknown:0,resourceHolds:0,complete:600,requestP95Ms:4000}};
 const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,activation:'a'.repeat(64),parentActivation:comparison.activation,parentProfileHash:comparison.profileHash,comparisonHash:hash(comparison),completePreserved:30000,sessionLayout:{lanesPerHost:4}},plan={trialId:'sg_r1_20261001_32799'},permit={schema:'sg-count-run-v1',run:'200:1',commit:'b'.repeat(40),activation:profile.activation,profileHash:hash(profile)};
 const window={startMs:60000,endMs:660000,stableIntervalCandidate:true,missing:0,invalid:0,complete:1000};
 const proof={schema:'sg-four-session-window-review-v1',run:'200:1',commit:'b'.repeat(40),trialId:plan.trialId,activation:profile.activation,profileHash:hash(profile),sourcePermitHash:hash(permit),complete:40000,remainingComplete:260000,sourceRequests:0,databaseWrites:0,sourceAllowance:0,logSha256:'c'.repeat(64),window,metrics:{lanesPerHost:4,durationMs:600000,complete:1000,requestP95Ms:4000},
 safety:{schema:'sg-resource-workers-review-v1',run:'200:1',commit:'b'.repeat(40),logSha256:'c'.repeat(64),workers:80,verified:true,resourceEvidenceComplete:true,backendEvidenceComplete:true,hostEvidenceComplete:true,sourceErrors:0,unknown:0,resourceHolds:0,startMs:window.startMs,endMs:window.endMs,peakCpuPercent:50,peakMemoryPercent:50,hostPeakCpuPercent:50,hostPeakMemoryPercent:50,minDiskFreeBytes:40*1024**3}};
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'continuous-four-count-v1',gameId:32799,profileHash:hash(profile),activation:profile.activation,captureMinutes:220,newBetAllowance:0,resourceObservation:'sg-resource-observation-v1',completePreserved:40000,remainingComplete:260000,sourceRun:proof.run,fromCommit:proof.commit,sourcePermitHash:hash(permit),fourSessionProofHash:hash(proof)};
 const store={get:async(c,k)=>({value:k.endsWith(profile.comparisonHash)?comparison:k.startsWith('session-comparison:')?proof:permit})};return {profile,plan,revision,proof,permit,comparison,store};
}
test('four-session long runtime requires the actual persisted same-source eighty-lane proof without new quota',async()=>{const f=fourFixture();assert.equal(checkRhinoContinuousRevision(f.profile,f.revision),220);assert.equal(await checkFourContinuousProof(f),f.proof);for(const mode of ['refresh','admit'])assert(countControlPolicy(mode,f.profile,'count-runtime-rhino-four-continuous-20261001.json').fourContinuousCount);});
for(const kind of ['missing','changed-proof','wrong-run','wrong-permit','wrong-complete','fewer-lanes','missing-host','overload','partial-window','new-quota','slower','higher-p95','wrong-baseline'])test('four-session continuous refuses '+kind,async()=>{const f=fourFixture();
 if(kind==='missing')f.store.get=async()=>null;
 if(kind==='changed-proof')f.revision.fourSessionProofHash='d'.repeat(64);
 if(kind==='wrong-run')f.proof.run='201:1';if(kind==='wrong-permit')f.permit.run='201:1';if(kind==='wrong-complete')f.proof.complete++;
 if(kind==='fewer-lanes')f.proof.safety.workers=40;if(kind==='missing-host')f.proof.safety.hostEvidenceComplete=false;if(kind==='overload')f.proof.safety.hostPeakCpuPercent=95;
 if(kind==='partial-window')f.proof.window.endMs-=60000;if(kind==='new-quota')f.revision.newBetAllowance=1;
 if(kind==='slower')f.proof.window.complete=f.proof.metrics.complete=500;if(kind==='higher-p95')f.proof.metrics.requestP95Ms=8000;if(kind==='wrong-baseline')f.comparison.activation='1'.repeat(64);
 if(!['changed-proof'].includes(kind))f.revision.fourSessionProofHash=hash(f.proof);
 await assert.rejects(()=>checkFourContinuousProof(f));
});
