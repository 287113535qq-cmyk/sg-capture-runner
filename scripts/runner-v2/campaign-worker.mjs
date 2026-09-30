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
import {exportResourceHistory} from './resource-handoff.mjs';

const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
const end=Date.now()+Number(process.env.SG_TRIAL_MINUTES||'240')*60000;
const store=new RunnerState({transport,gate,deadline:end+(process.env.SG_FORMAL_COUNT_PROFILE?25*60000:0)}),control=new SourceControl({store,transport,gate});
let plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
if(process.env.SG_DEMO_PILOT==='true')plans=applyDemoPilot(plans,JSON.parse(fs.readFileSync(demoPilotProfilePath(),'utf8')));
if(process.env.SG_FORMAL_COUNT_PROFILE){
 if(process.env.SG_DEMO_PILOT==='true')throw Error('FORMAL_COUNT_DEMO_CONFLICT');
 plans=applyFormalCount(plans,JSON.parse(fs.readFileSync(formalCountProfilePath(),'utf8')));
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
      SG_RESOURCE_HANDOFF:'pipe-v1',
      SG_PROCESSING_MODE:'github-v2',SG_POOL_RUN_LIMIT:String(validationLimit || Number(process.env.SG_POOL_RUN_LIMIT||'0')),
      SG_TRIAL_PLAN:'config/round-one-active.json',SG_TRIAL_MINUTES:String(Math.max(1,(end-Date.now())/60000))}
  });
}
try{
  if(['status','finalize'].includes(process.argv[2])){
    if(process.argv[2]==='finalize')await stages.run('finalize',()=>campaign.finalizeStoppedRun(`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`));
    const status=await campaign.status();console.log(JSON.stringify(status));
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
        const idle=await Promise.all(workers.map(worker=>campaign.idleAtTail(next.plan,pool,worker)));
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
