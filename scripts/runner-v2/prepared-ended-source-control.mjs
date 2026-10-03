import fs from 'node:fs';import assert from 'node:assert/strict';
import {preparedCountAuthorization} from './prepared-count-authorization.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {finalizePreparedEndedSource} from './prepared-ended-source.mjs';
import {authenticatedRead} from './github-boundary.mjs';
import {maintenanceBoundary} from './demo-run-fence.mjs';
import {connectGateway} from './transport.mjs';import {RunnerState} from './state-store.mjs';
import {ResourceGate} from './resource-gate.mjs';import {SourceControl} from './control.mjs';
import {GithubCampaign} from './campaign.mjs';import {analyzer} from './analyzer.mjs';
import {offlineAnalysisEnvironment} from './offline-analysis-environment.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PREPARED_ENDED_OWNER');
const load=f=>JSON.parse(fs.readFileSync(f,'utf8')),name=process.env.SG_FORMAL_COUNT_PROFILE;
const authorization=preparedCountAuthorization(name),profile=load('config/'+name),plans=load('config/round-one-plans.json');
const base=plans[profile.gameId],plan=preparedCountPlan(base,profile,authorization);
const source=process.env.SG_ENDED_SOURCE_RUN;assert(/^\d+:1$/.test(source??''),'PREPARED_ENDED_RUN');
const read=authenticatedRead(process.env.GH_TOKEN),endpoint=`repos/zyzuoyang/sg-capture-runner/actions/runs/${source.split(':')[0]}`;
const ended=await read(endpoint),jobs=await read(endpoint+'/jobs?filter=all&per_page=100');
assert(`${ended.id}:${ended.run_attempt}`===source,'PREPARED_ENDED_IDENTITY');
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+15*60000});
const parser=analyzer({env:offlineAnalysisEnvironment(process.cwd(),base)}),control=new SourceControl({store,transport,gate});
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,
 commit:process.env.GITHUB_SHA,workflowPath:'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await idle();await store.writable();await checkPrimaryLeases({store,plans});
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
 const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');};
const campaign=new GithubCampaign({store,transport,control,analyzer:parser,plans:{...plans,[plan.gameId]:plan},
 group:'primary',owner:run,commit:ended.head_sha});
try{console.log(JSON.stringify(await finalizePreparedEndedSource({store,campaign,plan,profile,authorization,ended,jobs,boundary})));}
finally{parser.close();transport.close();}
