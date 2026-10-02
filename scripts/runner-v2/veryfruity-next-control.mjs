import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkVeryFruityNextProfile,VERYFRUITY_PILOT_FILE} from './veryfruity-next-profile.mjs';
import {demoRuntimeCommit} from './demo-runtime.mjs';
import {checkVeryFruityZeroProfile,rebindVeryFruityZero,VERYFRUITY_RUNTIME_FILE} from './veryfruity-zero-source.mjs';
import {execFileSync} from 'node:child_process';
import {countPeerBoundary} from './count-peer-boundary.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {connectGateway} from './transport.mjs';import {ResourceGate} from './resource-gate.mjs';import {RunnerState} from './state-store.mjs';import {analyzer} from './analyzer.mjs';
import {authenticatedRead} from './github-boundary.mjs';import {checkPrimaryLeases} from './lease-boundary.mjs';
import {prepareEmptyCandidate} from './demo-empty-candidate.mjs';import {nextDemoGame} from './demo-next-game.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';import {reviewFormalSource,readPoolBatches} from './formal-source-review.mjs';
const repository='287113535qq-cmyk/sg-capture-runner';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY===repository&&process.env.SG_DEMO_PILOT_PROFILE===VERYFRUITY_PILOT_FILE,'VERYFRUITY_GITHUB_SCOPE');
const mode=process.argv[2];assert(['activate','admit','amend'].includes(mode),'VERYFRUITY_OPERATION');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8')),profile=load('config/'+VERYFRUITY_PILOT_FILE),plans=load('config/round-one-plans.json');
checkVeryFruityNextProfile(profile,plans[32812]);assert(Object.keys(profile.files??{}).length>400,'VERYFRUITY_FILES_REQUIRED');
const revision=mode!=='activate'&&fs.existsSync('config/'+VERYFRUITY_RUNTIME_FILE)?load('config/'+VERYFRUITY_RUNTIME_FILE):null;
if(revision)checkVeryFruityZeroProfile(revision,profile,revision.evidence);
for(const [path,expected] of Object.entries(revision?.files??profile.files)){
 assert(/^(scripts|service|collector|\.github)\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.includes('..'),'VERYFRUITY_FILE_SCOPE');
 assert(createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')===expected,'VERYFRUITY_RUNTIME_CHANGED');
}
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA,read=authenticatedRead(process.env.GH_TOKEN),transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
const github=countPeerBoundary({read,transport,peer:profile.peer,selfGroup:'secondary',run,commit,workflowPath:mode==='admit'?'.github/workflows/trial-300k.yml':'.github/workflows/demo-maintenance.yml'});
const boundary=async()=>{
 assert(profile.createdAt<=Date.now()&&Date.now()<profile.expiresAt,'VERYFRUITY_PROFILE_STALE');
 await github();await store.writable();assert(gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');await checkPrimaryLeases({store,plans});
};
try{
 if(mode==='activate'){
  const prefix=`repos/${repository}/actions/runs/${profile.sourceFormal.run.split(':')[0]}`;
  const [ended,jobs]=await Promise.all([read(prefix),read(prefix+'/jobs?filter=all&per_page=100')]);checkDemoSourceEnded({ended,jobs,profile,repository});
  await boundary();const fromPlan=profile.sourceFormal.plan,campaign=(await store.get('state','campaign'))?.value,fromPool=(await store.get('state','pool:'+fromPlan.trialId))?.value;
  await reviewFormalSource({store,plan:fromPlan,profile,scene:{campaign,fromPool,sourceBatches:await readPoolBatches(store,fromPlan,fromPool)}});
  await prepareEmptyCandidate({store,transport,plan:plans[32812],profile,boundary,commit,run});
  console.log(JSON.stringify(await nextDemoGame({store,transport,gate,parser,plans,profile,boundary,commit,run})));
 }else if(mode==='amend'){
  assert(revision,'VERYFRUITY_ZERO_PROFILE_REQUIRED');
  const ended=await read('repos/'+repository+'/actions/runs/37043477601'),jobs=await read('repos/'+repository+'/actions/runs/37043477601/jobs?filter=all&per_page=100');
  assert(ended.head_sha===revision.originalCommit&&ended.run_attempt===1&&ended.status==='completed'&&ended.conclusion==='failure'&&ended.path==='.github/workflows/trial-300k.yml'&&ended.repository.full_name===repository,'VERYFRUITY_ZERO_ENDED_RUN');
  assert(jobs.total_count===jobs.jobs.length&&jobs.jobs.every(j=>j.status==='completed')&&hash(jobs.jobs.map(j=>({id:j.id,name:j.name,conclusion:j.conclusion})).sort((a,b)=>a.id-b.id))===revision.jobsHash,'VERYFRUITY_ZERO_JOBS');
  const logs=execFileSync('gh',['api','repos/'+repository+'/actions/runs/37043477601/logs'],{maxBuffer:32*1024**2});
  const evidence=JSON.parse(execFileSync('python3',['scripts/runner-v2/veryfruity-zero-evidence.py'],{input:logs,maxBuffer:1024**2,encoding:'utf8'}));
  console.log(JSON.stringify(await rebindVeryFruityZero({store,transport,plan:applyDemoPilot(plans,profile)[32812],profile:revision,original:profile,evidence,boundary,commit,run})));
 }else{
  await boundary();const plan=applyDemoPilot(plans,profile)[32812],key=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
  const completed=(await store.get('journal',key+':complete'))?.value,c=(await store.get('state','campaign'))?.value,pool=(await store.get('state','pool:'+plan.trialId))?.value,
   spec=(await store.get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}`))?.value,done=(await store.get('journal',`demo-generation:${plan.trialId}:${plan.demoGeneration}:complete`))?.value;
  assert(completed?.schema==='sg-next-demo-game-complete-v1'&&completed.profileHash===hash(profile)&&completed.commit===(revision?.originalCommit??commit)&&completed.generation===plan.demoGeneration
   &&completed.newBetAllowance===100&&completed.sourceRequests===0&&completed.completePreserved===0&&completed.abandonedAttempts===0
   &&completed.group==='secondary'&&completed.workerOffset===20&&c?.group==='secondary'&&c.activeGame===32812&&c.enabled
   &&c.protocolValidation?.commit===commit&&c.protocolValidation.generation===plan.demoGeneration&&c.protocolValidation.runKey===null
   &&pool?.enabled&&!pool.failure&&pool.planHash===hash(plan)&&pool.demoGeneration?.specHash===hash(spec)
   &&pool.nextBatchId===spec?.firstBatchId&&Object.keys(pool.workers).length===0&&(await demoRuntimeCommit({store,plan,spec,campaign:c}))===commit&&spec.run===completed.run
   &&spec.group==='secondary'&&spec.workerOffset===20&&spec.newBetAllowance===100&&spec.activationStage?.profileHash===hash(profile)
   &&done?.specHash===hash(spec)&&done.commit===spec.commit,'VERYFRUITY_ADMISSION_INCOMPLETE');
  const maintenance=await read(`repos/${repository}/actions/runs/${completed.run.split(':')[0]}`);
  assert(maintenance.run_attempt===1&&maintenance.head_sha===spec.commit&&maintenance.status==='completed'&&maintenance.conclusion==='success'
   &&maintenance.path==='.github/workflows/demo-maintenance.yml'&&maintenance.repository?.full_name===repository,'VERYFRUITY_MAINTENANCE_NOT_SUCCESS');
  await boundary();await store.update('state','campaign',v=>{assert(hash(v)===hash(c),'VERYFRUITY_CAMPAIGN_CHANGED');return {...v,protocolValidation:{...v.protocolValidation,runKey:'capture-run:'+run}};});
  assert((await store.get('state','campaign'))?.value.protocolValidation?.runKey==='capture-run:'+run,'VERYFRUITY_ADMISSION_READBACK');
  console.log(JSON.stringify({schema:'sg-veryfruity-action-admission-v1',gameId:32812,newBetAllowance:100,sourceRequests:0,run}));
 }
}catch(e){console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(e.message)?e.message:'VERYFRUITY_NEXT_REQUIRES_REVIEW',sourceRequests:0}));process.exitCode=2;}
finally{parser.close();transport.close();}
