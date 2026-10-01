import test from 'node:test';
import assert from 'node:assert/strict';
import {ResourceGate} from './resource-gate.mjs';

function fixture() {
  let time=100_000,user=0,idle=0;
  const gate=new ResourceGate({now:()=>time});
  return {gate,advance(ms){time+=ms;},sample(cpu=10,memory=50,bootId='boot-a') {
    time+=10_000; user+=cpu; idle+=100-cpu;
    return {sampledAtMs:time,bootId,cpuTicks:[user,0,0,idle,0,0,0,0],
      memTotalKiB:100_000,memAvailableKiB:1000*(100-memory),diskFreeBytes:150*1024**3};
  },observe(cpu=10,memory=50,bootId='boot-a') {return gate.observe(this.sample(cpu,memory,bootId));},
  ready(){for(let i=0;i<8;i++)this.observe();assert.equal(gate.status().allowed,true);}};
}
test('requires baseline and sixty seconds of healthy samples; resumes in small batches',()=>{
  const f=fixture(); for(let i=0;i<7;i++)assert.equal(f.observe().allowed,false);
  assert.equal(f.observe().maxBatchSize,10);
  for(let i=0;i<3;i++)f.observe();assert.equal(f.gate.status().maxBatchSize,25);
  for(let i=0;i<3;i++)f.observe();assert.equal(f.gate.status().maxBatchSize,100);
});
test('diagnostics separate startup from later resource pauses without relaxing protection',()=>{
 const f=fixture();f.ready();assert.equal(f.gate.diagnostics().pauseTransitionsAfterReady,0);
 assert.equal(f.observe(96,50).allowed,false);assert.equal(f.gate.diagnostics().pauseTransitionsAfterReady,1);
 f.observe(96,50);assert.equal(f.gate.diagnostics().pauseTransitionsAfterReady,1);
 f.ready();f.advance(30001);assert.equal(f.gate.status().allowed,false);assert.equal(f.gate.diagnostics().pauseTransitionsAfterReady,2);
 assert.equal(f.gate.diagnostics().peakCpuPercent,96);assert.equal(f.gate.diagnostics().observationOnly,true);
});
for(const metric of ['cpu','memory'])test(`${metric} at 95 pauses; both below 90 must remain stable`,()=>{
  const f=fixture();f.ready();
  assert.equal(f.observe(metric==='cpu'?95:10,metric==='memory'?95:50).reason,'RESOURCE_OVERLOAD');
  for(let i=0;i<6;i++)assert.equal(f.observe().allowed,false);
  assert.equal(f.observe(90,50).allowed,false);
  for(let i=0;i<6;i++)assert.equal(f.observe().allowed,false);
  assert.equal(f.observe().allowed,true);
});
test('stale, invalid, missing or repeated samples cannot authorize writes',()=>{
  const f=fixture();f.ready(); f.advance(30_001);
  assert.equal(f.gate.status().reason,'RESOURCE_SAMPLE_STALE');
  assert.equal(f.observe().allowed,false);
  f.ready();assert.equal(f.gate.observe(null).allowed,false);
  f.ready();const s=f.sample();f.gate.observe(s);assert.equal(f.gate.observe(s).allowed,false);
  f.ready();const bad=f.sample();bad.memAvailableKiB=-1;assert.equal(f.gate.observe(bad).allowed,false);
});
test('counter reset or boot change requires a new baseline',()=>{
  const f=fixture();f.ready();assert.equal(f.observe(10,50,'boot-b').allowed,false);
  f.ready();const s=f.sample();s.cpuTicks.fill(0);assert.equal(f.gate.observe(s).reason,'RESOURCE_COUNTER_INVALID');
});
test('healthy resources do not clear database, disk or operator holds',()=>{
  const f=fixture();f.ready();
  for(const reason of ['MONGO_CONTENT_CONFLICT','DISK_RESERVE_REACHED','OPERATOR_PAUSED'])f.gate.hold(reason);
  for(let i=0;i<20;i++)f.observe();assert.equal(f.gate.status().allowed,false);
  f.gate.releaseHold('MONGO_CONTENT_CONFLICT');assert.equal(f.gate.status().allowed,false);
});
