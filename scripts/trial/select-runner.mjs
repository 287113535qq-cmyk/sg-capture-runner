// Only measures the existing restricted storage endpoint. No SG credentials or
// source HTTP requests are used by candidate runners.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connect} from './rpc.mjs';
const plan=JSON.parse(fs.readFileSync('config/trial-300k.json','utf8'));
const runId=process.env.GITHUB_RUN_ID,candidate=Number(process.env.SG_TRIAL_SHARD);
assert(/^\d{1,20}$/.test(runId || ''));
assert(Number.isInteger(candidate) && candidate>=0 && candidate<20);
const transport=connect(plan),rpc=transport.rpc;
let result={selected:false};
try {
  await rpc('ping'); // Exclude SSH startup from the steady connection sample.
  const samples=[];
  for(let i=0;i<10;i++){
    const start=performance.now(),reply=await rpc('ping');
    samples.push(Math.max(0,performance.now()-start-reply.serverWorkMs));
  }
  samples.sort((a,b)=>a-b);
  const networkMs=Number(((samples[4]+samples[5])/2).toFixed(3));
  result=await rpc('runner_register',{runId,candidate,networkMs});
  if(result.eligible){
    for(let i=0;i<3;i++){
      await new Promise(resolve=>setTimeout(resolve,Math.min(46000,Math.max(0,result.waitMs || 0)+200)));
      result=await rpc('runner_select',{runId,candidate});
      if(result.ready)break;
    }
    assert(result.ready);
  }
  console.log(JSON.stringify({storageProbeOnly:true,officialSourceRequests:0,candidate,networkMs,...result}));
  if(process.env.GITHUB_OUTPUT){
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`selected=${result.selected===true}\n`);
    if(['complete','halted'].includes(result.trialStatus))fs.appendFileSync(process.env.GITHUB_OUTPUT,`trial_status=${result.trialStatus}\n`);
  }
}catch(error){
  console.log(JSON.stringify({storageProbeOnly:true,officialSourceRequests:0,candidate,error:/^[A-Z_]{1,80}$/.test(error.code || '')?error.code:'RUNNER_SELECTION_FAILED'}));
  process.exitCode=2;
}finally{transport.close();}
