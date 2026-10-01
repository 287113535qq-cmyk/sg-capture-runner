import {demoPilotProfilePath} from './demo-pilot-profile.mjs';
import fs from 'node:fs';
import {captureSessionLanes} from './session-lanes.mjs';
import {sessionLayout,sessionWorker} from './session-layout.mjs';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';
import {GithubCampaign} from './campaign.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {applyFormalCount,formalCountProfilePath} from './formal-count-plan.mjs';
import {createStageProgress} from './stage-progress.mjs';
import {countMeasurementMinutes} from './count-initial-runtime.mjs';
import {rhinoObservationMinutes} from './rhino-observation-runtime.mjs';
import {rhinoContinuousMinutes} from './rhino-continuous-runtime.mjs';
import {exportResourceHistory} from './resource-handoff.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {sessionCanarySchedule} from './session-canary.mjs';

const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
let canary;
let end=Date.now()+Number(process.env.SG_TRIAL_MINUTES||'240')*60000;
const store=new RunnerState({transport,gate,deadline:end+(process.env.SG_FORMAL_COUNT_PROFILE?25*60000:0)}),control=new SourceControl({store,transport,gate});
let plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
if(process.env.SG_DEMO_PILOT==='true')plans=applyDemoPilot(plans,JSON.parse(fs.readFileSync(demoPilotProfilePath(),'utf8')));
if(process.env.SG_FORMAL_COUNT_PROFILE){
 if(process.env.SG_DEMO_PILOT==='true')throw Error('FORMAL_COUNT_DEMO_CONFLICT');
 plans=applyFormalCount(plans,JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')));
}
if(process.env.SG_COUNT_RUNTIME_PROFILE==='count-runtime-rhino-measurement-20261001.json'){
 const revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8')),plan=plans[32799];
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${process.env.GITHUB_SHA}`))?.value;
 if(revision.activation!==plan.countAllocation||receipt?.commit!==process.env.GITHUB_SHA)throw Error('COUNT_MEASUREMENT_SCOPE');
 end=Date.now()+countMeasurementMinutes(revision,receipt)*60000;
}
if(['formal-sessions-rhino-two-20261001.json','formal-sessions-rhino-four-20261001.json'].includes(process.env.SG_FORMAL_COUNT_PROFILE)&&!['count-runtime-rhino-canary-20261001.json','count-runtime-rhino-two-observation-20261001.json','count-runtime-rhino-continuous-20261001.json','count-runtime-rhino-ag-continuation-20261001.json','count-runtime-rhino-ag-continuation-entryfix-20261001.json','count-runtime-rhino-ag-dispatchfix-20261001.json'].includes(process.env.SG_COUNT_RUNTIME_PROFILE)){
 const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')),plan=plans[32799];
 const spec=(await store.get('journal',`complete-count:${plan.trialId}:${plan.countAllocation}`))?.value;
 if(profile.schema!=='sg-session-layout-rhino-v1'||profile.captureMinutes!==20||spec?.commit!==process.env.GITHUB_SHA||spec?.profileHash!==hash(profile))throw Error('COUNT_SESSION_WINDOW_PERMISSION');
 end=Date.now()+profile.captureMinutes*60000;
}
if(process.env.SG_COUNT_RUNTIME_PROFILE==='count-runtime-rhino-two-observation-20261001.json'){
 const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')),revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8')),plan=plans[32799];
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${process.env.GITHUB_SHA}`))?.value;
 end=Date.now()+rhinoObservationMinutes(profile,revision,receipt,process.env.GITHUB_SHA)*60000;
}
if(['count-runtime-rhino-continuous-20261001.json','count-runtime-rhino-ag-continuation-20261001.json','count-runtime-rhino-ag-continuation-entryfix-20261001.json','count-runtime-rhino-ag-dispatchfix-20261001.json'].includes(process.env.SG_COUNT_RUNTIME_PROFILE)){
 const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')),revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8')),plan=plans[32799];
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${process.env.GITHUB_SHA}`))?.value;
 end=Date.now()+rhinoContinuousMinutes(profile,revision,receipt,process.env.GITHUB_SHA)*60000;
}
if(process.env.SG_COUNT_RUNTIME_PROFILE==='count-runtime-rhino-canary-20261001.json'){
 const profile=JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')),revision=JSON.parse(fs.readFileSync('config/'+process.env.SG_COUNT_RUNTIME_PROFILE,'utf8')),plan=plans[32799];
 const receipt=(await store.get('journal',`count-runtime:${plan.trialId}:${plan.countAllocation}:${process.env.GITHUB_SHA}`))?.value;
 const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT;
 const permit=(await store.get('journal',`count-run:${plan.trialId}:${run}`))?.value;
 canary=sessionCanarySchedule({profile,revision,receipt,permit,commit:process.env.GITHUB_SHA,run});end=canary.endMs;
}
const group=repositories[process.env.GITHUB_REPOSITORY].name;
const campaign=new GithubCampaign({store,transport,control,analyzer:parser,plans,group,
  owner:`${group}:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.SG_TRIAL_SHARD||'status'}`});
let stop=false;
const childStop=new AbortController();
process.on('SIGTERM',()=>{stop=true;childStop.abort();});process.on('SIGINT',()=>{stop=true;childStop.abort();});
const sleep=()=>new Promise(r=>setTimeout(r,10000));
const stages=createStageProgress({emit:row=>console.log(JSON.stringify(row))});
async function capture(plan){
  const validationLimit=(await store.get('state','campaign')).value.validationLimit || 0;
  fs.writeFileSync('config/round-one-active.json',JSON.stringify(plan)+'\n');
  return captureSessionLanes({plan,host:Number(process.env.SG_TRIAL_SHARD),group,history:exportResourceHistory(gate),signal:childStop.signal,
    env:{...process.env,
      ...(canary?{SG_CANARY_SCHEDULE:JSON.stringify(canary)}:{}),
      SG_RESOURCE_HANDOFF:'pipe-v1',
      SG_PROCESSING_MODE:'github-v2',SG_POOL_RUN_LIMIT:String(validationLimit || Number(process.env.SG_POOL_RUN_LIMIT||'0')),
      SG_TRIAL_PLAN:'config/round-one-active.json',SG_TRIAL_MINUTES:String(Math.max(1,(end-Date.now())/60000))}
  });
}
try{
  if(['status','finalize'].includes(process.argv[2])){
    if(process.argv[2]==='finalize')await stages.run('finalize',()=>campaign.finalizeStoppedRun(`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`,{waitMs:300000}));
    const status=await campaign.status({runKey:`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`});console.log(JSON.stringify(status));
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`campaign_status=${status.status}\n`);
  }else{
    while(!stop && Date.now()+60000<end){
      const next=await stages.run('select',()=>campaign.selectForRun(`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`));
      if(next.action==='stop'){console.log(JSON.stringify(next));break;}
      if(next.action==='wait'){await sleep();continue;}
      if(next.action==='audit'){console.log(JSON.stringify(await stages.run('audit',()=>campaign.audit(next.plan))));break;}
      const code=await stages.run('capture',()=>capture(next.plan));
      if(Number(process.env.SG_POOL_RUN_LIMIT || '0')>0 || (await store.get('state','campaign')).value.validationLimit>0){if(code!==0)process.exitCode=2;break;}
      // A failed child is evidence requiring review. Repeating its startup can
      // otherwise loop forever before registration without producing any data.
      if(code!==0){process.exitCode=2;break;}
      if(code===0){
        const pool=(await store.get('state','pool:'+next.plan.trialId)).value;
        const workers=Array.from({length:sessionLayout(next.plan)?.lanesPerHost??1},(_,lane)=>sessionWorker(next.plan,Number(process.env.SG_TRIAL_SHARD),group,lane));
        const idle=await campaign.idleAtTails(next.plan,pool,workers);
        if(idle.every(Boolean)){
          console.log(JSON.stringify({action:'yield-runner',reason:'REMAINING_RANGES_OWNED_BY_OTHER_WORKERS'}));break;
        }
      }
      await sleep();
    }
  }
}catch(error){
  console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.code||'')?error.code:'GITHUB_CAMPAIGN_STOPPED',group}));process.exitCode=2;
}finally{parser.close();transport.close();}
