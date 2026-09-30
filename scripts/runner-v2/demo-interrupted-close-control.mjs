import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {advanceAgPilot} from './ag-pilot-transition.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-close-morepuff-20260930.json'),source=load('config/demo-pilot-morepuff-20260930.json'),plans=load('config/round-one-plans.json');
const basePlan=plans['32718'],plan={...basePlan,demoGeneration:source.generation};
assert(profile.sourceRunKey==='capture-run:36684942513:1'&&profile.sourceCommit==='2e70191930c1639d5446aafb90afa683c83a91e2'
 &&hash(source)==='9ed50c4e0376120e8a8f2a78a441c72e9a9b231498c7b0094202135076051ead'&&profile.sourceProfileHash===hash(source)
 &&profile.sourceConclusion==='failure'&&profile.completePreserved===91&&hash(profile.usedByWorker)===hash([5,0,0,5,1,5,0,5,1,5,1,0,2,0,0,0,0,4,5,0])&&profile.schema==='sg-demo-pilot-close-v2','PILOT_CLOSE_PROFILE_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'PILOT_CLOSE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'PILOT_CLOSE_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt,'PILOT_CLOSE_PROFILE_STALE');await idle();
  const prefix='repos/zyzuoyang/sg-capture-runner/actions/runs/36684942513',ended=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
  checkDemoSourceEnded({ended,jobs,profile,closing:true});
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');
 };
 const transition=await advanceAgPilot({closeArgs:{store,transport,parser,basePlan,plan,profile,boundary,commit,run}}),result=transition.closed;
 console.log(JSON.stringify({closed:true,action:transition.action,completePreserved:result.completePreserved,used:result.used,foregone:result.foregone,newBetAllowance:0,sourceRequests:0}));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'PILOT_CLOSE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
