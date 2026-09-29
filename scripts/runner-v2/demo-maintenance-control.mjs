import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary,revokeQueuedDemo,revokedMarker} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {rolloverDemo} from './demo-rollover.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner','PRIMARY_GITHUB_REQUIRED');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=read('config/demo-pilot-replacement-20260930.json'),oldProfile=read('config/demo-pilot-beaver-20260930.json'),oldPlans=read('config/round-one-plans.json'),plans=applyDemoPilot(oldPlans,profile);
for(const [path,expected] of Object.entries(profile.files)){assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'DEMO_FILE_SCOPE');assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'DEMO_RUNTIME_CHANGED');}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const idle=maintenanceBoundary({read:authenticatedRead(process.env.GH_TOKEN),store,oldProfile,run,commit});
try{
 const boundary=async()=>{assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt&&profile.expiresAt-profile.createdAt===7200000,'DEMO_PROFILE_STALE');await idle();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans:oldPlans});const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r.value.active===false),'GLOBAL_HOLD');};
 await boundary();
 const rows=await store.getMany('state',profile.batchHashes.map(r=>r.key));assert(rows.every((r,i)=>r&&hash(r.value)===profile.batchHashes[i].hash),'DEMO_BATCH_CHANGED');
 const values=await store.getMany('state',['campaign','pool:'+plans[32820].trialId,'pool:'+plans[32739].trialId]);
 const [campaign,pool,fromPool]=values.map(r=>r.value);
 assert(hash({campaign,pool,fromPool})===profile.previousSnapshotHash&&hash(campaign)===profile.expectedCampaignHash,'FENCE_BASELINE_CHANGED');
 assert(hash({...campaign,demoRunRevoked:revokedMarker})===profile.revokedCampaignHash,'FENCE_MARKER_CHANGED');
 await revokeQueuedDemo({store,boundary,expectedCampaignHash:profile.expectedCampaignHash,commit,run});
 const result=await rolloverDemo({store,transport,parser,boundary,oldPlan:oldPlans[profile.gameId],plan:plans[profile.gameId],fromPlan:plans[profile.fromGameId],expected:profile.snapshotHash,commit,run,expiresAt:profile.expiresAt});
 assert(result.completePreserved===38&&result.sourceRequests===0,'DEMO_RESULT_CHANGED');console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'DEMO_MAINTENANCE_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}finally{parser.close();transport.close();}
