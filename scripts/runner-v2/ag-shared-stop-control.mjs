import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {closeReviewedAdapterStop} from './ag-shared-stop-close.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-close-mansion-shared-20260930.json'),source=load('config/demo-pilot-mansion-20260930.json'),plans=load('config/round-one-plans.json');
const basePlan=plans['32714'],plan={...basePlan,demoGeneration:source.generation};
assert(profile.schema==='sg-ag-shared-stop-close-v1'&&profile.sourceRunKey==='capture-run:36701107637:1'
 &&profile.sourceCommit==='283f9ec28da84e09088dd11f1a9fe2fba92ea3cf'&&profile.sourceConclusion==='failure'
 &&hash(source)==='f7d70be05456a74883a1adc1b0d691d27be07d79f2845d5b799d681afed04741'&&profile.sourceProfileHash===hash(source)
 &&profile.completePreserved===129&&profile.batchId===27&&profile.code==='HUFF_UNREVIEWED_FEATURE_SLOTS'
 &&hash(profile.completeByWorker)===hash([0,0,3,0,2,5,0,0,0,0,1,0,5,1,4,5,0,0,0,0])
 &&hash(profile.usedByWorker)===hash([0,0,3,0,2,5,0,0,0,0,1,0,5,2,4,5,0,0,0,0]),'AG_SHARED_PROFILE_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'AG_SHARED_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'AG_SHARED_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN);
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const idle=maintenanceBoundary({read,store,oldProfile:load('config/demo-pilot-beaver-20260930.json'),run,commit});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'AG_SHARED_PROFILE_STALE');await idle();
  const prefix='repos/zyzuoyang/sg-capture-runner/actions/runs/36701107637',ended=await read(prefix),jobs=await read(prefix+'/jobs?filter=all&per_page=100');
  checkDemoSourceEnded({ended,jobs,profile,closing:true});
  await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
  const holds=await transport.request('global_holds');
  assert(hash(holds.map(r=>({_id:r._id,value:r.value})).sort((a,b)=>a._id.localeCompare(b._id)))===profile.holdsHash,'AG_SHARED_HOLDS_CHANGED');
 };
 const result=await closeReviewedAdapterStop({store,transport,gate,parser,basePlan,plan,profile,boundary,commit,run});
 console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'AG_SHARED_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
