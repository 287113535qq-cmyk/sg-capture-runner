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
  return {async canaryReady(shouldStop){
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
      const resource=await store.sample();const status=await controller.status();return {...status,resourceAllowed:resource.allowed,resourceReason:resource.reason};
    }});
  },rpc:async(op,data)=>{await resourceReady;return controller.rpc(op,data);},metrics:({final=false}={})=>({processing:'github',resourceGate:gate.status(),gateway:transport.metrics(),
    resourceObservation:gate.diagnostics({includeWindows:final}),
    hostResourceObservation:hostResources.diagnostics({includeWindows:final}),
    localStages:{nestedWithinRpc:true,byStage:structuredClone(localStages)}}),
    close(){hostResources.stop();parser.close();transport.close();spool.close();}};
}
