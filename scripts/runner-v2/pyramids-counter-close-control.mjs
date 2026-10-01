import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyFormalCount} from './formal-count-plan.mjs';
import {closeCountShared} from './count-shared-close.mjs';import {countPeerBoundary} from './count-peer-boundary.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','SECONDARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p)),profile=load('config/count-close-pyramids-fifteen-20261002.json'),
 source=load('config/formal-repair-pyramids-mixed-20261002.json'),plans=load('config/round-one-plans.json'),plan=applyFormalCount(plans,source)[32721];
assert(profile.schema==='sg-count-counter-close-profile-v1'&&profile.sourceProfileHash===hash(source)
 &&profile.sourceRun==='36937673870:1'&&profile.completePreserved===5024&&Object.keys(profile.files).length>700,'COUNTER_CLOSE_RUNTIME_SCOPE');
for(const[p,h]of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'COUNTER_CLOSE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'COUNTER_CLOSE_RUNTIME_CHANGED');
}
process.env.SG_FORMAL_COUNT_PROFILE='formal-repair-pyramids-mixed-20261002.json';
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer(),
 read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const github=countPeerBoundary({read,transport,peer:profile.primaryPeer,selfGroup:'secondary',run,commit,
 workflowPath:'.github/workflows/demo-maintenance.yml',maintenanceHoldHash:profile.holdHash});
try{
 const boundary=async()=>{assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'COUNTER_CLOSE_STALE');await github();
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});};
 const path='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/36937673870',ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert(ended.id===36937673870&&ended.run_attempt===1&&ended.event==='workflow_dispatch','COUNTER_CLOSE_SOURCE_IDENTITY');
 assert((await parser.call({op:'plan',plan})).validated,'COUNTER_CLOSE_PYTHON_PLAN');
 console.log(JSON.stringify(await closeCountShared({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'COUNTER_CLOSE_REQUIRES_REVIEW',sourceRequests:0,newBetAllowance:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
