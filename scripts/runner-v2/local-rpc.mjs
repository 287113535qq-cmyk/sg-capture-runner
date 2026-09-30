import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';
import {BatchController} from './batch-controller.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {localSpool} from './local-spool.mjs';

export function connectLocal(plan){
  const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer(),spool=localSpool();
  // Source stops opening rounds at the worker deadline. Its already issued
  // natural feature still needs durable responses and final Mongo readback.
  const tailMs=plan.countAllocation?10*60000:0;
  const store=new RunnerState({transport,gate,deadline:Date.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000+tailMs});
  const control=new SourceControl({store,transport,gate,plan});
  const controller=new BatchController({store,transport,gate,analyzer:parser,spool,control,plan,
    group:repositories[process.env.GITHUB_REPOSITORY].name,pendingFirstStage:process.env.SG_PENDING_FIRST_STAGE,
    runKey:`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`});
  return {rpc:(op,data)=>controller.rpc(op,data),metrics:()=>({processing:'github',resourceGate:gate.status(),gateway:transport.metrics()}),
    close(){parser.close();transport.close();spool.close();}};
}
