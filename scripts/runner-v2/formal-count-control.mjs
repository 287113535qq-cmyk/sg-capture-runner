import {waitFormalRelayParent,formalRelayInputs} from './formal-relay.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {formalCountProfilePath,applyFormalCount} from './formal-count-plan.mjs';
import {activateFormalCount} from './formal-count-activation.mjs';import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {amendFormalRuntime} from './formal-count-runtime.mjs';
import {refreshCountRuntime} from './count-runtime-refresh.mjs';
import {activateFormalRepair} from './formal-repair-activation.mjs';
import {activateSessionLayout} from './session-layout-activation.mjs';
import {authorizeInitialCountRuntime} from './count-initial-runtime.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
import {checkRhinoObservationRevision} from './rhino-observation-runtime.mjs';
import {readParentTailFailure} from './parent-tail-failure.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';
import {checkRhinoContinuousRevision,checkFourContinuousProof} from './rhino-continuous-runtime.mjs';
import {readVerifyEntryFailure} from './verify-entry-failure.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkSessionCanaryRevision} from './session-canary.mjs';
import {claimSessionCanary,checkCanaryDispatchInputs} from './session-canary-admission.mjs';
import {loadInitialReadFailure} from './initial-read-failure.mjs';
import {checkFourReadRecovery} from './four-read-recovery-runtime.mjs';
import {countHistoryBoundary} from './count-window-history.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['activate','admit','amend','repair','refresh','sessions'].includes(mode),'FORMAL_COUNT_OPERATION');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=readFile(formalCountProfilePath()),basePlans=readFile('config/round-one-plans.json');
const plans=applyFormalCount(basePlans,profile),plan=plans[profile.gameId],commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const runtimeProfile=process.env.SG_COUNT_RUNTIME_PROFILE;
const {isRhino,isSessions,isRepair,initialWindow,observationWindow,continuousCount,canaryWindow,fourReadRecovery}=countControlPolicy(mode,profile,runtimeProfile);
const revision=runtimeProfile?readFile('config/'+runtimeProfile):mode==='activate'||isRepair||isRhino||isSessions?null:readFile('config/formal-runtime-pearl-20260930.json');
if(revision)assert(revision.profileHash===hash(profile)&&revision.activation===profile.activation,'COUNT_REVISION_SCOPE');
if(observationWindow)checkRhinoObservationRevision(profile,revision);
if(continuousCount)checkRhinoContinuousRevision(profile,revision);
if(canaryWindow)checkSessionCanaryRevision(profile,revision);
if(fourReadRecovery)checkFourReadRecovery(profile,revision);
const canaryInputs=canaryWindow&&mode==='admit'?JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).inputs:null;
if(canaryWindow&&mode==='admit')checkCanaryDispatchInputs(canaryInputs);
const files=revision?.files??profile.files;
assert(files&&Object.keys(files).length>=300,'FORMAL_COUNT_RUNTIME_MANIFEST');
if(runtimeProfile)assert(Object.keys(profile.files).every(p=>Object.hasOwn(files,p)),'COUNT_RUNTIME_FILES_MISSING');
for(const [p,h] of Object.entries(files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'FORMAL_COUNT_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'FORMAL_COUNT_RUNTIME_CHANGED');
}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer(),read=authenticatedRead(process.env.GH_TOKEN);
assert(!revision?.secondaryPeer||isRhino||profile.schema==='sg-session-layout-rhino-v1','COUNT_PEER_PROFILE_SCOPE');
const workflowPath=mode!=='admit'?'.github/workflows/demo-maintenance.yml':'.github/workflows/trial-300k.yml';
const idle=revision?.secondaryPeer?countPeerBoundary({read,transport,peer:revision.secondaryPeer,selfGroup:'primary',run,commit,workflowPath}):
 maintenanceBoundary({read,store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath});
try{
 if(mode==='admit'&&process.env.SG_COUNT_RELAY_PARENT)await waitFormalRelayParent({store,read,plan,profile,repository:process.env.GITHUB_REPOSITORY,commit,parentRun:process.env.SG_COUNT_RELAY_PARENT,selfRun:run,inputs:formalRelayInputs(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).inputs)});
 const boundary=async()=>{
  await idle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans:basePlans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
  const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after:profile.maxSequence});
  assert(rows.length===0,'FORMAL_COUNT_NATIVE_CEILING');
 };
 if(mode==='sessions'){
  const parentName=profile.gameId===32799?(profile.previousLanesPerHost===1?'formal-count-rhino-guarantee-20261001.json':'formal-sessions-rhino-two-20261001.json'):(profile.previousLanesPerHost===1?'formal-repair-pearl-awards-20261001.json':'formal-sessions-pearl-two-20261001.json');
  const parent=readFile('config/'+parentName);
  const path='repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRun.split(':')[0];
  const ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
  console.log(JSON.stringify(await activateSessionLayout({store,plans:basePlans,profile,parent,ended,jobs,commit,run,boundary})));
 }else if(mode==='repair'){
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.retirementRun.split(':')[0]);
  assert(ended.status==='completed'&&ended.conclusion==='success'&&ended.head_sha===profile.retirementCommit
   &&`${ended.id}:${ended.run_attempt}`===profile.retirementRun&&ended.path==='.github/workflows/demo-maintenance.yml','FORMAL_REPAIR_RETIREMENT_RUN');
  console.log(JSON.stringify(await activateFormalRepair({store,transport,parser,plans:basePlans,profile,
   oldProfile:readFile(profile.schema==='sg-formal-repair-profile-v2'?'config/formal-repair-pearl-20260930.json':'config/formal-count-pearl-20260930.json'),boundary,commit,run})));
 }else if(mode==='refresh'){
  const path='repos/zyzuoyang/sg-capture-runner/actions/runs/'+revision.sourceRun.split(':')[0];
  const ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
  const refresh=initialWindow?authorizeInitialCountRuntime:refreshCountRuntime;
  const verifyEntryFailure=ended.id===36839677352&&ended.conclusion==='failure'?readVerifyEntryFailure(ended,jobs):undefined;
  const initialReadFailure=fourReadRecovery?loadInitialReadFailure(ended,jobs):undefined;
  const parentTailFailure=ended.conclusion==='failure'&&!verifyEntryFailure&&!initialReadFailure&&!revision.sharedClosureKey&&!revision.networkClosureKey?readParentTailFailure(ended,jobs):undefined;
  if(profile.sessionLayout?.lanesPerHost===4&&!fourReadRecovery)await checkFourContinuousProof({store,plan,profile,revision});
  console.log(JSON.stringify(await refresh({store,plan,profile,revision,ended,jobs,commit,run,boundary,parentTailFailure,verifyEntryFailure,initialReadFailure,
   sharedCloseProfile:revision.sharedClosureKey?readFile('config/count-shared-rhino-ready-20261001.json'):undefined,
   networkCloseProfile:revision.networkClosureKey?readFile('config/count-network-rhino-canary-20261002.json'):undefined})));
 }else if(mode==='amend'){
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+revision.sourceRun.split(':')[0]);
  const jobs=await read(`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/jobs?filter=all&per_page=100`);
  console.log(JSON.stringify(await amendFormalRuntime({store,transport,plan,profile,revision,ended,jobs,commit,run,boundary})));
 }else if(mode==='activate'){
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRunKey.split(':')[1]);
  const jobs=await read(`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/jobs?filter=all&per_page=100`);
  checkDemoSourceEnded({ended,jobs,profile});assert(ended.conclusion==='success','FORMAL_COUNT_SOURCE_NOT_SUCCESSFUL');
  console.log(JSON.stringify(await activateFormalCount({store,transport,parser,plans:basePlans,profile,boundary,commit,run})));
 }else{
  await boundary();
  const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
  const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
  if(runtimeProfile){
   if(profile.sessionLayout?.lanesPerHost===4&&!fourReadRecovery)await checkFourContinuousProof({store,plan,profile,revision});
   const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${spec.activation}:${commit}`))?.value;
   assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.revisionHash===hash(revision),'COUNT_RUNTIME_REFRESH_NOT_APPLIED');
  }
  assert(pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target
   &&Object.values(pool.workers).every(w=>!w.activeBatch)&&c.enabled&&c.activeGame===plan.gameId&&!c.protocolValidation&&!c.validationLimit
   &&c.formalCount?.activation===profile.activation,'FORMAL_COUNT_NOT_READY');
  const key=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',key)),'FORMAL_COUNT_RUN_ALREADY_ADMITTED');
  const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,
   poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,createdAt:Date.now(),expiresAt:Date.now()+270*60000};
  if(canaryWindow||(profile.gameId===32799&&profile.schema==='sg-session-layout-rhino-v1'&&profile.sessionLayout?.lanesPerHost===4))permit.historyBoundary=countHistoryBoundary({pool,plan,spec});
  if(canaryWindow)await claimSessionCanary({store,plan,profile,revision,permit,inputs:canaryInputs});
  await store.create('journal',key,permit,{immutable:true});
  assert(hash((await store.get('journal',key))?.value)===hash(permit),'FORMAL_COUNT_RUN_READBACK');
  console.log(JSON.stringify({admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'FORMAL_COUNT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
