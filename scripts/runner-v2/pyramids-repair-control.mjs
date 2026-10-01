import {waitFormalRelayParent,formalRelayInputs} from './formal-relay.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {secondaryParallelBoundary,secondaryRepository,observationPrimary} from './secondary-parallel-boundary.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';
import {pyramidsCountPlan} from './pyramids-count-profile.mjs';import {pyramidsRepairPlan} from './pyramids-repair-profile.mjs';
import {retireStoppedFormal} from './formal-stopped-retire.mjs';import {activateFormalRepair} from './formal-repair-activation.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {pyramidsRepairEntry} from './pyramids-repair-entry.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['retire','activate','admit'].includes(mode),'PYRAMIDS_REPAIR_OPERATION');
const entry=pyramidsRepairEntry(mode,process.env.SG_FORMAL_COUNT_PROFILE,process.env.SG_FORMAL_RETIRE_PROFILE),{oldName,newName}=entry;
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json'),oldProfile=load('config/'+oldName);
const profile=load('config/'+(mode==='retire'?entry.retireName:newName));
const plan=mode==='retire'?(entry.v2?pyramidsRepairPlan(plans[32721],oldProfile):pyramidsCountPlan(plans[32721],oldProfile)):pyramidsRepairPlan(plans[32721],profile);
assert(Object.keys(profile.files??{}).length>500,'PYRAMIDS_REPAIR_FILES');
for(const [p,h] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'PYRAMIDS_REPAIR_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'PYRAMIDS_REPAIR_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer({env:{...process.env,SG_FORMAL_COUNT_PROFILE:entry.parserProfile}});
assert(!profile.primaryPeer||entry.v2,'PYRAMIDS_PEER_PROFILE_SCOPE');
assert(!entry.v3||profile.primaryPeer,'PYRAMIDS_MAJOR_PEER_REQUIRED');
const workflowPath=mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml';
const github=profile.primaryPeer?countPeerBoundary({read,transport,run,commit,peer:profile.primaryPeer,selfGroup:'secondary',workflowPath}):
 secondaryParallelBoundary({read,transport,run,commit,primaryRun:entry.primaryRun,allowEndedPrimary:entry.allowEndedPrimary,workflowPath});
const boundary=async()=>{await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'PYRAMIDS_COUNT_NATIVE_CEILING');};
try{
 if(mode==='admit'&&process.env.SG_COUNT_RELAY_PARENT)await waitFormalRelayParent({store,read,plan,profile,repository:process.env.GITHUB_REPOSITORY,commit,parentRun:process.env.SG_COUNT_RELAY_PARENT,selfRun:run,inputs:formalRelayInputs(JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).inputs)});
 assert((await parser.call({op:'plan',plan})).validated===true,'PYRAMIDS_PYTHON_PLAN_REQUIRED');
 if(mode==='retire'){
  if(profile.beforeOnlyRecovery){
   const parent=load('config/formal-retire-pyramids-display-20261001.json');
   assert(hash(parent)==='70121cfdae107ad68f1b89bdce1ce62e6f41d2a0c477985c283d2e11a1348aa0'
    &&profile.parentRetirementProfileHash===hash(parent),'BEFORE_ONLY_PARENT_PROFILE');
   const strip=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['files','createdAt','expiresAt','beforeOnlyRecovery','parentRetirementProfileHash'].includes(k)));
   assert(hash(strip(parent))===hash(strip(profile)),'BEFORE_ONLY_PARENT_CHANGED');
   const root=`repos/${secondaryRepository}/actions/runs/36840426858`,prior=await read(root),priorJobs=await read(root+'/jobs?filter=all&per_page=100');
   assert(prior.id===36840426858&&prior.run_attempt===1&&prior.status==='completed'&&prior.conclusion==='failure'
    &&prior.head_sha==='e4afdf6aeca450710651a07ad66cf1255474d537'&&prior.repository?.full_name===secondaryRepository
    &&prior.path==='.github/workflows/demo-maintenance.yml'&&prior.event==='workflow_dispatch'
    &&priorJobs.total_count===priorJobs.jobs.length&&priorJobs.total_count<100
    &&priorJobs.jobs.filter(j=>j.name==='pyramids-repair'&&j.status==='completed'&&j.conclusion==='failure').length===1
    &&priorJobs.jobs.filter(j=>j.name!=='pyramids-repair').every(j=>j.status==='completed'&&j.conclusion==='skipped'),'BEFORE_ONLY_FAILED_RUN');
  }
  const root=`repos/${secondaryRepository}/actions/runs/${entry.sourceId}`,ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  assert(ended.id===entry.sourceId&&ended.run_attempt===1&&ended.event==='workflow_dispatch'&&ended.path==='.github/workflows/trial-300k.yml','PYRAMIDS_REPAIR_SOURCE_IDENTITY');
  console.log(JSON.stringify(await retireStoppedFormal({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run})));
 }else if(mode==='activate'){
  console.log(JSON.stringify(await activateFormalRepair({store,transport,parser,plans,profile,oldProfile,boundary,commit,run})));
 }else{
  await boundary();const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
  const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
  assert(pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target&&Object.values(pool.workers).every(w=>!w.activeBatch)
   &&c.group==='secondary'&&c.enabled&&c.activeGame===32721&&!c.protocolValidation&&!c.validationLimit
   &&c.formalCount?.activation===profile.activation&&c.formalCount.profileHash===hash(profile),'PYRAMIDS_REPAIR_NOT_READY');
  const key=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',key)),'PYRAMIDS_REPAIR_RUN_ALREADY_ADMITTED');
  const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,poolHash:hash(pool),
   completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,createdAt:Date.now(),expiresAt:Date.now()+270*60000};
  await store.create('journal',key,permit,{immutable:true});assert(hash((await store.get('journal',key))?.value)===hash(permit),'PYRAMIDS_REPAIR_RUN_READBACK');
  console.log(JSON.stringify({admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'PYRAMIDS_REPAIR_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
