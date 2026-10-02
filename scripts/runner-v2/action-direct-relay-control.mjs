import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {DIRECT_ACTION_RELAY_RUNTIME,RESUME_ACTION_RELAY_RUNTIME,RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME,checkDirectRelayRevision,refreshDirectRelayRuntime,admitDirectRelay,relayDirectActionRun,directRelayWindow,directRelayCompleteDelta,directRelayTargetReached} from './action-direct-relay-runtime.mjs';
import {directCaptureJobs,loadDirectCaptureLogs,reviewDirectSourceResource} from './action-direct-resource.mjs';
import {DIRECT_ACTION_PROFILE,RESUME_ACTION_PROFILE,pyramidsDirectActionPlan} from './pyramids-direct-action-profile.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {analyzer} from './analyzer.mjs';import {formalRelayInputs,waitFormalRelayParent} from './formal-relay.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','DIRECT_RELAY_GITHUB');
const mode=process.argv[2];assert(['refresh','admit','relay'].includes(mode),'DIRECT_RELAY_OPERATION');
const resumed=process.env.SG_FORMAL_COUNT_PROFILE===RESUME_ACTION_PROFILE;
const profileName=resumed?RESUME_ACTION_PROFILE:DIRECT_ACTION_PROFILE;
const runtimeName=resumed&&[RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME].includes(process.env.SG_COUNT_RUNTIME_PROFILE)?process.env.SG_COUNT_RUNTIME_PROFILE:resumed?RESUME_ACTION_RELAY_RUNTIME:DIRECT_ACTION_RELAY_RUNTIME;
assert(process.env.SG_COUNT_RUNTIME_PROFILE===runtimeName&&process.env.SG_FORMAL_COUNT_PROFILE===profileName,'DIRECT_RELAY_PATH');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),plans=load('config/round-one-plans.json'),base=plans[32721];
const profile=load('config/'+profileName),revision=load('config/'+runtimeName);
const plan=pyramidsDirectActionPlan(base,profile);plans[32721]=plan;
checkDirectRelayRevision({base,plan,profile,revision});
assert(Object.keys(revision.files??{}).length>=Object.keys(profile.files).length
 &&Object.keys(profile.files).every(p=>Object.hasOwn(revision.files,p)),'DIRECT_RELAY_FILES');
for(const [path,digest]of Object.entries(revision.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'DIRECT_RELAY_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===digest,'DIRECT_RELAY_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const inputs=mode!=='refresh'?formalRelayInputs(load(process.env.GITHUB_EVENT_PATH).inputs):null;
if(inputs)assert(inputs.role==='formal-count'&&inputs.allocation==='round-one'&&inputs.round_one_limit==='0'
 &&inputs.formal_profile===profileName&&inputs.runtime_profile===runtimeName
 &&inputs.formal_relay==='same-allocation-v1','DIRECT_RELAY_DISPATCH');
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000}),parser=analyzer({auditWorkers:2});
const github=countPeerBoundary({read,transport,run,commit,peer:profile.primaryPeer,selfGroup:'secondary',
 workflowPath:mode==='refresh'?'.github/workflows/demo-maintenance.yml':'.github/workflows/trial-300k.yml'});
const boundary=async()=>{await github();await store.writable();await checkPrimaryLeases({store,plans});
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
 assert((await transport.request('rounds_scan',{trialId:plan.trialId,after:600000})).length===0,'DIRECT_RELAY_NATIVE_CEILING');};
let claimed=false;
async function api(path,method,body){
 const response=await fetch('https://api.github.com/repos/287113535qq-cmyk/sg-capture-runner/'+path,{method,
  headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 assert(response.ok,'DIRECT_RELAY_API_FAILED');
}
try{
 assert((await parser.call({op:'plan',plan})).validated===true,'DIRECT_RELAY_PYTHON_PLAN');
 if(mode==='refresh'){
  const root='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+revision.sourceRun.split(':')[0];
  const ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
  const previousRevision=[RESUME_ACTION_CONTINUOUS_RUNTIME,RESUME_ACTION_NETWORK_RUNTIME].includes(runtimeName)?load('config/'+revision.previousRevisionName):null;
  const parentEnded=previousRevision?await read('repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+revision.resourceRootRun.split(':')[0]):null;
  let recoveryResourceReview;
  if(revision.purpose==='direct-action-log-recovery-v1'){
   const logs=await loadDirectCaptureLogs({source:ended,jobs,commit:revision.fromCommit,verifyOnlyFailure:true});
   const permit=(await store.get('journal',`count-run:${plan.trialId}:${revision.sourceRun}`))?.value;
   const completeDelta=await directRelayCompleteDelta({store,trialId:plan.trialId,permit});
   recoveryResourceReview=reviewDirectSourceResource({run:revision.sourceRun,commit:revision.fromCommit,...logs,completeDelta});
  }
  const networkProfile=runtimeName===RESUME_ACTION_NETWORK_RUNTIME?load('config/count-network-pyramids-http-entryfix-20261002.json'):null;
  const receipt=await refreshDirectRelayRuntime({store,base,plan,profile,revision,previousRevision,parentEnded,recoveryResourceReview,networkProfile,ended,jobs,commit,run,boundary});
  console.log(JSON.stringify({refreshed:true,completePreserved:receipt.completePreserved,remainingComplete:receipt.remainingComplete,sourceRequests:0}));
 }else{
  if(mode==='admit'&&inputs.relay_parent)await waitFormalRelayParent({store,read,plan,profile,
   repository:process.env.GITHUB_REPOSITORY,commit,parentRun:inputs.relay_parent,inputs,selfRun:run});
  const key=`complete-count:${plan.trialId}:${profile.activation}`,get=async k=>(await store.get('journal',k))?.value;
  const binding={spec:await get(key),complete:await get(key+':complete'),
   receipt:await get(`count-runtime:${plan.trialId}:${profile.activation}:${commit}`)};
  if(mode==='admit'){
   const permit=await admitDirectRelay({store,base,plan,profile,revision,commit,run,parentRun:inputs.relay_parent,binding,boundary});
   console.log(JSON.stringify({admitted:true,completeBefore:permit.completeBefore,remainingComplete:permit.remainingComplete,
    windowIndex:permit.windowIndex,sourceRequests:0}));
  }else{
   const permit=await get(`count-run:${plan.trialId}:${run}`);
   directRelayWindow({base,plan,profile,revision,commit,run,permit,now:Date.now(),...binding});
   if(permit.windowIndex===2)console.log(JSON.stringify({continued:false,reason:'DIRECT_RELAY_WINDOW_LIMIT'}));
   else{
    const root='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+process.env.GITHUB_RUN_ID;
    const source=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
    directCaptureJobs({source,jobs,commit});
    if(await directRelayTargetReached({store,plan,spec:binding.spec}))
     console.log(JSON.stringify({continued:false,reason:'TARGET_REACHED'}));
    else{
    const logs=await loadDirectCaptureLogs({source,jobs,commit});
    const completeDelta=await directRelayCompleteDelta({store,trialId:plan.trialId,permit});
    const resourceReview=reviewDirectSourceResource({run,commit,...logs,completeDelta});
    console.log(JSON.stringify(await relayDirectActionRun({store,base,plan,profile,revision,commit,inputs,source,jobs,binding,
     resourceReview,repository:process.env.GITHUB_REPOSITORY,boundary,
     createIntent:async(k,v)=>{await store.writable();const r=await transport.request('create',{collection:'journal',key:k,value:v});claimed=r.created===true;return claimed;},
     dispatch:async({ref,inputs})=>{
      const branch=await read('repos/287113535qq-cmyk/sg-capture-runner/git/ref/heads/'+ref);
      assert(branch.object?.sha===commit,'DIRECT_RELAY_REF_CHANGED');
      await api('actions/workflows/trial-300k.yml/enable','PUT');
      try{await api('actions/workflows/trial-300k.yml/dispatches','POST',{ref,inputs});}
      finally{await api('actions/workflows/trial-300k.yml/disable','PUT');}
     }})));
    }
   }
  }
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z0-9_]{1,100}$/.test(e.message)?e.message:'DIRECT_RELAY_REQUIRES_REVIEW',intentCreated:claimed,sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
