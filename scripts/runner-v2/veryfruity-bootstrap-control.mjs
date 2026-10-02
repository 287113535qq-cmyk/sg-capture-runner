import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {retireReviewedBootstrap,readBootstrapRetirement} from './bootstrap-retirement.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';import {demoRuntimeCommit} from './demo-runtime.mjs';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {authenticatedRead} from './github-boundary.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
const mode=process.argv[2],repo='287113535qq-cmyk/sg-capture-runner';
assert(['retire','admit'].includes(mode)&&process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===repo,'BOOTSTRAP_GITHUB_SCOPE');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const original=load('config/demo-pilot-veryfruity-action-revision3-20261003.json'),profile=load('config/demo-bootstrap-veryfruity-20261003.json');
const plans=load('config/round-one-plans.json'),plan=applyDemoPilot(plans,original)[32812];
assert(profile.sourceProfileHash===hash(original)&&profile.planHash===hash(plan)
 &&profile.generation===original.generation&&profile.expiresAt===original.expiresAt
 &&profile.newBetAllowance===0&&profile.retainedBetAllowance===100&&Object.keys(profile.files).length>400,'BOOTSTRAP_PROFILE_SCOPE');
for(const [path,expected] of Object.entries(profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'BOOTSTRAP_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'BOOTSTRAP_RUNTIME_CHANGED');
}
const commit=process.env.GITHUB_SHA,run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
const read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+10*60000});
const get=async(c,k)=>(await store.get(c,k))?.value;
const github=countPeerBoundary({read,transport,peer:original.peer,selfGroup:'secondary',run,commit,
 workflowPath:mode==='retire'?'.github/workflows/demo-maintenance.yml':'.github/workflows/trial-300k.yml',
 ...(mode==='retire'?{maintenanceHoldHash:profile.holdHash,maintenanceFaultCode:'VERYFRUITY_INIT_STAKES',maintenanceFaultCategory:'storage',bootstrapRetirement:true}:{})});
const boundary=async()=>{assert(Date.now()>=profile.createdAt&&Date.now()<profile.expiresAt,'BOOTSTRAP_PROFILE_STALE');
 await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});};
try {
 if(mode==='retire'){
  await boundary();
  const prefix=`repos/${repo}/actions/runs/37045282759`;
  const [ended,jobs]=await Promise.all([read(prefix),read(prefix+'/jobs?filter=all&per_page=100')]);
  assert(ended.repository?.full_name===repo&&ended.event==='workflow_dispatch'
   &&jobs.total_count===jobs.jobs.length&&jobs.jobs.every(j=>j.status==='completed')
   &&hash(jobs.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion})).sort((a,b)=>a.id-b.id))===profile.jobsHash,'BOOTSTRAP_ENDED_JOBS');
  const campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId);
  const keys=Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${plan.trialId}:${i+1}`);
  assert(keys.length===1,'BOOTSTRAP_BATCH_SCOPE');
  const rows=await store.getMany('state',keys);assert(rows.every(Boolean),'BOOTSTRAP_BATCH_MISSING');
  const input={plan,campaign,pool,batches:rows.map(r=>r.value),hold:await get('state','global-hold'),ended,
   bootstrapKey:profile.bootstrapKey,bootstrap:await get('journal',profile.bootstrapKey)};
  console.log(JSON.stringify(await retireReviewedBootstrap({store,transport,input,profile,commit,run,boundary})));
 }else{
  await boundary();
  const campaign=await get('state','campaign'),pool=await get('state','pool:'+plan.trialId);
  const spec=await get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`);
  const r=await readBootstrapRetirement({store,plan,spec,campaign});
  assert(r&&r.done.profileHash===hash(profile)&&await demoRuntimeCommit({store,plan,spec,campaign})===commit
   &&campaign.enabled&&campaign.activeGame===32812&&campaign.protocolValidation.runKey===null
   &&pool.enabled&&!pool.failure&&pool.confirmed===0&&pool.nextBatchId===r.done.firstBatchId
   &&Object.keys(pool.workers).length===0&&pool.bootstrapRetirement?.completeHash===hash(r.done),'BOOTSTRAP_ADMISSION_SCENE');
  const ended=await read(`repos/${repo}/actions/runs/${r.done.run.split(':')[0]}`);
  assert(ended.run_attempt===1&&ended.head_sha===commit&&ended.status==='completed'&&ended.conclusion==='success'
   &&ended.repository?.full_name===repo&&ended.path==='.github/workflows/demo-maintenance.yml','BOOTSTRAP_MAINTENANCE_NOT_SUCCESS');
  await boundary();await store.update('state','campaign',v=>{assert(hash(v)===hash(campaign),'BOOTSTRAP_ADMISSION_CAS');
   return {...v,protocolValidation:{...v.protocolValidation,runKey:'capture-run:'+run}};});
  assert((await get('state','campaign')).protocolValidation.runKey==='capture-run:'+run,'BOOTSTRAP_ADMISSION_READBACK');
  console.log(JSON.stringify({schema:'sg-bootstrap-admission-v1',retainedBetAllowance:100,newBetAllowance:0,sourceRequests:0,run}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'BOOTSTRAP_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{transport.close();}
