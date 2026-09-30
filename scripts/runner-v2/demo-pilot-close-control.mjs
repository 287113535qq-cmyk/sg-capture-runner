import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {closeDemoPilot} from './demo-pilot-close.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-close-jinzita-20260930.json'),source=load('config/demo-pilot-jinzita-20260930.json'),plans=load('config/round-one-plans.json');
const basePlan=plans['32720'],plan={...basePlan,demoGeneration:source.generation};
assert(profile.sourceRunKey==='capture-run:36650768164:1'&&profile.sourceCommit==='82d0489664d867a1111d8c092cdfab08f12de10e'
 &&hash(source)==='203435ad5507c7196d6596d95a8590583df234c37051b42eaf86e45780eafbbf'&&profile.sourceProfileHash===hash(source)
 &&profile.sourceConclusion==='failure'&&profile.completePreserved===415&&profile.usedByWorker.every((n,w)=>n===(w===18?0:5)),'PILOT_CLOSE_PROFILE_SCOPE');
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
  const prefix='repos/zyzuoyang/sg-capture-runner/actions/runs/36650768164',ended=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
  checkDemoSourceEnded({ended,jobs,profile,closing:true});
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');
 };
 const result=await closeDemoPilot({store,transport,parser,basePlan,plan,profile,boundary,commit,run});
 console.log(JSON.stringify({closed:true,completePreserved:result.completePreserved,used:result.used,foregone:result.foregone,newBetAllowance:0,sourceRequests:0}));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'PILOT_CLOSE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
