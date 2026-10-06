import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {waitForEndedLeases,ENDED_LEASE_WAIT_MS} from './sg-ended-leases.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

function fixture({games=6}={}){
 const payload={queueId:'queue',games:Array.from({length:games},(_,i)=>({gameId:String(32441+i),dbName:'sg_'+(32441+i),campaignId:'sg_'+(32441+i)+'-queue'}))};
 const profile={payload},leases=new Map(),events=[];let clock=1000;
 const store={async getMany(collection,keys){assert.equal(collection,'state');events.push(['read',...keys]);
  return keys.map(key=>leases.has(key)?{_id:'primary/'+key,value:structuredClone(leases.get(key))}:null);}};
 const args={profile,store,sourceJobsEnded:true,deadline:100000,now:()=>clock,
  guard:async()=>{events.push(['guard']);},sleep:async ms=>{events.push(['sleep',ms]);clock+=ms;}};
 const key=(game,kind,index)=>stagingLeaseKey(payload.queueId,payload.games[game],kind,index);
 return {args,leases,events,key,setTime:time=>{clock=time;}};
}

test('ended source waits for the final cohort lease to expire before one control open and reconciliation',async()=>{
 const f=fixture();f.leases.set(f.key(0,'canary',1),{expiresAt:11000});f.leases.set(f.key(5,'worker',20),{expiresAt:21000});
 const finalize=async()=>{await waitForEndedLeases(f.args);f.events.push(['open-control']);f.events.push(['reconcile']);};
 await finalize();
 assert.equal(f.events.filter(e=>e[0]==='sleep').length,2);
 const reads=f.events.filter(e=>e[0]==='read');assert.equal(reads.length,6);
 for(let page=0;page<reads.length;page+=2){
  assert.equal(reads[page].length-1,100);assert.equal(reads[page+1].length-1,32);
  const keys=reads.slice(page,page+2).flatMap(e=>e.slice(1));assert.equal(new Set(keys).size,132);
  assert(keys.includes(f.key(0,'canary',1))&&keys.includes(f.key(5,'worker',20)));
 }
 assert.deepEqual(f.events.slice(-2),[['open-control'],['reconcile']]);
 assert.equal(f.events.filter(e=>e[0]==='reconcile').length,1);
});

test('expired and explicitly absent leases do not add a polling delay',async()=>{
 const f=fixture({games:1});f.leases.set(f.key(0,'worker',7),{expiresAt:1000});
 await waitForEndedLeases(f.args);assert.deepEqual(f.events.map(e=>e[0]),['guard','read']);
});

test('active source jobs or exhausted deadline prevents every lease read and control action',async()=>{
 for(const invalid of ['active','deadline']){
  const f=fixture();if(invalid==='active')f.args.sourceJobsEnded=false;else f.args.deadline=1000;
  await assert.rejects(()=>waitForEndedLeases(f.args),/SOURCE_JOBS_ACTIVE|SOURCE_LEASES_ACTIVE/);
  assert.deepEqual(f.events,[]);
 }
});

test('lease polling is deadline bounded and never reconciles after timeout',async()=>{
 const f=fixture({games:1});f.args.deadline=11500;f.leases.set(f.key(0,'worker',20),{expiresAt:99999});let reconciled=0;
 await assert.rejects(async()=>{await waitForEndedLeases(f.args);reconciled++;},/SOURCE_LEASES_ACTIVE/);
 assert.deepEqual(f.events.filter(e=>e[0]==='sleep').map(e=>e[1]),[10000,500]);assert.equal(reconciled,0);
 const slow=fixture({games:1}),read=slow.args.store.getMany;
 slow.args.store.getMany=async(...args)=>{const rows=await read(...args);slow.setTime(slow.args.deadline);return rows;};
 await assert.rejects(()=>waitForEndedLeases(slow.args),/SOURCE_LEASES_ACTIVE/);
});

test('truncated, unknown, misordered and invalid lease readback fail closed without polling',async()=>{
 for(const corrupt of [rows=>rows.slice(1),rows=>{rows[0]=undefined;return rows;},rows=>{delete rows[0];return rows;},rows=>{rows[0]={_id:'primary/foreign',value:{expiresAt:0}};return rows;},
  rows=>{rows[0].value={};return rows;},rows=>{rows[0].value.expiresAt='0';return rows;},rows=>{rows[0].value.expiresAt=-1;return rows;},
  rows=>{rows[0].value.expiresAt=NaN;return rows;},rows=>rows.reverse(),()=>null]){
  const f=fixture({games:1});f.leases.set(f.key(0,'canary',1),{expiresAt:0});const read=f.args.store.getMany;
  f.args.store.getMany=async(...args)=>corrupt(await read(...args));
  await assert.rejects(()=>waitForEndedLeases(f.args),/SOURCE_LEASE_READBACK/);assert(!f.events.some(e=>e[0]==='sleep'));
 }
 const f=fixture();let calls=0;f.args.store.getMany=async()=>{calls++;throw Object.assign(Error('unknown lease read'),{outcomeUnknown:true});};
 await assert.rejects(()=>waitForEndedLeases(f.args),/unknown lease read/);assert.equal(calls,1);
});

test('finalizer wiring delegates both controller paths to one source-ending lifecycle',()=>{
 const text=fs.readFileSync(new URL('./sg-live.mjs',import.meta.url),'utf8');
 const finalizer=text.slice(text.indexOf('  sourceJobsEnded=true;'));
 const lifecycle=finalizer.indexOf('await finalizeEndedSource('),callback=finalizer.indexOf('reconcile:async()=>'),opening=finalizer.indexOf('await openExistingWorkflowControl(');
 const reconcile=finalizer.indexOf('return fullControl.reconcile()'),legacy=finalizer.indexOf('await merge(game)');
 assert(lifecycle>=0&&callback>lifecycle&&opening>callback&&reconcile>opening&&legacy>callback);
 assert.equal(finalizer.match(/await finalizeEndedSource\(/g).length,1);
 assert.equal(finalizer.match(/return fullControl\.reconcile\(\)/g).length,1);
 assert.equal(finalizer.match(/await merge\(game\)/g).length,1);
 assert(finalizer.includes('freshJobs.jobs.every(j=>j.run_id===id)'));
});

test('normal capture TTL expires within ten minutes and no lease can occupy more than twelve minutes',async()=>{
 const f=fixture({games:1});f.args.deadline=10000000;f.leases.set(f.key(0,'worker',20),{expiresAt:601000});
 await waitForEndedLeases(f.args);
 assert.equal(f.events.filter(e=>e[0]==='sleep').reduce((sum,e)=>sum+e[1],0),600000);
 const late=fixture({games:1});late.args.deadline=10000000;
 late.leases.set(late.key(0,'worker',20),{expiresAt:1000+ENDED_LEASE_WAIT_MS});
 await assert.rejects(waitForEndedLeases(late.args),/SOURCE_LEASES_ACTIVE/);
 assert.equal(late.events.filter(e=>e[0]==='sleep').reduce((sum,e)=>sum+e[1],0),ENDED_LEASE_WAIT_MS);
 const anomalous=fixture({games:1});anomalous.args.deadline=10000000;
 anomalous.leases.set(anomalous.key(0,'worker',20),{expiresAt:1001+ENDED_LEASE_WAIT_MS});
 await assert.rejects(waitForEndedLeases(anomalous.args),/SOURCE_LEASE_EXPIRY_OUT_OF_BOUND/);
 assert(!anomalous.events.some(e=>e[0]==='sleep'));
});

test('fresh final ending checks never poll or clear a lease that reappears',async()=>{
 const f=fixture({games:1});f.leases.set(f.key(0,'worker',1),{expiresAt:11000});
 await assert.rejects(waitForEndedLeases({...f.args,waitForExpiry:false}),/SOURCE_LEASES_ACTIVE/);
 assert(!f.events.some(e=>e[0]==='sleep'));assert.equal(f.leases.size,1);
});
