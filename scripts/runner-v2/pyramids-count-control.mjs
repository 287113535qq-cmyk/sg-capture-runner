import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {secondaryParallelBoundary,secondaryRepository} from './secondary-parallel-boundary.mjs';
import {pyramidsCountPlan,reviewPyramidsPilotJobs} from './pyramids-count-profile.mjs';import {activatePyramidsCount} from './pyramids-count-activation.mjs';
import {loadCountPermission,checkLedger} from './complete-count.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===secondaryRepository,'SECONDARY_GITHUB_REQUIRED');
assert(process.env.SG_FORMAL_COUNT_PROFILE==='formal-count-pyramids-20261001.json','PYRAMIDS_COUNT_PROFILE_PATH');
const mode=process.argv[2];assert(['activate','admit'].includes(mode),'PYRAMIDS_COUNT_OPERATION');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/formal-count-pyramids-20261001.json'),plans=load('config/round-one-plans.json'),plan=pyramidsCountPlan(plans[32721],profile);
assert(Object.keys(profile.files??{}).length>500,'PYRAMIDS_COUNT_FILES');
for(const [p,h] of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'PYRAMIDS_COUNT_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'PYRAMIDS_COUNT_RUNTIME_CHANGED');}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const github=secondaryParallelBoundary({read,transport,run,commit,workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'PYRAMIDS_COUNT_NATIVE_CEILING');};
try{
 if(mode==='activate'){
  const root=`repos/${secondaryRepository}/actions/runs/36774221164`,source=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  assert(source.id===36774221164&&source.run_attempt===1&&source.repository?.full_name===secondaryRepository&&source.event==='workflow_dispatch'
   &&source.path==='.github/workflows/trial-300k.yml'&&source.head_sha===profile.sourceCommit&&source.status==='completed'&&source.conclusion==='success','PYRAMIDS_COUNT_SOURCE_RUN');
  reviewPyramidsPilotJobs(jobs);
  console.log(JSON.stringify(await activatePyramidsCount({store,transport,parser,plans,profile,boundary,commit,run})));
 }else{
  await boundary();const pool=(await store.get('state','pool:'+plan.trialId))?.value,c=(await store.get('state','campaign'))?.value;
  const spec=await loadCountPermission({store,plan,pool,commit}),ledger=checkLedger(pool,plan,spec);
  assert(pool.enabled&&!pool.failure&&ledger.reserved===0&&pool.confirmed<plan.target&&Object.values(pool.workers).every(w=>!w.activeBatch)
   &&c.group==='secondary'&&c.enabled&&c.activeGame===32721&&!c.protocolValidation&&!c.validationLimit
   &&c.formalCount?.activation===profile.activation&&c.formalCount.profileHash===hash(profile),'PYRAMIDS_COUNT_NOT_READY');
  const key=`count-run:${plan.trialId}:${run}`;assert(!(await store.get('journal',key)),'PYRAMIDS_COUNT_RUN_ALREADY_ADMITTED');
  const permit={schema:'sg-count-run-v1',activation:profile.activation,profileHash:hash(profile),commit,run,poolHash:hash(pool),completeBefore:pool.confirmed,remainingComplete:plan.target-pool.confirmed,createdAt:Date.now(),expiresAt:Date.now()+270*60000};
  await store.create('journal',key,permit,{immutable:true});assert(hash((await store.get('journal',key))?.value)===hash(permit),'PYRAMIDS_COUNT_RUN_READBACK');
  console.log(JSON.stringify({admitted:true,completeBefore:pool.confirmed,remainingComplete:permit.remainingComplete,sourceRequests:0}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'PYRAMIDS_COUNT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
