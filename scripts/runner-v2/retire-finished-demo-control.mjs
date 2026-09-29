import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {retireDemoPool} from './retire-demo-pool.mjs';import {freezeFinishedDemo} from './freeze-finished-demo.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-retire-pilot-20260930.json'),plan=profile.plan;
assert(profile.schema==='sg-demo-retire-finished-v1'&&plan.gameId===32820&&profile.complete===98&&profile.pending===1&&profile.newBetAllowance===0,'RETIRE_PROFILE_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'RETIRE_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'RETIRE_RUNTIME_CHANGED');}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt,'RETIRE_PROFILE_STALE');await idle();
  const ended=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+profile.sourceRun.split(':')[0]);
  const jobs=await read('repos/zyzuoyang/sg-capture-runner/actions/runs/'+ended.id+'/jobs?filter=all&per_page=100');
  assert(ended.id+':'+ended.run_attempt===profile.sourceRun&&ended.head_sha===profile.sourceCommit&&ended.status==='completed'&&ended.path==='.github/workflows/trial-300k.yml'&&ended.repository.full_name==='zyzuoyang/sg-capture-runner'&&jobs.total_count===jobs.jobs.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.status==='completed'),'SOURCE_RUN_NOT_FINISHED');
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  const holds=await transport.request('global_holds');assert(hash(holds.map(r=>({_id:r._id,value:r.value})).sort((a,b)=>a._id.localeCompare(b._id)))===profile.holdsHash,'RETIRE_HOLD_CHANGED');
 };
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===profile.campaignHash,'RETIRE_CAMPAIGN_CHANGED');
 const poolHash=await freezeFinishedDemo({store,boundary,plan,sourceRun:profile.sourceRun,expectedPoolHash:profile.poolHash,expectedBatches:profile.batches});
 const result=await retireDemoPool({store,transport,gate,parser,plan,boundary,owner:'demo-retire:'+run,expectedPoolHash:poolHash});
 assert(result.completePreserved===98&&result.abandonedAttempts===1&&hash((await store.get('state','campaign'))?.value)===profile.campaignHash,'RETIRE_RESULT_CHANGED');console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'DEMO_RETIRE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}finally{parser.close();transport.close();}
