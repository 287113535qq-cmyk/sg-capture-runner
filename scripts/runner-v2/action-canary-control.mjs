import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ACTION_CANARY_RUNTIME,checkActionCanaryInputs,checkActionCanaryRevision} from './action-canary-contract.mjs';
import {amendActionCanaryRuntime,admitActionCanary} from './action-canary-runtime.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {pyramidsRepairPlan} from './pyramids-repair-profile.mjs';import {analyzer} from './analyzer.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner',
 'ACTION_CANARY_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['amend','admit'].includes(mode),'ACTION_CANARY_OPERATION');
assert(process.env.SG_COUNT_RUNTIME_PROFILE===ACTION_CANARY_RUNTIME
 &&process.env.SG_FORMAL_COUNT_PROFILE==='formal-repair-pyramids-action-20261002.json','ACTION_CANARY_PATH');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json');
const profile=load('config/'+process.env.SG_FORMAL_COUNT_PROFILE),revision=load('config/'+ACTION_CANARY_RUNTIME);
const plan=pyramidsRepairPlan(plans[32721],profile);checkActionCanaryRevision({plan,profile,revision});
assert(Object.keys(revision.files??{}).length>=804,'ACTION_CANARY_RUNTIME_FILES');
for(const [path,digest]of Object.entries(revision.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'ACTION_CANARY_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,
  'ACTION_CANARY_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
if(mode==='admit')checkActionCanaryInputs(load(process.env.GITHUB_EVENT_PATH).inputs);
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000}),parser=analyzer({auditWorkers:2});
const github=countPeerBoundary({read,transport,run,commit,peer:profile.primaryPeer,selfGroup:'secondary',
 workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await github();await store.writable();
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'ACTION_CANARY_NATIVE_CEILING');};
try{
 assert((await parser.call({op:'plan',plan})).validated===true,'ACTION_CANARY_PYTHON_PLAN');
 if(mode==='amend'){
  const root='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/36969614155';
  const ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  console.log(JSON.stringify(await amendActionCanaryRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary})));
 }else{
  const permit=await admitActionCanary({store,plan,profile,revision,commit,run,boundary});
  console.log(JSON.stringify({admitted:true,sourceRequests:0,completeBefore:permit.completeBefore,
   remainingComplete:permit.remainingComplete,captureMinutes:5,maxBatchesPerWorker:1,maxWorkers:20}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'ACTION_CANARY_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
