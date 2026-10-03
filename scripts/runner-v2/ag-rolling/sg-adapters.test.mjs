import assert from 'node:assert/strict';import test from 'node:test';
import {runLane,quotas,mergeDecision,taskId} from './ag-core.mjs';
import {connectTaskStore,prepareTasks,taskKey} from './sg-task-store.mjs';
import {validateSgPayload,taskEnvironment} from './sg-contract.mjs';
import {runCaptureTask} from './sg-capture-adapter.mjs';
import {serializeTransport} from './sg-transport.mjs';
import {coalesceWriter} from './sg-batch-writer.mjs';
import {createStagingStore} from './sg-staging-store.mjs';
const game=id=>({gameId:String(id),dbName:'sg_'+id,campaignId:'sg_'+id+'-queue',baseline:299980,mongoUri:'fixture:'+id});
function memory(){
 const docs=new Map();let casCalls=0;
 return {docs,get casCalls(){return casCalls;},
  async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},
  async getMany(c,ks){return Promise.all(ks.map(k=>this.get(c,k)));},
  async create(c,k,v){if(!docs.has(c+'/'+k))docs.set(c+'/'+k,{value:structuredClone(v),version:0});return this.get(c,k);},
  async cas(c,k,b,v){casCalls++;const old=docs.get(c+'/'+k);if(old.version!==b.version)return null;
   const result={value:structuredClone(v),version:b.version+1};docs.set(c+'/'+k,result);return structuredClone(result);},
 };
}
function proof(g,kind,index,owner,count){return {queueId:'queue',gameId:g.gameId,campaignId:g.campaignId,
 taskId:taskId(kind,index),owner,count,fullReadback:true,independentlyVerified:true,pending:0,activeLeases:0,
 unknownRequests:0,recordsHash:'a'.repeat(64)};}
const pause=()=>new Promise(r=>setImmediate(r));
test('SG payload retains AG fields and rejects unregistered scope or completed baseline',()=>{
 const games=[game(1),game(2)],p={version:1,queueId:'queue',games};
 const m=games.map(g=>({...g,phase:'ready'}));assert.equal(validateSgPayload(p,m),p);
 for(const change of [v=>v.games[0].baseline=300000,v=>v.games[0].mongoUri='other',v=>v.games.push(v.games[0]),v=>v.games[0].extra=1]){
  const bad=structuredClone(p);change(bad);assert.throws(()=>validateSgPayload(bad,m));
 }
 const env=taskEnvironment(games[0],'worker',1,1,'run:1:worker:1',{SG_ROLLING_PAYLOAD:'private',SECRET:'private',PATH:'runtime'});
 assert.equal(env.CONCURRENT_PER_GAME,'8');assert.equal(env.SECRET,undefined);assert.equal(env.SG_ROLLING_PAYLOAD,undefined);
 assert.equal(taskEnvironment(games[0],'canary',1,10,'run:1:canary:1').CONCURRENT_PER_GAME,'1');
});
test('SG task CAS grants each AG canary exactly once across 20 lanes; no shared per-round task write',async()=>{
 const store=memory(),g=game(1);await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 const counts=new Map();
 const connect=async g=>connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},
  verifyTask:async({kind,index,quota,owner})=>proof(g,kind,index,owner,quota)});
 await Promise.all(Array.from({length:20},(_,n)=>runLane({version:1,queueId:'queue',games:[g]},n+1,'run',{
  connect,now:()=>0,pause,log:()=>{},run:async(g,kind,index,quota)=>{
   const id=taskId(kind,index);counts.set(id,(counts.get(id)??0)+1);await pause();return 0;},
 })));
 assert.equal(counts.size,22);assert.ok([...counts.values()].every(c=>c===1));
 assert.ok([...store.docs.values()].every(d=>d.value.status==='success'));
 assert.ok(store.casCalls<90,'only claims/finalization contend; round count does not touch the queue');
});
test('full readback is required before SG task success; wrong receipt cannot be reused',async()=>{
 const store=memory(),g=game(1);await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 let p=proof(g,'worker',1,'run:1:worker:1',1);
 const s=connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},verifyTask:async()=>p});
 assert.equal(await s.claim('worker:1',p.owner),true);
 await assert.rejects(()=>s.finish('worker:1',p.owner,'success',0),/VERIFICATION/);
 for(const bad of [{fullReadback:false},{independentlyVerified:false},{pending:1},{activeLeases:1},{unknownRequests:1},{gameId:'2'},{count:9}]){
  const original=p;p={...p,...bad};await assert.rejects(()=>s.verify('worker',1,1));p=original;
 }
 await s.verify('worker',1,1);await s.finish('worker:1',p.owner,'success',0);
 assert.equal((await s.read('worker:1')).status,'success');
});
test('unknown task ACK is never retried and the running state stays for controller review',async()=>{
 const store=memory(),g=game(1);await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 const cas=store.cas.bind(store);let attempts=0;
 store.cas=async(...args)=>{attempts++;await cas(...args);throw Object.assign(new Error('unknown'),{outcomeUnknown:true});};
 const s=connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},verifyTask:async()=>{assert.fail();}});
 await assert.rejects(()=>s.claim('worker:1','run:1:worker:1'));
 assert.equal(attempts,1);assert.equal((await s.read('worker:1')).status,'running');
});
test('178 games run through the original AG lane loop; a blocked game does not stop other games',async()=>{
 const store=memory(),games=Array.from({length:178},(_,i)=>game(i+1));const calls=new Map();
 for(const g of games)await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 const healthy=await Promise.all(Array.from({length:20},(_,n)=>runLane({version:1,queueId:'queue',games},n+1,'run',{
  connect:async g=>connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},
   verifyTask:async({kind,index,quota,owner})=>proof(g,kind,index,owner,quota)}),
  now:()=>0,pause,log:()=>{},run:async(g,kind,index,quota)=>{
   const key=g.gameId+':'+taskId(kind,index);calls.set(key,(calls.get(key)??0)+1);await pause();return g.gameId==='2'?78:0;
  },
 })));
 assert.ok(healthy.every(Boolean));
 for(const g of games){
  const rows=Array.from({length:20},(_,n)=>store.docs.get('state/'+taskKey('queue',g,taskId('worker',n+1))).value);
  assert.ok(rows.every(r=>r.status===(g.gameId==='2'?'blocked':'success')));
  if(g.gameId!=='2')assert.equal(mergeDecision({...g,phase:'ready'},rows,'queue',quotas(g.baseline),0).acceptable,true);
 }
 assert.ok([...calls.values()].every(c=>c===1));
});
function captureFixture(g,{sourceUnknown=false,insertUnknown=false,readback=false}={}){
 const records=[];let opens=0,active=0,maxActive=0,rounds=0,lease=false,closed=0;
 const protocol={async open(){const id=++opens;return {identity:'session-'+id,close(){closed++;},async captureRound(){
  const sequence=++rounds;active++;maxActive=Math.max(active,maxActive);await pause();active--;
  if(sourceUnknown)throw Object.assign(new Error('private source error'),{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN'});
  return {isFeature:false,optionIndex:0,balance:10000,bet:1,data:{complete:true,independentlyVerified:true,unknownRequests:0,roundEvents:[]},seq:sequence};
 }}}};
 const storage={async tryAcquireGameLease(){lease=true;return true;},async renewGameLease(){return lease;},
  async releaseGameLease(){lease=false;},async getCounts(){return {base:0,feature:0,optionCount:0,freeChoiceOptions:{}};},
  async insertRound(db,round){if(insertUnknown)throw Object.assign(new Error('unknown insert'),{code:'MONGO_ACK_UNKNOWN'});
   records.push(round);return {fullReadback:!readback,independentlyVerified:true};},
  async verify({kind,index,quota,owner}){return {...proof(g,kind,index,owner,records.length),activeLeases:lease?1:0,fullReadback:!readback};},
 };
 return {protocol,storage,records,get stats(){return {rounds,opens,maxActive,closed,lease};}};
}
test('the original AG session class runs eight SG sessions, drains at quota, and stays inside AG +7 bound',async()=>{
 const g={...game(1),baseline:299800},f=captureFixture(g);
 const r=await runCaptureTask({game:g,kind:'worker',index:1,quota:10,owner:'run:1:worker:1',
  protocol:f.protocol,storage:f.storage,guard:async()=>{},deadline:Date.now()+5000});
 assert.equal(r.exitCode,0);assert.equal(f.stats.maxActive,8);assert.equal(f.stats.lease,false);
 assert.ok(f.records.length>=10&&f.records.length<=17);assert.equal(f.stats.closed,f.stats.opens);
});
test('unknown SG source outcome aborts the unchanged AG retry loop before any source retry',async()=>{
 const g=game(1),f=captureFixture(g,{sourceUnknown:true});
 const r=await runCaptureTask({game:g,kind:'canary',index:1,quota:10,owner:'run:1:canary:1',
  protocol:f.protocol,storage:f.storage,guard:async()=>{},deadline:Date.now()+5000});
 assert.equal(r.exitCode,1);assert.equal(r.unknownOutcome,true);assert.equal(f.stats.rounds,1);
 assert.equal(f.records.length,0);assert.equal(f.stats.lease,false);
});
test('no count or task success is accepted after failed Mongo full readback or unknown insert',async()=>{
 for(const fault of [{readback:true},{insertUnknown:true}]){
  const g=game(1),f=captureFixture(g,fault);
  const r=await runCaptureTask({game:g,kind:'canary',index:1,quota:10,owner:'run:1:canary:1',
   protocol:f.protocol,storage:f.storage,guard:async()=>{},deadline:Date.now()+5000});
  assert.equal(r.exitCode,1);assert.equal(f.stats.lease,false);
 }
});
test('zero-quota SG shard emits no source request and still requires an independently verified empty result',async()=>{
 const g={...game(1),baseline:299999},f=captureFixture(g);
 const r=await runCaptureTask({game:g,kind:'worker',index:2,quota:0,owner:'run:2:worker:2',
  protocol:f.protocol,storage:f.storage,guard:async()=>{},deadline:Date.now()+5000});
 assert.equal(r.exitCode,0);assert.equal(f.stats.rounds,0);assert.equal(f.stats.opens,0);
});
test('native SSH adapter serializes eight calls and poisons queued calls after an unknown ACK',async()=>{
 let active=0,peak=0,calls=0,closed=0;
 const base={async request(op){calls++;active++;peak=Math.max(peak,active);await pause();active--;
  if(op==='unknown')throw Object.assign(new Error('unknown'),{code:'GATEWAY_ACK_UNKNOWN'});return op;},close(){closed++;}};
 const t=serializeTransport(base);assert.deepEqual(await Promise.all(Array.from({length:8},(_,n)=>t.request(String(n)))),['0','1','2','3','4','5','6','7']);
 assert.equal(peak,1);
 const r=await Promise.allSettled([t.request('unknown'),t.request('write'),t.request('write')]);
 assert.ok(r.every(v=>v.status==='rejected'));assert.equal(calls,9);assert.equal(closed,1);
 await assert.rejects(()=>t.request('write'));assert.equal(calls,9);
});
test('eight concurrent AG inserts coalesce once; no caller resolves before exact full content readback',async()=>{
 let calls=0,allow;const hold=new Promise(r=>allow=r);let resolved=0;
 const w=coalesceWriter({guard:async()=>{},flushDelayMs:0,writeAndReadback:async rows=>{calls++;await hold;return structuredClone(rows);}});
 const ps=Array.from({length:8},(_,n)=>w.insert({_id:'row-'+n,value:n}).then(v=>{resolved++;return v;}));
 await new Promise(r=>setTimeout(r,10));assert.equal(resolved,0);assert.equal(calls,1);
 allow();assert.ok((await Promise.all(ps)).every(v=>v.fullReadback));await w.close();assert.equal(resolved,8);
});
test('wrong native bytes reject the whole coalesced batch and no write is automatically retried',async()=>{
 let calls=0;const w=coalesceWriter({guard:async()=>{},flushDelayMs:0,
  writeAndReadback:async rows=>{calls++;return rows.map((r,i)=>i? r:{...r,value:'wrong'});}});
 const result=await Promise.allSettled([w.insert({_id:'1',value:'original'}),w.insert({_id:'2',value:'original'})]);
 assert.ok(result.every(v=>v.status==='rejected'));assert.equal(calls,1);
 await assert.rejects(()=>w.insert({_id:'3',value:'original'}));assert.equal(calls,1);
});
test('staging storage uses one batch for eight fixture inserts, verifies readback, and isolates AG task leases',async()=>{
 const store=memory(),g={...game(1),baseline:299840},owner='run:1:worker:1';
 await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 const task=connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},verifyTask:async()=>{}});
 assert.ok(await task.claim('worker:1',owner));let batches=0,validationCalls=0;
 const transport={async request(op,fields){
  if(op==='hello')return {database:'sg_capture_staging_v1',rollingJournalBatchEnabled:true};
  assert.equal(op,'rolling_journal_insert');batches++;
  for(const r of fields.records){await store.create('journal',r.key,r.value);
   store.docs.get('journal/'+r.key)._id='primary/'+r.key;}
  return {inserted:fields.records.length};
 }};
 const storage=createStagingStore({store,transport,game:g,queueId:'queue',kind:'worker',index:1,quota:8,owner,
  guard:async()=>{},inspectSource:async()=>({queueId:'queue',gameId:g.gameId,taskId:'worker:1',owner,
   pending:0,unknownRequests:0,activeLeases:0,protocolFaults:0,sourcesClosed:true}),
  assertDurable:async rows=>assert.equal(rows.length,8),verifyRecords:async rows=>{
   validationCalls++;assert.ok(rows.every(r=>r.fixtureOnly===false&&r.buy===0));return {verified:true,count:rows.length};
  }});
 assert.ok(await storage.tryAcquireGameLease(g.dbName,g.gameId,owner,600000));await storage.getCounts(g.dbName);
 const rows=Array.from({length:8},(_,i)=>({_id:String(i).padStart(64,'0'),contentHash:'a'.repeat(64),fixtureOnly:false,buy:0,gameId:1,raw:{frame:i}}));
 assert.ok((await Promise.all(rows.map(record=>storage.insertRound(g.dbName,{data:{sgRecord:record}})))).every(r=>r.fullReadback));
 assert.equal(batches,1);await storage.releaseGameLease(g.dbName,owner);
 const receipt=await storage.verify();assert.equal(receipt.count,8);assert.equal(receipt.activeLeases,0);assert.equal(validationCalls,2);
 assert.equal(store.docs.has('state/campaign'),false);assert.equal(store.docs.has('state/pool'),false);
});
