import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkSecondaryNextProfile} from './secondary-next-profile.mjs';
import {secondaryParallelBoundary,secondaryRepository} from './secondary-parallel-boundary.mjs';
import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {pilotCloseScene,readClosedPilot} from './demo-pilot-close.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {importParkedDemo} from './parked-import.mjs';import {decodeParkedArchive} from './parked-decoder.mjs';
import {nextDemoGame} from './demo-next-game.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {closeInterruptedPilot} from './demo-interrupted-close.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
assert(process.env.SG_DEMO_PILOT_PROFILE==='demo-pilot-pyramids-20261001.json','SECONDARY_NEXT_PROFILE_PATH');
const mode=process.argv[2];assert(['activate','admit','close-interrupted'].includes(mode),'SECONDARY_NEXT_OPERATION');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-pilot-pyramids-20261001.json'),plans=load('config/round-one-plans.json');
checkSecondaryNextProfile(profile,plans[32721]);
assert(Object.keys(profile.files??{}).length>400,'SECONDARY_NEXT_FILES_REQUIRED');
for(const [path,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'SECONDARY_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'SECONDARY_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN),
 transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const github=secondaryParallelBoundary({read,transport,run,commit,workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{
 assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'SECONDARY_NEXT_STALE');
 await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});
};
try{
 if(mode==='activate'){
  const endedPrefix=`repos/${secondaryRepository}/actions/runs/36765916285`;
  const ended=await read(endedPrefix),jobs=await read(endedPrefix+'/jobs?filter=all&per_page=100');
  checkDemoSourceEnded({ended,jobs,profile,repository:secondaryRepository});
  const fromPlan={...plans[32719],demoGeneration:profile.sourceGeneration};
  const source=await pilotCloseScene(store,fromPlan);
  await readClosedPilot({store,plan:fromPlan,profile,scene:{campaign:source.campaign,fromPool:source.pool,sourceBatches:source.batches}});
  await boundary();
  await importParkedDemo({store,transport,decode:decodeParkedArchive,plan:plans[32721],profile,boundary,commit,run});
  console.log(JSON.stringify(await nextDemoGame({store,transport,gate,parser,plans,profile,boundary,commit,run})));
 }else if(mode==='close-interrupted'){
  const close=load('config/demo-close-pyramids-20261001.json'),basePlan=plans[32721],plan=applyDemoPilot(plans,profile)[32721];
  assert(close.group==='secondary'&&close.gameId===32721&&close.workerOffset===20&&close.sourceProfileHash===hash(profile)
   &&close.sourceConclusion==='failure'&&close.schema==='sg-demo-pilot-close-v2'&&close.newBetAllowance===0,'SECONDARY_CLOSE_SCOPE');
  const closeBoundary=async()=>{
   assert(close.createdAt<=Date.now()&&Date.now()<close.expiresAt,'SECONDARY_CLOSE_STALE');
   await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
   await checkPrimaryLeases({store,plans});
   const sourceId=close.sourceRunKey?.match(/^capture-run:([0-9]+):1$/)?.[1];assert(sourceId,'SECONDARY_CLOSE_SOURCE');
   const prefix=`repos/${secondaryRepository}/actions/runs/${sourceId}`;
   checkDemoSourceEnded({ended:await read(prefix),jobs:await read(prefix+'/jobs?filter=all&per_page=100'),profile:close,closing:true,repository:secondaryRepository});
  };
  console.log(JSON.stringify(await closeInterruptedPilot({store,transport,parser,basePlan,plan,profile:close,boundary:closeBoundary,commit,run})));
 }else{
  await boundary();const plan=applyDemoPilot(plans,profile)[32721],key=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
  const completed=(await store.get('journal',key+':complete'))?.value,c=(await store.get('state','campaign'))?.value,
   pool=(await store.get('state','pool:'+plan.trialId))?.value,spec=(await store.get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`))?.value,
   specDone=(await store.get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`))?.value;
  assert(completed?.schema==='sg-next-demo-game-complete-v1'&&completed.profileHash===hash(profile)&&completed.commit===commit
   &&completed.generation===plan.demoGeneration&&completed.newBetAllowance===100&&completed.sourceRequests===0
   &&completed.completePreserved===1262&&completed.abandonedAttempts===4&&completed.group==='secondary'&&completed.workerOffset===20
   &&c?.group==='secondary'&&c.activeGame===32721&&c.enabled&&c.protocolValidation?.commit===commit
   &&c.protocolValidation.generation===plan.demoGeneration&&c.protocolValidation.runKey===null
   &&pool?.enabled&&!pool.failure&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
   &&pool.nextBatchId===spec?.firstBatchId&&Object.keys(pool.workers).length===0
   &&spec.commit===commit&&spec.run===completed.run&&spec.group==='secondary'&&spec.workerOffset===20&&spec.newBetAllowance===100
   &&spec.activationStage?.profileHash===hash(profile)&&specDone?.specHash===hash(spec)&&specDone.commit===commit,'SECONDARY_NEXT_ADMISSION_INCOMPLETE');
  const maintenance=await read(`repos/${secondaryRepository}/actions/runs/${completed.run.split(':')[0]}`);
  assert(maintenance.run_attempt===1&&maintenance.head_sha===commit&&maintenance.status==='completed'&&maintenance.conclusion==='success'
   &&maintenance.path==='.github/workflows/demo-maintenance.yml'&&maintenance.repository?.full_name===secondaryRepository,'SECONDARY_MAINTENANCE_NOT_SUCCESS');
  await boundary();await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'SECONDARY_CAMPAIGN_CHANGED');return{...v,protocolValidation:{...v.protocolValidation,runKey:'capture-run:'+run}};});
  assert((await store.get('state','campaign'))?.value.protocolValidation?.runKey==='capture-run:'+run,'SECONDARY_ADMISSION_READBACK');
  console.log(JSON.stringify({schema:'sg-secondary-next-admission-v1',gameId:32721,newBetAllowance:100,sourceRequests:0,run}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'SECONDARY_NEXT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
