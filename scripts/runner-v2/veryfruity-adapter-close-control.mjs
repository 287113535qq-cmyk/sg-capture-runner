import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';import {closeReviewedAdapterStop} from './ag-shared-stop-close.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {checkDemoSourceEnded} from './demo-source-ended.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
const repo='287113535qq-cmyk/sg-capture-runner';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===repo,'ADAPTER_CLOSE_GITHUB_SCOPE');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const original=load('config/demo-pilot-veryfruity-action-revision3-20261003.json');
const profile=load('config/demo-close-veryfruity-adapter-20261003.json'),plans=load('config/round-one-plans.json');
const plan=applyDemoPilot(plans,original)[32812];
assert(hash(original)==='a661966a0f4853b7668c9a1f3753db4e95d0a9b7f4d3753e112f4060f35344a0'
 &&profile.schema==='sg-ag-shared-stop-close-v2'&&profile.sourceProfileHash===hash(original)
 &&profile.planHash===hash(plan)&&profile.gameId===32812&&profile.trialId===plan.trialId
 &&profile.group==='secondary'&&profile.workerOffset===20&&profile.newBetAllowance===0
 &&profile.sourceRunKey==='capture-run:37053154321:1'&&profile.sourceConclusion==='failure'
 &&profile.sourceCommit==='54e5fa3c63bf7766d02a443e5bdd07c10a290412'
 &&profile.code==='VERYFRUITY_ACTION_UNREVIEWED_EXIT'&&profile.batchId===2
 &&profile.completePreserved===0&&hash(profile.completeByWorker)===hash(Array(20).fill(0))
 &&hash(profile.usedByWorker)===hash(Array.from({length:20},(_,i)=>i===3?1:0)),'ADAPTER_CLOSE_PROFILE_SCOPE');
for(const [file,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(file)&&!file.includes('..'),'ADAPTER_CLOSE_FILE_SCOPE');
 assert.equal(createHash('sha256').update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex'),expected,'ADAPTER_CLOSE_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+15*60000}),parser=analyzer();
const github=countPeerBoundary({read,transport,peer:original.peer,selfGroup:'secondary',run,commit,
 workflowPath:'.github/workflows/demo-maintenance.yml',maintenanceHoldHash:profile.holdHash,
 maintenanceFaultCode:profile.code,maintenanceFaultCategory:'source_protocol',adapterRetirement:true});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'ADAPTER_CLOSE_PROFILE_STALE');
  await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans});
  const prefix=`repos/${repo}/actions/runs/37053154321`;
  const [ended,jobs]=await Promise.all([read(prefix),read(prefix+'/jobs?filter=all&per_page=100')]);
  assert(ended.event==='workflow_dispatch','ADAPTER_CLOSE_SOURCE_EVENT');
  checkDemoSourceEnded({ended,jobs,profile,closing:true,repository:repo});
  assert.equal(hash(jobs.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion})).sort((a,b)=>a.id-b.id)),profile.jobsHash,'ADAPTER_CLOSE_JOBS_CHANGED');
 };
 console.log(JSON.stringify(await closeReviewedAdapterStop({store,transport,gate,parser,basePlan:plan,plan,profile,boundary,commit,run})));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'ADAPTER_CLOSE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
