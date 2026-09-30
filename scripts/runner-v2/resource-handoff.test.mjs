import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {exportResourceHistory,restoreResourceHistory} from './resource-handoff.mjs';
const identity=['repo','123','1','a'.repeat(40),'0'];
function fixture(){
 let time=100000,tick=0;const gate=new ResourceGate({now:()=>time});
 const sample=(cpu=10,bootId='boot-a')=>({sampledAtMs:time,bootId,cpuTicks:[tick*10+cpu,0,0,tick*90+100-cpu,0,0,0,0],memTotalKiB:1000,memAvailableKiB:500,diskFreeBytes:150*1024**3});
 for(let i=0;i<8;i++){time+=10000;tick++;gate.observe(sample());}
 return {gate,get time(){return time;},advance(ms=10000){time+=ms;tick++;},sample};
}
test('handoff requires fresh server counters, preserves gradual ramp and avoids duplicate 70 seconds',async()=>{
 const f=fixture(),child=new ResourceGate({now:()=>f.time});
 assert(restoreResourceHistory(child,exportResourceHistory(f.gate,identity),identity));
 assert.equal(child.status().allowed,false);f.advance();let reads=0,sleeps=0;
 const store=new RunnerState({gate:child,now:()=>f.time,transport:{request:async op=>{assert.equal(op,'resources');reads++;return f.sample();}},sleep:async()=>{sleeps++;}});
 await store.writable();assert.equal(reads,1);assert.equal(sleeps,0);assert.equal(child.status().maxBatchSize,10);
 const cold=new ResourceGate({now:()=>f.time});cold.observe(f.sample());assert.equal(cold.status().allowed,false);
});
test('wrong identity, stale history, altered counters, insufficient history and unhealthy parent fall back cold',()=>{
 for(const kind of ['identity','stale','counter','short','overload','gap','repeat','boot']){
  const f=fixture(),v=exportResourceHistory(f.gate,identity),child=new ResourceGate({now:()=>f.time});
  if(kind==='identity')v.identity[1]='999';if(kind==='stale')f.advance(30001);
  if(kind==='counter')v.samples.at(-1).cpuTicks.fill(0);if(kind==='short')v.samples=v.samples.slice(-7);
  if(kind==='overload')v.samples.at(-1).memAvailableKiB=1;
  if(kind==='gap')v.samples.at(-1).sampledAtMs+=31000;
  if(kind==='repeat')v.samples.at(-1).sampledAtMs=v.samples.at(-2).sampledAtMs;
  if(kind==='boot')v.samples.at(-1).bootId='new-boot';
  assert.equal(restoreResourceHistory(child,v,identity),false,kind);assert.equal(child.status().allowed,false);
 }
 const f=fixture();f.gate.hold('OPERATOR_PAUSED');assert.equal(exportResourceHistory(f.gate,identity),null);
});
test('fresh overload, reboot, stale or repeated sample cannot inherit permission; independent holds remain',async()=>{
 for(const kind of ['overload','reboot','stale','repeat','hold']){
  const f=fixture(),child=new ResourceGate({now:()=>f.time});assert(restoreResourceHistory(child,exportResourceHistory(f.gate,identity),identity));
  const old=f.sample();f.advance(kind==='stale'?31001:10000);const fresh=f.sample();
  if(kind==='overload')fresh.memAvailableKiB=1;if(kind==='reboot')fresh.bootId='different';
  if(kind==='hold')child.hold('OPERATOR_PAUSED');
  const store=new RunnerState({gate:child,now:()=>f.time,transport:{request:async()=>kind==='repeat'?old:fresh}});
  assert.equal((await store.sample()).allowed,false,kind);
 }
});
test('private parent-child pipe transfers bounded raw history and malformed input fails closed',async()=>{
 for(const valid of [true,false]){
  const f=fixture(),packet=exportResourceHistory(f.gate,identity);
  // Keep dates fresh in the child, while preserving the 70-second sequence.
  const shift=Date.now()-f.time;for(const s of packet.samples)s.sampledAtMs+=shift;
  const env={...process.env,SG_RESOURCE_HANDOFF:'pipe-v1'};
  ['GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SHA','SG_TRIAL_SHARD'].forEach((k,i)=>env[k]=identity[i]);
  const child=spawn(process.execPath,['--input-type=module','-e',`import {ResourceGate} from './scripts/runner-v2/resource-gate.mjs';import {readResourceHandoff} from './scripts/runner-v2/resource-handoff.mjs';const g=new ResourceGate();const restored=await readResourceHandoff(g);console.log(JSON.stringify({restored,allowed:g.status().allowed}));`],{env,stdio:['ignore','pipe','pipe','pipe']});
  let output='',errors='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>errors+=v);
  child.stdio[3].end(valid?JSON.stringify(packet):'malformed');
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  assert.equal(code,0,errors);assert.deepEqual(JSON.parse(output),{restored:valid,allowed:false});
 }
});
