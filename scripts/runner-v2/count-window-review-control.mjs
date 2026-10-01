import fs from 'node:fs';import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {applyFormalCount,formalCountProfilePath} from './formal-count-plan.mjs';
import {loadCountPermission} from './complete-count.mjs';import {reviewCountWindow} from './count-window-review.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {windowTiming} from './window-timing.mjs';
import {readParentTailFailure} from './parent-tail-failure.mjs';
import {checkWindowPeerProfile} from './count-window-peer.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';
import {readVerifyEntryFailure} from './verify-entry-failure.mjs';
import {sessionCanarySchedule,canaryWindowTiming} from './session-canary.mjs';
import {loadCanarySourceLog} from './canary-source-log.mjs';
import {reviewCanaryFinalLogs} from './session-canary-log.mjs';
import {reviewFourLogs} from './session-four-log-review.mjs';
import {checkCanaryAdmission} from './session-canary-admission.mjs';
assert(process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&/^\d+:1$/.test(process.env.SG_WINDOW_SOURCE_RUN??''),'WINDOW_GITHUB_SCOPE');
const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'));
assert(profile.gameId===32799&&['sg-formal-count-rhino-v2','sg-session-layout-rhino-v1'].includes(profile.schema),'WINDOW_PROFILE_SCOPE');
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),plan=applyFormalCount(plans,profile)[32799];
const read=authenticatedRead(process.env.GH_TOKEN),root='repos/zyzuoyang/sg-capture-runner/actions/runs/'+process.env.SG_WINDOW_SOURCE_RUN.split(':')[0];
const ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
const verifyEntryFailure=ended.id===36839677352&&ended.conclusion==='failure'?readVerifyEntryFailure(ended,jobs):null;
const parentTailFailure=ended.conclusion==='failure'&&!verifyEntryFailure?readParentTailFailure(ended,jobs):null;
assert(`${ended.id}:${ended.run_attempt}`===process.env.SG_WINDOW_SOURCE_RUN&&ended.status==='completed'&&(ended.conclusion==='success'||parentTailFailure||verifyEntryFailure)
 &&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.path==='.github/workflows/trial-300k.yml','WINDOW_SOURCE_NOT_ENDED');
assert(parentTailFailure||verifyEntryFailure||(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100&&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
 &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1)),'WINDOW_SOURCE_JOBS');
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
try{
 const witnessName=process.env.SG_COUNT_WINDOW_PEER_PROFILE;
 assert(!witnessName||witnessName==='count-window-peer-rhino-pyramids-20261001.json','WINDOW_PEER_PROFILE_PATH');
 const peer=witnessName?checkWindowPeerProfile(JSON.parse(fs.readFileSync('config/'+witnessName,'utf8')),profile,ended):null;
 const self={run:process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA};
 const boundary=peer?countPeerBoundary({read,transport,peer,selfGroup:'primary',...self,workflowPath:'.github/workflows/demo-maintenance.yml'}):
  maintenanceBoundary({read,store,oldProfile:JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8')),...self});
 await boundary();await checkPrimaryLeases({store,plans});
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:ended.head_sha});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${process.env.SG_WINDOW_SOURCE_RUN}`))?.value;
 assert(permit?.commit===ended.head_sha&&permit.profileHash===hash(profile)&&permit.activation===spec.activation,'WINDOW_SOURCE_PERMISSION');
 const scans={request:async(op,fields)=>{await store.writable();return transport.request(op,fields);}};
 const captures=jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name)),startMs=Math.min(...captures.map(j=>Date.parse(j.started_at))),endMs=Math.max(...captures.map(j=>Date.parse(j.completed_at)));
 // Align numeric timing windows with resource minute buckets. The partial
 // startup minute is excluded, never counted as a stable comparison window.
 let canary,canaryAdmissionHash,canaryRevisionHash;
 if(process.env.SG_COUNT_RUNTIME_PROFILE){
  assert(process.env.SG_COUNT_RUNTIME_PROFILE==='count-runtime-rhino-canary-20261001.json','WINDOW_RUNTIME_SCOPE');
  const revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8'));
  const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${spec.activation}:${ended.head_sha}`))?.value;
  const admission=(await store.get('journal',`session-canary:${plan.trialId}:${hash(revision)}:admit`))?.value;
  canaryAdmissionHash=checkCanaryAdmission({plan,profile,revision,permit,admission});
  canaryRevisionHash=hash(revision);
  canary=sessionCanarySchedule({profile,revision,receipt,permit,commit:ended.head_sha,run:process.env.SG_WINDOW_SOURCE_RUN});
 }
 const four=profile.schema==='sg-session-layout-rhino-v1'&&profile.gameId===32799&&profile.sessionLayout?.lanesPerHost===4;
 const result=await reviewCountWindow({store,transport:scans,parser,plan,pool,spec,historyPermit:canary||four?permit:undefined,timing:canary?canaryWindowTiming(canary):windowTiming(Math.ceil(startMs/60000)*60000,endMs)});
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===hash(campaign),'WINDOW_CAMPAIGN_CHANGED');
 let canaryProof,fourProof;
 if(four){
  assert(!canary,'WINDOW_LAYOUT_CONFLICT');
  const logs=loadCanarySourceLog(ended,jobs,{expectedCount:80});
  const window=result.timing.windows.find(w=>w.stableIntervalCandidate&&w.startMs>=Math.ceil(startMs/60000)*60000+600000);
  assert(window,'FOUR_STABLE_WINDOW_MISSING');
  fourProof=reviewFourLogs({run:process.env.SG_WINDOW_SOURCE_RUN,commit:ended.head_sha,report:{...result,sourceRun:process.env.SG_WINDOW_SOURCE_RUN,sourceCommit:ended.head_sha,sourcePermitHash:hash(permit)},...logs,startMs:window.startMs,endMs:window.endMs});
 }
 if(canary){
  const logs=loadCanarySourceLog(ended,jobs);
  canaryProof=reviewCanaryFinalLogs({schedule:canary,report:{...result,sourceRun:process.env.SG_WINDOW_SOURCE_RUN,sourceCommit:ended.head_sha,
   profileHash:hash(profile),sourcePermitHash:hash(permit)},...logs});
  canaryProof.comparison.canaryAdmissionHash=canaryAdmissionHash;
  canaryProof.comparison.canaryRevisionHash=canaryRevisionHash;
  await boundary();assert(hash((await store.get('state','campaign'))?.value)===hash(campaign)
   &&hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool),'WINDOW_CANARY_SCENE_CHANGED');
  const key=`session-comparison:${plan.trialId}:${hash(canaryProof.comparison)}`;
  assert(!(await store.get('journal',key)),'CANARY_COMPARISON_ALREADY_APPLIED');
  await store.create('journal',key,canaryProof.comparison,{immutable:true});
  assert(hash((await store.get('journal',key))?.value)===hash(canaryProof.comparison),'CANARY_COMPARISON_READBACK');
 }
 console.log(JSON.stringify({...result,sourceRun:process.env.SG_WINDOW_SOURCE_RUN,sourceCommit:ended.head_sha,
  sourceSpecHash:hash(spec),sourcePermitHash:hash(permit),campaignHash:hash(campaign),profileHash:hash(profile),
  previousLanesPerHost:plan.sessionLayout?.lanesPerHost??1,completeBefore:permit.completeBefore,nextBatchId:pool.nextBatchId,nextSequence:pool.nextSequence,parentTailFailure,verifyEntryFailure,
  ...(four?{fourProof}:{}),
  ...(canary?{canarySchedule:canary,sourcePermitHash:hash(permit),canaryProof,comparisonHash:hash(canaryProof.comparison),comparisonJournalWrites:1,databaseWrites:1}:{})}));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'WINDOW_REVIEW_FAILED',sourceRequests:0,databaseWrites:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
