import fs from 'node:fs';import assert from 'node:assert/strict';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {maintenanceBoundary} from './demo-run-fence.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {applyFormalCount,formalCountProfilePath} from './formal-count-plan.mjs';
import {loadCountPermission} from './complete-count.mjs';import {reviewCountWindow} from './count-window-review.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {windowTiming} from './window-timing.mjs';
assert(process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&/^\d+:1$/.test(process.env.SG_WINDOW_SOURCE_RUN??''),'WINDOW_GITHUB_SCOPE');
const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8'));
assert(profile.gameId===32799&&['sg-formal-count-rhino-v2','sg-session-layout-rhino-v1'].includes(profile.schema),'WINDOW_PROFILE_SCOPE');
const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),plan=applyFormalCount(plans,profile)[32799];
const read=authenticatedRead(process.env.GH_TOKEN),root='repos/zyzuoyang/sg-capture-runner/actions/runs/'+process.env.SG_WINDOW_SOURCE_RUN.split(':')[0];
const ended=await read(root),jobs=await read(root+'/jobs?filter=all&per_page=100');
assert(`${ended.id}:${ended.run_attempt}`===process.env.SG_WINDOW_SOURCE_RUN&&ended.status==='completed'&&ended.conclusion==='success'
 &&ended.repository?.full_name==='zyzuoyang/sg-capture-runner'&&ended.path==='.github/workflows/trial-300k.yml','WINDOW_SOURCE_NOT_ENDED');
assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.length<100&&jobs.jobs.every(j=>j.status==='completed'&&['success','skipped'].includes(j.conclusion))
 &&Array.from({length:20},(_,i)=>'capture-'+i).every(name=>jobs.jobs.filter(j=>j.name===name&&j.conclusion==='success').length===1),'WINDOW_SOURCE_JOBS');
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
try{
 const boundary=maintenanceBoundary({read,store,oldProfile:JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8')),
  run:process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA});
 await boundary();await checkPrimaryLeases({store,plans});
 const pool=(await store.get('state','pool:'+plan.trialId))?.value,campaign=(await store.get('state','campaign'))?.value;
 const spec=await loadCountPermission({store,plan,pool,commit:ended.head_sha});
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${process.env.SG_WINDOW_SOURCE_RUN}`))?.value;
 assert(permit?.commit===ended.head_sha&&permit.profileHash===hash(profile)&&permit.activation===spec.activation,'WINDOW_SOURCE_PERMISSION');
 const scans={request:async(op,fields)=>{await store.writable();return transport.request(op,fields);}};
 const captures=jobs.jobs.filter(j=>/^capture-\d+$/.test(j.name)),startMs=Math.min(...captures.map(j=>Date.parse(j.started_at))),endMs=Math.max(...captures.map(j=>Date.parse(j.completed_at)));
 const result=await reviewCountWindow({store,transport:scans,parser,plan,pool,spec,timing:windowTiming(startMs,endMs)});
 await boundary();assert(hash((await store.get('state','campaign'))?.value)===hash(campaign),'WINDOW_CAMPAIGN_CHANGED');
 console.log(JSON.stringify({...result,sourceRun:process.env.SG_WINDOW_SOURCE_RUN,sourceCommit:ended.head_sha,
  sourceSpecHash:hash(spec),sourcePermitHash:hash(permit),campaignHash:hash(campaign),profileHash:hash(profile),
  previousLanesPerHost:plan.sessionLayout?.lanesPerHost??1,completeBefore:permit.completeBefore,nextBatchId:pool.nextBatchId,nextSequence:pool.nextSequence}));
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'WINDOW_REVIEW_FAILED',sourceRequests:0,databaseWrites:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
