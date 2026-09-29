import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {githubBoundary,authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {retireDemoPool} from './retire-demo-pool.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/demo-retire-beaver-20260930.json'),plans=load('config/round-one-plans.json'),plan=plans[32820];
assert(profile.schema==='sg-demo-retire-v1'&&profile.gameId===32820&&profile.complete===38&&profile.pending===1&&profile.newBetAllowance===0&&profile.planHash===hash(plan),'RETIRE_PROFILE_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'RETIRE_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'RETIRE_RUNTIME_CHANGED');}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,githubIdle=githubBoundary({read:authenticatedRead(process.env.GH_TOKEN),run,commit});
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
try{
 const boundary=async()=>{assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000,'RETIRE_PROFILE_STALE');await githubIdle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');};
 await boundary();
 const campaign=(await store.get('state','campaign'))?.value;assert(hash(campaign)===profile.campaignHash&&campaign.activeGame===32739,'RETIRE_CAMPAIGN_CHANGED');
 const batches=await store.getMany('state',profile.batches.map(x=>`batch:${plan.trialId}:${x.id}`));assert(batches.every((r,i)=>r&&hash(r.value)===profile.batches[i].hash),'RETIRE_BATCH_CHANGED');
 const result=await retireDemoPool({store,transport,gate,parser,plan,boundary,owner:'demo-retire:'+run,expectedPoolHash:profile.poolHash});
 assert(result.completePreserved===38&&result.abandonedAttempts===1&&hash((await store.get('state','campaign'))?.value)===profile.campaignHash,'RETIRE_RESULT_CHANGED');
 console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'DEMO_RETIRE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}finally{parser.close();transport.close();}
