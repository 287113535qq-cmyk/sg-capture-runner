import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';
import {BatchController} from './batch-controller.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {localSpool} from './local-spool.mjs';
import {readResourceHandoff} from './resource-handoff.mjs';

export function connectLocal(plan){
  const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer(),rawSpool=localSpool();
  const resourceReady=readResourceHandoff(gate);
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
  return {rpc:async(op,data)=>{await resourceReady;return controller.rpc(op,data);},metrics:()=>({processing:'github',resourceGate:gate.status(),gateway:transport.metrics(),
    localStages:{nestedWithinRpc:true,byStage:structuredClone(localStages)}}),
    close(){parser.close();transport.close();spool.close();}};
}
