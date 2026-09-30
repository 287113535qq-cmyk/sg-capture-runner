import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {protocolHash as hash} from './protocol-resume.mjs';import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';import {rebindZeroSource} from './demo-zero-source-rebind.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-zero-source-piggies-20260930.json'),original=load('config/demo-pilot-piggies-20260930.json'),plans=load('config/round-one-plans.json'),plan={...plans[32636],demoGeneration:original.generation};
assert(profile.sourceRunKey==='capture-run:36707581929:1'&&profile.originalCommit==='61c555c1a93cf5dd62707d7f9ee9d22552140409'
 &&profile.sourceProfileHash===hash(original)&&profile.sourceProfileHash==='6f1f982a6906e68c73411eddb7ee1ed1ad56d985f2820dbec2d825e3ddbfc029','ZERO_SOURCE_FIXED_SCOPE');
for(const [f,h] of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(f)&&!f.includes('..'),'ZERO_SOURCE_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'ZERO_SOURCE_RUNTIME_CHANGED');}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate});
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(Date.now()<profile.expiresAt,'ZERO_SOURCE_STALE');await idle();
  const r=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/36707581929'),j=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/36707581929/jobs?filter=all&per_page=100');
  assert(r.status==='completed'&&r.conclusion==='failure'&&r.run_attempt===1&&r.head_sha===profile.originalCommit&&r.path==='.github/workflows/trial-300k.yml'&&r.repository.full_name==='zyzuoyang/sg-capture-runner','ZERO_SOURCE_RUN_CHANGED');
  assert(j.total_count===j.jobs.length&&j.jobs.every(j=>j.status==='completed')&&hash(j.jobs.filter(j=>/^fresh-capture-\d+$/.test(j.name)).map(j=>({id:j.id,name:j.name,conclusion:j.conclusion})).sort((a,b)=>a.id-b.id))===profile.jobsHash,'ZERO_SOURCE_JOBS_CHANGED');
  await store.writable();await checkPrimaryLeases({store,plans});assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');
 };
 await boundary();
 const logs=execFileSync('gh',['api','repos/zyzuoyang/sg-capture-runner/actions/runs/36707581929/logs'],{maxBuffer:32*1024**2});
 const evidence=JSON.parse(execFileSync('python3',['scripts/runner-v2/zero-source-evidence.py'],{input:logs,maxBuffer:1024**2,encoding:'utf8'}));
 console.log(JSON.stringify(await rebindZeroSource({store,transport,plan,profile,evidence,boundary,commit,run})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'ZERO_SOURCE_REBIND_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}finally{transport.close();}
