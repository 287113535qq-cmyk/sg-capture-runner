import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {connect} from './rpc.mjs';
const config=JSON.parse(fs.readFileSync('config/round-one.json','utf8'));
assert.equal(config.phase,1);assert.equal(config.secondRoundEnabled,false);
const role=process.argv[2] || 'capture';assert(['capture','status'].includes(role));
const transport=connect({schema:config.schema,trialId:config.campaignId});
const owner=`${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT}:${process.env.SG_TRIAL_SHARD || 'status'}`;
const end=performance.now()+Number(process.env.SG_TRIAL_MINUTES || '240')*60000;
let stop=false,lastTrial=null;
process.on('SIGTERM',()=>{stop=true;});process.on('SIGINT',()=>{stop=true;});
const sleep=()=>new Promise(r=>setTimeout(r,3000));
async function child(plan,action){
  fs.writeFileSync('config/round-one-active.json',JSON.stringify(plan)+'\n');
  return new Promise((resolve,reject)=>{
    const env={...process.env,SG_TRIAL_PLAN:'config/round-one-active.json',
      SG_TRIAL_MINUTES:String(Math.max(1,(end-performance.now())/60000))};
    if(action==='audit')delete env.SG_TRIAL_SHARD;
    const run=spawn(process.execPath,['scripts/trial/worker.mjs',action],{env,stdio:'inherit'});
    run.on('error',()=>reject(Error('CAMPAIGN_CHILD_START_FAILED')));run.on('exit',code=>resolve(code));
  });
}
try{
  if(role==='status'){
    const status=await transport.rpc('status');console.log(JSON.stringify(status));
    if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`campaign_status=${status.status}\n`);
  }else{
    while(!stop && performance.now()+60000<end){
      const next=await transport.rpc('select',{owner});
      if(next.action==='stop'){console.log(JSON.stringify(next));break;}
      if(next.action==='wait' || next.action==='capture' && next.plan.trialId===lastTrial){await sleep();continue;}
      assert(['capture','audit'].includes(next.action));
      assert.equal(next.plan.phase,1);assert.equal(next.plan.buy,0);
      console.log(JSON.stringify({campaignId:config.campaignId,gameId:next.plan.gameId,action:next.action,targetNew:next.plan.target}));
      const code=await child(next.plan,next.action);
      if(code!==0){process.exitCode=2;break;}
      if(next.action==='capture')lastTrial=next.plan.trialId;
      if(Number(process.env.SG_POOL_RUN_LIMIT || '0')>0)break;
    }
  }
}catch{console.log(JSON.stringify({error:'CAMPAIGN_WORKER_STOPPED'}));process.exitCode=2;}
finally{transport.close();}
