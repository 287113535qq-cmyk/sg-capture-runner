import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyFormalCount} from './formal-count-plan.mjs';
import {closeCountShared} from './count-shared-close.mjs';import {sharedCloseBoundary} from './shared-close-boundary.mjs';
assert(process.env.GITHUB_ACTIONS==='true','GITHUB_REQUIRED');
const repository=process.env.GITHUB_REPOSITORY,group=repository==='zyzuoyang/sg-capture-runner'?'primary':'secondary';
assert(['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner'].includes(repository),'SHARED_REPOSITORY');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),root=group==='secondary',profile=load(`config/count-shared-${root?'pyramids':'rhino'}-ready-20261001.json`),
 source=load(`config/${root?'formal-repair-pyramids-continuation':'formal-sessions-rhino-two'}-20261001.json`),basePlans=load('config/round-one-plans.json'),plan=applyFormalCount(basePlans,source)[root?32721:32799];
assert(profile.group===group&&profile.sourceRun===(root?'36848037333:1':'36844672513:1')
 &&profile.sourceCommit===(root?'4c13485557529aba9dc7657487e7d9b75634f2b4':'586d34262675ea5b09fc7bbe6475ec696e706885')
 &&profile.completePreserved===(root?3211:52897)&&profile.abandonedAttempts===(root?2:28)
 &&profile.sourceProfileHash===hash(source)&&Object.keys(profile.files).length>=600,'SHARED_CLOSE_FIXED_SCOPE');
for(const [p,h]of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'SHARED_CLOSE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'SHARED_CLOSE_RUNTIME_CHANGED');
}
process.env.SG_FORMAL_COUNT_PROFILE=`${root?'formal-repair-pyramids-continuation':'formal-sessions-rhino-two'}-20261001.json`;
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer({auditWorkers:2});
const read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,
 idle=sharedCloseBoundary({read,repository,run,commit});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'SHARED_CLOSE_STALE');await idle();await store.writable();
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans:basePlans});
  const holds=await transport.request('global_holds'),peer=holds.find(h=>h._id.startsWith(root?'primary/':'secondary/'));
  assert(peer&&hash(peer.value)===profile.peerHoldHash,'SHARED_CLOSE_PEER_HOLD');
  if(!root){
   const other=load('config/count-shared-pyramids-ready-20261001.json'),e=await transport.request('parallel_pyramids_count_boundary',{run:other.sourceRun,activation:other.activation});
   const p=e.state.find(r=>r._id.includes('/pool:'))?.value,c=e.state.find(r=>r._id==='secondary/campaign')?.value;
   assert(p&&!p.enabled&&p.failure==='PROTOCOL_VALIDATION_FAILED'&&p.confirmed===3211&&p.countAllocation?.reserved===0
    &&p.countSharedClosure===`count-shared-close:${other.trialId}:${other.sourceRun}`
    &&Object.values(p.workers).every(w=>!w.activeBatch&&w.leaseUntil<=Date.now())
    &&c?.activeGame===null&&c.games.find(g=>g.game_id===32721)?.status==='parked-protocol','SHARED_CLOSE_ROOT_UNSETTLED');
  }
 };
 const path=`repos/${repository}/actions/runs/${profile.sourceRun.split(':')[0]}`,ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert((await parser.call({op:'plan',plan})).validated===true,'SHARED_CLOSE_PYTHON_PLAN');
 console.log(JSON.stringify(await closeCountShared({store,transport,gate,parser,plan,profile,ended,jobs,boundary,commit,run})));
}catch(error){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.message)?error.message:'SHARED_CLOSE_REQUIRES_REVIEW',sourceRequests:0,newBetAllowance:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
