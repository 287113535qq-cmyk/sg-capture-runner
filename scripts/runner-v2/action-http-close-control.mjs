import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyFormalCount} from './formal-count-plan.mjs';
import {closeCountNetwork} from './count-network-close.mjs';
import {reviewEndedHttpLogs} from './action-http-evidence.mjs';
import {directJobLogArgs} from './action-direct-resource.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {countPeerBoundary} from './count-peer-boundary.mjs';

// Fixed native game/group scope; each ended run needs fresh immutable evidence.
// The generic retirement never reads unknown gameplay fields to resume a round.
assert(process.env.GITHUB_ACTIONS==='true'
 &&process.env.GITHUB_REPOSITORY==='287113535qq-cmyk/sg-capture-runner','SECONDARY_GITHUB_REQUIRED');
const name='count-network-pyramids-http-20261002.json';
assert(/^count-network-pyramids-http-20261002\.json$/.test(name??''),'EVIDENCE_PROFILE_FILE');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/'+name);
assert(profile.schema==='sg-count-network-http-close-profile-v1'&&profile.group==='secondary'
 &&profile.gameId===32721&&profile.trialId==='sg_r1_20260928_32721'
 &&/^formal-repair-pyramids-[a-z0-9-]+\.json$/.test(profile.sourceProfile),'EVIDENCE_CONTROL_SCOPE');
const source=load('config/'+profile.sourceProfile),plans=load('config/round-one-plans.json');
assert(hash(source)===profile.sourceProfileHash&&Object.keys(profile.files??{}).length>700,'EVIDENCE_RUNTIME_SCOPE');
for(const[p,h]of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(p)&&!p.includes('..'),'EVIDENCE_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n')).digest('hex')===h,'EVIDENCE_RUNTIME_CHANGED');
}
process.env.SG_FORMAL_COUNT_PROFILE=profile.sourceProfile;
const plan=applyFormalCount(plans,source)[32721],transport=connectGateway(),gate=new ResourceGate();
const store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer({auditWorkers:2});
const read=authenticatedRead(process.env.GH_TOKEN),commit=process.env.GITHUB_SHA;
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const github=countPeerBoundary({read,transport,peer:profile.primaryPeer,selfGroup:'secondary',run,commit,
 workflowPath:'.github/workflows/demo-maintenance.yml',maintenanceHoldHash:profile.holdHash,
 maintenanceFaultCode:profile.faultCode,maintenanceFaultCategory:'source_http'});
try{
 const boundary=async()=>{
  assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'EVIDENCE_CLOSE_STALE');
  await github();await store.writable();
  assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
  await checkPrimaryLeases({store,plans});
 };
 assert(/^\d+:1$/.test(profile.sourceRun),'EVIDENCE_SOURCE_RUN');
 const id=Number(profile.sourceRun.split(':')[0]),path='repos/287113535qq-cmyk/sg-capture-runner/actions/runs/'+id;
 const ended=await read(path),jobs=await read(path+'/jobs?filter=all&per_page=100');
 assert(ended.id===id&&ended.run_attempt===1&&ended.event==='workflow_dispatch','EVIDENCE_SOURCE_IDENTITY');
 assert((await parser.call({op:'plan',plan})).validated,'EVIDENCE_PYTHON_PLAN');
 const logs=[];const execute=promisify(execFile);
 for(let first=0;first<20;first+=4){
  const wave=Array.from({length:4},(_,i)=>jobs.jobs.find(j=>j.name==='capture-'+(first+i)));
  const got=await Promise.allSettled(wave.map(j=>execute('gh',directJobLogArgs(j.id),{encoding:'buffer',maxBuffer:32*1024**2,timeout:60000})));
  assert(got.every(r=>r.status==='fulfilled'),'HTTP_CLOSE_LOG_DOWNLOAD');logs.push(...got.map(r=>r.value.stdout));
 }
 const httpEvidence=reviewEndedHttpLogs({source:ended,jobs,commit:profile.sourceCommit,logs});
 console.log(JSON.stringify(await closeCountNetwork({store,transport,gate,parser,plan,profile,ended,jobs,httpEvidence,boundary,commit,run})));
}catch(e){
 console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'EVIDENCE_CLOSE_REQUIRES_REVIEW',sourceRequests:0,newBetAllowance:0}));
 process.exitCode=2;
}finally{parser.close();transport.close();}
