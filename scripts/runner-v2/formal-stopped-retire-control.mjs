import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {applyFormalCount} from './formal-count-plan.mjs';
import {retireStoppedFormal} from './formal-stopped-retire.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const readFile=p=>JSON.parse(fs.readFileSync(p,'utf8')),basePlans=readFile('config/round-one-plans.json');
const profile=readFile('config/formal-retire-pearl-20260930.json');
const plan=applyFormalCount(basePlans,readFile('config/formal-count-pearl-20260930.json'))[32795];
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
assert(profile.files&&Object.keys(profile.files).length>=300,'FORMAL_RETIRE_MANIFEST');
for(const [p,h] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'FORMAL_RETIRE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'FORMAL_RETIRE_RUNTIME_CHANGED');
}
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000});
const parser=analyzer(),read=authenticatedRead(process.env.GH_TOKEN);
const idle=maintenanceBoundary({read,store,oldProfile:readFile('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/demo-maintenance.yml'});
try{
 const boundary=async()=>{
  await idle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans:basePlans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'GLOBAL_HOLD');
 };
 const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRun.split(':')[0]);
 const jobs=await read(`repos/zyzuoyang/sg-capture-runner/actions/runs/${ended.id}/jobs?filter=all&per_page=100`);
 const result=await retireStoppedFormal({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run});
 console.log(JSON.stringify({completePreserved:result.completePreserved,newAbandoned:0,sourceRequests:0,newBetAllowance:0}));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'FORMAL_RETIRE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
