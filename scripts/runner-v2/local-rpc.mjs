import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';
import {BatchController} from './batch-controller.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {localSpool} from './local-spool.mjs';
import {readResourceHandoff} from './resource-handoff.mjs';
import {HostResourceObservation} from './host-resource-observation.mjs';
import fs from 'node:fs';
import {sessionCanarySchedule,waitCanaryLane,isSessionCanaryRuntime} from './session-canary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {formalCountProfilePath} from './formal-count-plan.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';
import {stateWriteInitializer} from './state-write-binding.mjs';
import {ACTION_CANARY_RUNTIME,actionCanaryWindow} from './action-canary-contract.mjs';
import {ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME,actionContinuousWindow} from './action-continuous-runtime.mjs';
import {RESUME_ACTION_PROFILE,DIRECT_ACTION_PROFILE} from './pyramids-direct-action-profile.mjs';
import {DIRECT_ACTION_RELAY_RUNTIME,DIRECT_ACTION_RELAY_RUNTIMES,directRelayWindow} from './action-direct-relay-runtime.mjs';
import {ACTION_BUDGET_PROFILE} from './pyramids-action-budget-profile.mjs';
import {budgetCanaryWindow} from './action-budget-canary.mjs';
import {observeBudgetWindow} from './action-budget-observation.mjs';

export function connectLocal(plan){
  const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer(),rawSpool=localSpool();
  const resourceReady=readResourceHandoff(gate);
  const hostResources=new HostResourceObservation();hostResources.start();
  const localStages={};
  const observe=(key,at)=>{try{const m=localStages[key]??={calls:0,totalMs:0};m.calls++;m.totalMs+=performance.now()-at;}catch{}};
  const timedParser={call:async fields=>{const at=performance.now();
    try{return await parser.call(fields);}finally{observe('analyzer.'+(['next','record','intent'].includes(fields.op)?fields.op:'other'),at);}}};
  const spool={...rawSpool};
  for(const key of ['append','confirmed'])spool[key]=(...args)=>{const at=performance.now();
    try{return rawSpool[key](...args);}finally{observe('spool.'+key,at);}};
  // Source stops opening rounds at the worker deadline. Its already issued
  // natural feature still needs durable responses and final Mongo readback.
  const tailMs=plan.countAllocation?10*60000:0;
  const store=new RunnerState({transport,gate,deadline:Date.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000+tailMs});
  const control=new SourceControl({store,transport,gate,plan});
  const controller=new BatchController({store,transport,gate,analyzer:timedParser,spool,control,plan,
    group:repositories[process.env.GITHUB_REPOSITORY].name,pendingFirstStage:process.env.SG_PENDING_FIRST_STAGE,
    runKey:`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`});
  const ensureControlMode=compactControlInitializer({plan,runtimeName:process.env.SG_COUNT_RUNTIME_PROFILE,
    commit:process.env.GITHUB_SHA,resourceReady,control,
    readRevision:name=>JSON.parse(fs.readFileSync('config/'+name,'utf8')),
    readProfile:()=>JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')),
    readReceipt:async key=>(await store.get('journal',key))?.value});
  const ensureStateWrite=stateWriteInitializer({store,commit:process.env.GITHUB_SHA,
    runtimeName:process.env.SG_COUNT_RUNTIME_PROFILE,
    readRevision:name=>JSON.parse(fs.readFileSync('config/'+name,'utf8')),
    group:repositories[process.env.GITHUB_REPOSITORY].name,resourceReady,
    readProfile:()=>JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'))});
  let budgetObservationEnd;
  return {async canaryReady(shouldStop){
    await ensureControlMode();
    if(DIRECT_ACTION_RELAY_RUNTIMES.includes(process.env.SG_COUNT_RUNTIME_PROFILE)){
      await resourceReady;
      const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load(formalCountProfilePath());
      const base=load('config/round-one-plans.json')[32721],revision=load('config/'+process.env.SG_COUNT_RUNTIME_PROFILE);
      const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
      const key=`complete-count:${plan.trialId}:${plan.countAllocation}`,read=async k=>(await store.get('journal',k))?.value;
      return directRelayWindow({base,plan,profile,revision,commit,run,spec:await read(key),complete:await read(key+':complete'),
        receipt:await read(`count-runtime:${plan.trialId}:${plan.countAllocation}:${commit}`),
        permit:await read(`count-run:${plan.trialId}:${run}`),now:Date.now()});
    }
    if([ACTION_BUDGET_PROFILE,DIRECT_ACTION_PROFILE,RESUME_ACTION_PROFILE].includes(process.env.SG_FORMAL_COUNT_PROFILE)&&!process.env.SG_COUNT_RUNTIME_PROFILE){
      await resourceReady;
      const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'));
      const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
      const key=`complete-count:${plan.trialId}:${plan.countAllocation}`,read=async k=>(await store.get('journal',k))?.value;
      const proof={plan,profile,commit,run,spec:await read(key),complete:await read(key+':complete'),
        permit:await read(`count-run:${plan.trialId}:${run}`)};
      const window=budgetCanaryWindow({...proof,now:Date.now()});
      controller.actionCanaryProof=proof;budgetObservationEnd=Date.now()+profile.canary.observationMinutes*60000;
      return window;
    }
    if([ACTION_CANARY_RUNTIME,ACTION_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_RUNTIME,ACTION_BUDGET_CONTINUOUS_ENTRYFIX_RUNTIME].includes(process.env.SG_COUNT_RUNTIME_PROFILE)){
      await resourceReady;
      const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'));
      const revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8'));
      const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
      const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
      const read=async k=>(await store.get('journal',k))?.value;
      const proof={plan,profile,revision,commit,run,spec:await read(key),complete:await read(key+':complete'),
        receipt:await read(`count-runtime:${plan.trialId}:${plan.countAllocation}:${commit}`),
        permit:await read(`count-run:${plan.trialId}:${run}`)};
      const bounded=process.env.SG_COUNT_RUNTIME_PROFILE===ACTION_CANARY_RUNTIME;
      const window=(bounded?actionCanaryWindow:actionContinuousWindow)({...proof,now:Date.now()});
      if(bounded)controller.actionCanaryProof=proof;
      return window;
    }
    if(!process.env.SG_CANARY_SCHEDULE){
      if(isSessionCanaryRuntime(process.env.SG_COUNT_RUNTIME_PROFILE))throw Error('CANARY_SCHEDULE_MISSING');
      return null;
    }
    if(!isSessionCanaryRuntime(process.env.SG_COUNT_RUNTIME_PROFILE)||plan.gameId!==32799)throw Error('CANARY_WORKER_SCOPE');
    await resourceReady;
    const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'));
    const revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8'));
    const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
    const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${commit}`))?.value;
    const permit=(await store.get('journal',`count-run:${plan.trialId}:${run}`))?.value;
    const schedule=sessionCanarySchedule({profile,revision,receipt,permit,commit,run});
    if(hash(schedule)!==hash(JSON.parse(process.env.SG_CANARY_SCHEDULE)))throw Error('CANARY_WORKER_BINDING');
    controller.canarySchedule=schedule;
    const slot=Number(process.env.SG_TRIAL_SHARD)+40*Number(process.env.SG_SESSION_LANE);
    return waitCanaryLane({schedule,slot,shouldStop,observe:async()=>{
      const resource=await store.sample();const status=await controller.status({workerId:slot});return {...status,resourceAllowed:resource.allowed,resourceReason:resource.reason};
    }});
  },observeCanaryWindow:async shouldStop=>budgetObservationEnd===undefined?null:
    observeBudgetWindow({endMs:budgetObservationEnd,sample:()=>store.sample(),shouldStop}),
    rpc:async(op,data)=>{await resourceReady;await ensureControlMode();await ensureStateWrite(plan);return controller.rpc(op,data);},metrics:({final=false}={})=>({processing:'github',resourceGate:gate.status(),gateway:transport.metrics(),
    resourceObservation:gate.diagnostics({includeWindows:final}),
    hostResourceObservation:hostResources.diagnostics({includeWindows:final}),
    localStages:{nestedWithinRpc:true,byStage:structuredClone(localStages)}}),
    close(){hostResources.stop();parser.close();transport.close();spool.close();}};
}
