import {demoPilotProfilePath} from './demo-pilot-profile.mjs';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {SourceControl} from './control.mjs';
import {GithubCampaign,idleAtAssignedTail} from './campaign.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';

const transport=connectGateway(),gate=new ResourceGate(),parser=analyzer();
const end=Date.now()+Number(process.env.SG_TRIAL_MINUTES||'240')*60000;
const store=new RunnerState({transport,gate,deadline:end}),control=new SourceControl({store,transport,gate});
let plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'));
if(process.env.SG_DEMO_PILOT==='true')plans=applyDemoPilot(plans,JSON.parse(fs.readFileSync(demoPilotProfilePath(),'utf8')));
const group=repositories[process.env.GITHUB_REPOSITORY].name;
const campaign=new GithubCampaign({store,transport,control,analyzer:parser,plans,group,
  owner:`${group}:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.SG_TRIAL_SHARD||'status'}`});
let stop=false;
process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
const sleep=()=>new Promise(r=>setTimeout(r,10000));
async function capture(plan){
  const validationLimit=(await store.get('state','campaign')).value.validationLimit || 0;
  fs.writeFileSync('config/round-one-active.json',JSON.stringify(plan)+'\n');
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/trial/worker.mjs','capture'],{stdio:'inherit',env:{...process.env,
      SG_PROCESSING_MODE:'github-v2',SG_POOL_RUN_LIMIT:String(validationLimit || Number(process.env.SG_POOL_RUN_LIMIT||'0')),
      SG_TRIAL_PLAN:'config/round-one-active.json',SG_TRIAL_MINUTES:String(Math.max(1,(end-Date.now())/60000))}});
    child.on('error',()=>reject(Error('CAPTURE_CHILD_FAILED')));child.on('exit',resolve);
  });
}
try{
  if(process.argv[2]==='status'){
    const status=await campaign.status();console.log(JSON.stringify(status));
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`campaign_status=${status.status}\n`);
  }else{
    while(!stop && Date.now()+60000<end){
      const next=await campaign.selectForRun(`capture-run:${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}`);
      if(next.action==='stop'){console.log(JSON.stringify(next));break;}
      if(next.action==='wait'){await sleep();continue;}
      if(next.action==='audit'){console.log(JSON.stringify(await campaign.audit(next.plan)));break;}
      const code=await capture(next.plan);
      if(Number(process.env.SG_POOL_RUN_LIMIT || '0')>0 || (await store.get('state','campaign')).value.validationLimit>0){if(code!==0)process.exitCode=2;break;}
      if(code!==0 && (await campaign.status()).globalPaused){process.exitCode=2;break;}
      if(code===0){
        const pool=(await store.get('state','pool:'+next.plan.trialId)).value;
        const worker=Number(process.env.SG_TRIAL_SHARD)+(group==='secondary'?20:0);
        if(idleAtAssignedTail(pool,worker,next.plan.target)){
          console.log(JSON.stringify({action:'yield-runner',reason:'REMAINING_RANGES_OWNED_BY_OTHER_WORKERS'}));break;
        }
      }
      await sleep();
    }
  }
}catch(error){
  console.log(JSON.stringify({error:/^[A-Z_]{1,100}$/.test(error.code||'')?error.code:'GITHUB_CAMPAIGN_STOPPED',group}));process.exitCode=2;
}finally{parser.close();transport.close();}
