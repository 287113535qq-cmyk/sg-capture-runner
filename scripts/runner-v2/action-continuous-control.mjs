import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,checkActionContinuousRevision,admitActionContinuous} from './action-continuous-runtime.mjs';
import {refreshCountRuntime} from './count-runtime-refresh.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {pyramidsRepairPlan} from './pyramids-repair-profile.mjs';import {analyzer} from './analyzer.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner',
 'ACTION_CONTINUOUS_GITHUB_REQUIRED');
const mode=process.argv[2];assert(['refresh','admit'].includes(mode),'ACTION_CONTINUOUS_OPERATION');
const budget=process.env.SG_COUNT_RUNTIME_PROFILE===ACTION_BUDGET_CONTINUOUS_RUNTIME;
const runtimeName=budget?ACTION_BUDGET_CONTINUOUS_RUNTIME:ACTION_CONTINUOUS_RUNTIME;
assert(process.env.SG_COUNT_RUNTIME_PROFILE===runtimeName
 &&process.env.SG_FORMAL_COUNT_PROFILE===(budget?'formal-repair-pyramids-action-budget-20261002.json':'formal-repair-pyramids-action-20261002.json'),'ACTION_CONTINUOUS_PATH');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json');
const profile=load('config/'+process.env.SG_FORMAL_COUNT_PROFILE),revision=load('config/'+runtimeName);
const plan=pyramidsRepairPlan(plans[32721],profile);checkActionContinuousRevision({plan,profile,revision});
assert(Object.keys(revision.files??{}).length>=Object.keys(profile.files).length
 &&Object.keys(profile.files).every(p=>Object.hasOwn(revision.files,p)),'ACTION_CONTINUOUS_FILES_REQUIRED');
for(const [path,digest]of Object.entries(revision.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'ACTION_CONTINUOUS_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,
  'ACTION_CONTINUOUS_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
if(mode==='admit'){
 const i=load(process.env.GITHUB_EVENT_PATH).inputs;
 assert(i.role==='formal-count'&&i.allocation==='round-one'&&i.round_one_limit==='0'
  &&i.formal_profile===process.env.SG_FORMAL_COUNT_PROFILE&&i.runtime_profile===runtimeName
  &&i.formal_relay==='none'&&!i.relay_parent,'ACTION_CONTINUOUS_DISPATCH');
}
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000}),parser=analyzer({auditWorkers:2});
const github=countPeerBoundary({read,transport,run,commit,peer:profile.primaryPeer,selfGroup:'secondary',
 workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await github();await store.writable();
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 await checkPrimaryLeases({store,plans});
 const holds=await transport.request('global_holds');
 assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'ACTION_CONTINUOUS_NATIVE_CEILING');};
try{
 assert((await parser.call({op:'plan',plan})).validated===true,'ACTION_CONTINUOUS_PYTHON_PLAN');
 if(mode==='refresh'){
  const root='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+revision.sourceRun.split(':')[0];
  const ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  console.log(JSON.stringify(await refreshCountRuntime({store,plan,profile,revision,ended,jobs,commit,run,boundary})));
 }else{
  const permit=await admitActionContinuous({store,plan,profile,revision,commit,run,boundary});
  console.log(JSON.stringify({admitted:true,sourceRequests:0,completeBefore:permit.completeBefore,
   remainingComplete:permit.remainingComplete,captureMinutes:revision.captureMinutes,maxWorkers:20}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'ACTION_CONTINUOUS_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
