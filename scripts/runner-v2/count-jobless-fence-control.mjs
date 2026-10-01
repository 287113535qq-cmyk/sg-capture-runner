import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {fenceJoblessCount,joblessFencedRead} from './count-jobless-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';import {loadCountPermission} from './complete-count.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=readFile('config/count-fence-rhino-jobless-20261001.json');
assert(Object.keys(profile.files??{}).length>=300,'COUNT_JOBLESS_FILES');
for(const[p,h]of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'COUNT_JOBLESS_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'COUNT_JOBLESS_RUNTIME_CHANGED');}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+20*60000}),read=authenticatedRead(process.env.GH_TOKEN);
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,plans=readFile('config/round-one-plans.json'),parent=readFile('config/formal-sessions-rhino-two-20261001.json'),plan=applyFormalCount(plans,parent)[32799];
const idle=maintenanceBoundary({read:joblessFencedRead({read,store,preFence:true}),store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await idle();await store.writable();await checkPrimaryLeases({store,plans});const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');};
try{await boundary();const pool=(await store.get('state','pool:'+plan.trialId))?.value;await loadCountPermission({store,plan,pool,commit:profile.sourceCommit});console.log(JSON.stringify(await fenceJoblessCount({store,read,profile,commit,run,boundary})));}
catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'COUNT_JOBLESS_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{transport.close();}
