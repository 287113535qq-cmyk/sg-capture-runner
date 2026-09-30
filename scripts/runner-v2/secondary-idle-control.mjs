import {closeInterruptedPilot} from './demo-interrupted-close.mjs';
import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {secondaryParallelBoundary,secondaryRepository} from './secondary-parallel-boundary.mjs';
import {checkSecondaryIdleProfile} from './secondary-idle-profile.mjs';
import {importParkedDemo} from './parked-import.mjs';import {decodeParkedArchive} from './parked-decoder.mjs';
import {activateSecondaryIdle} from './secondary-idle.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {checkSecondaryAmendment,checkSecondaryFailedAdmission,rebindSecondaryUnstarted} from './secondary-zero-source.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
assert(process.env.SG_DEMO_PILOT_PROFILE==='demo-pilot-inca-20261001.json','SECONDARY_PROFILE_PATH');
const mode=process.argv[2];assert(['activate','admit','close-interrupted'].includes(mode),'SECONDARY_OPERATION');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json'),profile=load('config/demo-pilot-inca-20261001.json');
checkSecondaryIdleProfile(profile,plans[32719]);
const amendment=fs.existsSync('config/demo-runtime-inca-20261001.json')?load('config/demo-runtime-inca-20261001.json'):null;
if(amendment)checkSecondaryAmendment(amendment,profile);
assert(profile.files&&Object.keys(profile.files).length>300,'SECONDARY_FILES_REQUIRED');
if(amendment)assert(Object.keys(profile.files).every(p=>Object.hasOwn(amendment.files,p)),'SECONDARY_AMEND_FILES_MISSING');
for(const [path,expected] of Object.entries(amendment?.files||profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'SECONDARY_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'SECONDARY_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,transport=connectGateway(),gate=new ResourceGate(),
 store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer(),read=authenticatedRead(process.env.GH_TOKEN);
const github=secondaryParallelBoundary({read,transport,run,commit,workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{
 assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt,'SECONDARY_PROFILE_STALE');
 await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});
};
try{
 if(mode==='activate'){
  await boundary();await importParkedDemo({store,transport,decode:decodeParkedArchive,plan:plans[32719],profile,boundary,commit,run});
  console.log(JSON.stringify(await activateSecondaryIdle({store,transport,gate,parser,plans,profile,boundary,commit,run})));
 }else if(mode==='close-interrupted'){
  const close=load('config/demo-close-inca-20261001.json'),basePlan=plans[32719],plan=applyDemoPilot(plans,profile)[32719];
  assert(close.group==='secondary'&&close.gameId===32719&&close.workerOffset===20&&close.sourceProfileHash===hash(profile)
   &&close.sourceConclusion==='failure'&&close.schema==='sg-demo-pilot-close-v2'&&close.newBetAllowance===0,'SECONDARY_CLOSE_SCOPE');
  const closeBoundary=async()=>{
   assert(Date.now()>=close.createdAt&&Date.now()<close.expiresAt,'SECONDARY_CLOSE_STALE');
   await github();await store.writable();await checkPrimaryLeases({store,plans});
   const sourceId=close.sourceRunKey?.match(/^capture-run:([0-9]+):1$/)?.[1];assert(sourceId,'SECONDARY_CLOSE_SOURCE');
   const prefix=`repos/${secondaryRepository}/actions/runs/${sourceId}`,ended=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
   checkDemoSourceEnded({ended,jobs,profile:close,closing:true,repository:secondaryRepository});
  };
  console.log(JSON.stringify(await closeInterruptedPilot({store,transport,parser,basePlan,plan,profile:close,boundary:closeBoundary,commit,run})));
 }else{
  await boundary();const plan=applyDemoPilot(plans,profile)[32719],key=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
  if(amendment){
   const failedPrefix=`repos/${secondaryRepository}/actions/runs/36764738887`;
   checkSecondaryFailedAdmission(await read(failedPrefix),await read(failedPrefix+'/jobs?filter=all&per_page=100'),amendment);
   const old=(await store.get('state','campaign'))?.value;
   if(!old?.protocolValidation?.runtimeRebind)await rebindSecondaryUnstarted({store,transport,parser,basePlan:plans[32719],plan,original:profile,profile:amendment,boundary,commit,run});
   else assert(old.protocolValidation.runtimeRebind.profileHash===hash(amendment),'SECONDARY_AMENDMENT_CHANGED');
  }
  const completed=(await store.get('journal',key+':complete'))?.value,c=(await store.get('state','campaign'))?.value,
   pool=(await store.get('state','pool:'+plan.trialId))?.value,spec=(await store.get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`))?.value;
  assert(completed?.schema==='sg-next-demo-game-complete-v1'&&completed.profileHash===hash(profile)&&completed.commit===spec?.commit
   &&completed.generation===plan.demoGeneration&&completed.newBetAllowance===100&&completed.sourceRequests===0
   &&completed.group==='secondary'&&completed.workerOffset===20&&c?.group==='secondary'&&c.activeGame===32719&&c.enabled
   &&c.protocolValidation?.commit===commit&&(await demoRuntimeCommit({store,plan,spec,campaign:c}))===commit&&c.protocolValidation.generation===plan.demoGeneration&&c.protocolValidation.runKey===null
   &&pool?.enabled&&!pool.failure&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
   &&pool.nextBatchId===spec?.firstBatchId&&Object.keys(pool.workers).length===0
   &&spec.group==='secondary'&&spec.workerOffset===20&&spec.activationStage?.profileHash===hash(profile),'SECONDARY_ADMISSION_INCOMPLETE');
  const maintenance=await read(`repos/${secondaryRepository}/actions/runs/${completed.run.split(':')[0]}`);
  assert(maintenance.run_attempt===1&&maintenance.head_sha===spec.commit&&maintenance.status==='completed'&&maintenance.conclusion==='success'
   &&maintenance.path==='.github/workflows/demo-maintenance.yml'&&maintenance.repository?.full_name===secondaryRepository,'SECONDARY_MAINTENANCE_NOT_SUCCESS');
  await boundary();await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'SECONDARY_CAMPAIGN_CHANGED');return {...v,protocolValidation:{...v.protocolValidation,runKey:'capture-run:'+run}};});
  const after=(await store.get('state','campaign'))?.value;assert(after?.protocolValidation?.runKey==='capture-run:'+run,'SECONDARY_ADMISSION_READBACK');
  console.log(JSON.stringify({schema:'sg-secondary-idle-admission-v1',gameId:32719,newBetAllowance:100,sourceRequests:0,run}));
 }
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'SECONDARY_IDLE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
