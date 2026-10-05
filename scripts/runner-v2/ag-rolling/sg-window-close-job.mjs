import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectGateway} from '../transport.mjs';
import {RunnerState} from '../state-store.mjs';
import {ResourceGate} from '../resource-gate.mjs';
import {authenticatedRead} from '../github-boundary.mjs';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {analyzer} from '../analyzer.mjs';
import {serializeTransport} from './sg-transport.mjs';
import {queueProfile} from './sg-queue-profile.mjs';
import {sourcePermit} from './sg-queue-control.mjs';
import {mergeGame} from './sg-merge.mjs';
import {closeEndedWindow} from './sg-window-close.mjs';
import {protocolStopReport} from './sg-fault-code.mjs';
import {assertWindowJobScope} from './sg-window-recovery-binding.mjs';
assertWindowJobScope(process.env);
process.env.SG_AG_COHORT='primary';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),name=process.env.SG_AG_QUEUE_PROFILE;
assert(/^ag-rolling-queue-[a-f0-9]{64}\.json$/.test(name??''),'SG_AG_WINDOW_PROFILE_NAME');
const registry=read('config/ag-rolling-plans.json'),profile=queueProfile({name,profile:read('config/'+name),
 authorization:read('config/ag-rolling-authorizations.json'),plans:registry,readBytes:p=>fs.readFileSync(p)});
assert(profile.operation==='close-ended-window','SG_AG_WINDOW_OPERATION');
const r=profile.windowRecovery,target=read('config/ag-rolling-queue-'+r.targetActivation+'.json');
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
const transport=serializeTransport(connectGateway()),gate=new ResourceGate(),deadline=Date.now()+40*60000;
const store=new RunnerState({transport,gate,deadline}),gh=authenticatedRead(process.env.GH_TOKEN);
const boundary=maintenanceBoundary({read:gh,store,oldProfile:read('config/demo-pilot-beaver-20260930.json'),
 run,commit,workflowPath:'.github/workflows/trial-300k.yml'});
let parser,lastBoundary=-Infinity;
const guard=async()=>{
 await store.writable();assert(gate.status().allowed&&gate.status().metrics.diskFreeBytes>=25*1024**3,'SG_AG_DISK_RESERVE');
 await sourcePermit({profile:target,store,run:r.targetRun,commit:r.targetCommit,sourceJobsEnded:true});
 const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(v=>v?.value.active===false),'SG_AG_GLOBAL_HOLD');
 if(Date.now()-lastBoundary>=15000){await boundary();lastBoundary=Date.now();}
};
try{
 const result=await closeEndedWindow({profile,target,store,transport,boundary,guard,run,commit,
  readLinux:id=>gh(`repos/287113535qq-cmyk/sg-capture-runner/actions/runs/${id}`),
  readEnded:(id,repo)=>gh(`repos/${repo}/actions/runs/${id}`),
  readEndedJobs:(id,repo)=>gh(`repos/${repo}/actions/runs/${id}/jobs?filter=all&per_page=100`),
  merge:async(game,recovery)=>{
   const plan=registry.plans[game.gameId];
   return mergeGame({store,transport,game,queueId:target.payload.queueId,plan,guard,cleanup:true,...recovery,
    verifyRecords:records=>{parser??=analyzer();return parser.verifyPage(plan,[...records].sort((a,b)=>a.sequence-b.sequence));},
    inspectBaseline:async()=>{assert(game.baseline===0,'SG_AG_FIRST_QUEUE_BASELINE');return {verified:true,count:0};}});
  }});
 console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify(protocolStopReport(error)));process.exitCode=2;}
finally{parser?.close();console.log(JSON.stringify({kind:'sg-ag-native-performance',...transport.metrics()}));transport.close();}
