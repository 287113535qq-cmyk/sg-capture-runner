import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {reservationRead,reservationIdentity,reserveCountBoundary} from './count-boundary-reservation.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/count-boundary-rhino-canary-20261001.json');
assert(Object.keys(profile.files??{}).length>=300,'BOUNDARY_RESERVATION_FILES');
for(const[p,h]of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'BOUNDARY_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'BOUNDARY_RUNTIME_CHANGED');}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+10*60000}),read=authenticatedRead(process.env.GH_TOKEN);
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
const idle=maintenanceBoundary({read:reservationRead({read,transport,profile}),store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{await idle();await reservationIdentity({read,transport,profile});await store.writable();
 const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
 assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');};
try{console.log(JSON.stringify(await reserveCountBoundary({store,profile,run,commit,boundary})));}
catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'BOUNDARY_RESERVATION_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{transport.close();}
