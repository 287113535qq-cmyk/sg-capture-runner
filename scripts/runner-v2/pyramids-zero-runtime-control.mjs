import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {secondaryParallelBoundary,secondaryRepository,observationPrimary} from './secondary-parallel-boundary.mjs';
import {pyramidsRepairPlan} from './pyramids-repair-profile.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
import {amendZeroSourceCountRuntime} from './count-zero-source-runtime.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['amend','admit'].includes(mode),'COUNT_ZERO_RUNTIME_OPERATION');
assert(process.env.SG_FORMAL_COUNT_PROFILE==='formal-repair-pyramids-coins-20261001.json'
 &&process.env.SG_COUNT_RUNTIME_PROFILE==='count-runtime-pyramids-session-20261001.json','COUNT_ZERO_RUNTIME_PATH');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json');
const profile=load('config/formal-repair-pyramids-coins-20261001.json'),revision=load('config/count-runtime-pyramids-session-20261001.json');
assert(hash(profile)==='93fef71918ebb6ad0d08e546b3ec13a2964b8493b8f860306e99564899808533','COUNT_ZERO_FROZEN_PROFILE');
assert(Object.keys(revision.files??{}).length>548,'COUNT_ZERO_RUNTIME_FILES');
for(const [path,digest]of Object.entries(revision.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'COUNT_ZERO_RUNTIME_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,'COUNT_ZERO_RUNTIME_CHANGED');
}
const plan=pyramidsRepairPlan(plans[32721],profile),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000});
const github=secondaryParallelBoundary({read,transport,run,commit,primaryRun:observationPrimary,
 workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'PYRAMIDS_COUNT_NATIVE_CEILING');};
try{
 if(mode==='amend'){
  const root=`repos/${secondaryRepository}/actions/runs/36788992387`,ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  console.log(JSON.stringify(await amendZeroSourceCountRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary})));
 }else{
  await boundary();const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
  const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
  const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${spec.activation}:${commit}`))?.value;
  assert(receipt?.schema==='sg-count-runtime-v2'&&receipt.zeroRegistration===true&&receipt.revisionHash===hash(revision)
   &&pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target
   &&Object.values(pool.workers).every(w=>!w.activeBatch)&&c.enabled&&c.activeGame===32721
   &&!c.protocolValidation&&!c.validationLimit&&c.formalCount?.activation===profile.activation,'COUNT_ZERO_RUNTIME_NOT_READY');
  const key=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',key)),'COUNT_RUN_ALREADY_ADMITTED');
  const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,poolHash:hash(pool),
   completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,createdAt:Date.now(),expiresAt:Date.now()+270*60000};
  await store.create('journal',key,permit,{immutable:true});assert(hash((await store.get('journal',key))?.value)===hash(permit),'COUNT_RUN_READBACK');
  console.log(JSON.stringify({admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'COUNT_ZERO_RUNTIME_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{transport.close();}
