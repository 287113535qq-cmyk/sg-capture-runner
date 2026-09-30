import fs from 'node:fs';
import {ResourceGate,resourcePolicy} from './resource-gate.mjs';

// Private pipe from the campaign parent, never a saved permit or source grant.
// Replay measured counters, not an inherited "allowed" boolean. The child
// must obtain a new server sample before its first request can write.
export function handoffIdentity(env=process.env){
  return ['GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','SG_TRIAL_SHARD'].map(k=>env[k]??'');
}
export function exportResourceHistory(gate,identity=handoffIdentity()){
  if(!gate.status().allowed)return null;
  return {schema:1,identity:structuredClone(identity),samples:structuredClone(gate.history)};
}
export function restoreResourceHistory(gate,value,identity=handoffIdentity()){
  try{
    if(gate.previous!==null||!value||value.schema!==1||JSON.stringify(value.identity)!==JSON.stringify(identity)
      ||identity.some(v=>typeof v!=='string'||!v)||!Array.isArray(value.samples)
      ||value.samples.length<8||value.samples.length>16)return false;
    const current=gate.now(),samples=value.samples,last=samples.at(-1)?.sampledAtMs;
    if(!Number.isFinite(last)||current-last>resourcePolicy.maxAgeMs||last>current)return false;
    let replayTime=samples[0]?.sampledAtMs;
    const replay=new ResourceGate({now:()=>replayTime});
    for(const sample of samples){
      if(!Number.isFinite(sample?.sampledAtMs)||sample.sampledAtMs>current)return false;
      replayTime=sample.sampledAtMs;replay.observe(sample);
      if(replay.history.length===0)return false;
    }
    // A reset, gap or overload is handled by the original recovery policy.
    if(!replay.status().allowed)return false;
    for(const key of ['previous','latest','paused','reason','lowSince','resumedAt','history'])gate[key]=structuredClone(replay[key]);
    gate.hold('RESOURCE_HANDOFF_FRESH_REQUIRED');
    return true;
  }catch{return false;}
}
export function readResourceHandoff(gate,{env=process.env,fd=3}={}){
  if(env.SG_RESOURCE_HANDOFF!=='pipe-v1')return Promise.resolve(false);
  return new Promise(resolve=>{
    const stream=fs.createReadStream(null,{fd,autoClose:true});let chunks=[],size=0,done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);stream.destroy();resolve(value);};
    const timer=setTimeout(()=>finish(false),5000);
    stream.on('data',chunk=>{size+=chunk.length;if(size>32768)finish(false);else chunks.push(chunk);});
    stream.on('error',()=>finish(false));
    stream.on('end',()=>{try{finish(restoreResourceHistory(gate,JSON.parse(Buffer.concat(chunks).toString()),handoffIdentity(env)));}catch{finish(false);}});
  });
}
