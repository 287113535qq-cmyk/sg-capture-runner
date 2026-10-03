// Source-free maintenance only. A reviewed publication does not mint permission.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {activatePreparedCount} from './prepared-count-activation.mjs';
import {connectGateway} from './transport.mjs';
import {RunnerState} from './state-store.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {authenticatedRead} from './github-boundary.mjs';
import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {preparedRuntimePath,preparedRuntimeAuthorization,amendPreparedZeroRuntime,amendPreparedSettledRuntime} from './prepared-count-runtime.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner',
 'PREPARED_COUNT_OWNER');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),name=process.env.SG_FORMAL_COUNT_PROFILE;
const authorization=preparedCountAuthorization(name),profile=read('config/'+name),plans=read('config/round-one-plans.json');
assert(profile.group==='primary'&&authorization.group==='primary','PREPARED_COUNT_OWNER');
const runtimeName=process.env.SG_COUNT_RUNTIME_PROFILE;
const runtimeRegistry=read('config/prepared-runtime-authorizations.json');
const revision=runtimeName?preparedRuntimeAuthorization({name:runtimeName,revision:read(preparedRuntimePath(runtimeName,runtimeRegistry)),
 registry:runtimeRegistry,profile}):null;
const files=revision?.files??profile.files;
assert(files&&Object.keys(files).length>=300,'PREPARED_COUNT_RUNTIME_MANIFEST');
for(const [file,digest] of Object.entries(files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(file)&&!file.includes('..'),
  'PREPARED_COUNT_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,
  'PREPARED_COUNT_RUNTIME_CHANGED');
}
const base=plans[profile.gameId],commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+15*60000});
const parser=analyzer({env:offlineAnalysisEnvironment(process.cwd(),base)});
const idle=maintenanceBoundary({read:authenticatedRead(process.env.GH_TOKEN),store,
 oldProfile:read('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
try{
 const boundary=async()=>{
  await idle();await store.writable();
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');
  assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
  assert((await transport.request('rounds_scan',{trialId:base.trialId,after:profile.maxSequence})).length===0,
   'PREPARED_COUNT_NATIVE_CEILING');
 };
 const updateRuntime=revision?.schema==='sg-prepared-settled-runtime-v1'?amendPreparedSettledRuntime:amendPreparedZeroRuntime;
 console.log(JSON.stringify(revision?await updateRuntime({store,plan:preparedCountPlan(base,profile,authorization),
  profile,revision,boundary,commit,run}):await activatePreparedCount({store,transport,parser,base,plans,profile,authorization,
  publication:read('config/prepared-inventory.json'),group:'primary',readEvidence:async ref=>read(ref),boundary,commit,run})));
}finally{parser.close();transport.close();}
