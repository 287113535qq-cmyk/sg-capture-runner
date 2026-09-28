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
  const store=new RunnerState({transport,gate,deadline:Date.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000});
  const control=new SourceControl({store,transport,gate,plan});
  const controller=new BatchController({store,transport,gate,analyzer:parser,spool,control,plan,
    group:repositories[process.env.GITHUB_REPOSITORY].name});
  return {rpc:(op,data)=>controller.rpc(op,data),metrics:()=>({processing:'github',resourceGate:gate.status(),gateway:transport.metrics()}),
    close(){parser.close();transport.close();spool.close();}};
}
