// Portable control fixtures: records/source/parser below are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RunnerState,RunnerPool} from './state-store.mjs';
import {GithubCampaign,idleAtAssignedTail} from './campaign.mjs';
import {BatchController} from './batch-controller.mjs';
import {captureBatch} from '../trial/capture-batch.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

async function fixture({target=3,baseline=true,ceiling=400,rotation=false,lanes=1}={}){
 const docs=new Map(),rounds=new Map();let failCAS=0,time=100000;
 const commit='c'.repeat(40),activation='d'.repeat(64),session='e'.repeat(64);
 const plan={trialId:'sg_r1_20260928_32723',gameId:32723,buy:0,phase:1,target,betRaw:25,maxSteps:100,sourceKey:'fixture',countAllocation:activation};
 if(lanes>1)Object.assign(plan,{gameId:32795,adapter:'pearl-wms-v1',sessionLayout:{schema:'sg-independent-sessions-v1',group:'primary',hosts:20,lanesPerHost:lanes}});
 const transport={async request(op,r){
  if(op==='resources')return {};
  if(op==='read_many')return r.keys.filter(k=>docs.has(r.collection+'/'+k)).map(k=>({_id:'primary/'+k,...structuredClone(docs.get(r.collection+'/'+k))}));
  if(op==='rounds_read')return r.ids.filter(id=>rounds.has(id)).map(id=>structuredClone(rounds.get(id)));
  if(op==='rounds_insert'){for(const row of r.records)rounds.set(row._id,structuredClone(row));return {};}
  if(op==='rounds_scan')return [...rounds.values()].filter(x=>x.sequence>r.after).sort((a,b)=>a.sequence-b.sequence).slice(0,2);
  const k=r.collection+'/'+r.key,old=docs.get(k);
  if(op==='read')return old?structuredClone(old):null;
  if(op==='create'){if(old)return {created:false};docs.set(k,{version:0,value:structuredClone(r.value)});return {created:true};}
  if(op==='cas'){
   if(failCAS-->0||old?.version!==r.version)return {replaced:false};
   docs.set(k,{version:r.version+1,value:structuredClone(r.value)});return {replaced:true,version:r.version+1};
  }throw Error('BAD_OP');
 }};
 const gate={observe(){},status:()=>({allowed:true,maxBatchSize:100}),hold(){}};
 const store=new RunnerState({transport,gate,now:()=>time,sleep:async()=>{}});
 const old={id:1,worker:0,start:1,end:300,sessionHash:'a'.repeat(64),checkpoint:1,journaled:1,pending:null,leaseUntil:0};
 const entries=baseline?[{id:1,worker:0,start:1,end:300,sessionHash:old.sessionHash,closed:true,complete:1,evidenceHash:hash(old)}]:[];
 const spec={schema:'sg-complete-count-v1',activation,commit,planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId,target,maxSequence:ceiling,baselineBatchCount:entries.length,baselineHash:hash(entries),firstSequence:baseline?301:1};
 if(rotation)spec.sessionRotation='closed-batches-v1';
 if(lanes>1)spec.sessionLayout=structuredClone(plan.sessionLayout);
 const key=`complete-count:${plan.trialId}:${activation}`;
 await store.create('journal',key,spec,{immutable:true});
 await store.create('journal',key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit},{immutable:true});
 const state={enabled:true,failure:null,planHash:hash(plan),confirmed:baseline?1:0,nextSequence:spec.firstSequence,nextBatchId:entries.length+1,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(entries.map(b=>[b.id,b]))}};
 await store.create('state','pool:'+plan.trialId,state);
 if(baseline){await store.create('state',`batch:${plan.trialId}:1`,old);rounds.set('old',{_id:'old',contentHash:'old',trialId:plan.trialId,batchId:1,shardId:0,sourceSessionHash:old.sessionHash,sequence:1,buy:0,fixtureOnly:false,normalized:{bonus:0},raw:{steps:[{msgId:'BET',responsePayload:'MSGID=BET&NFG=0'}]}});}
 await store.create('state','write-permits',{limit:1,slots:{}});
 await store.create('state','campaign',{enabled:true,activeGame:plan.gameId,games:[{game_id:plan.gameId,status:'active',baseline:300000-target}]});
 const parser={call:async r=>{
  if(r.op==='intent')return {};if(r.op==='next')return null;if(r.op==='verify')return {verified:true};
  assert.equal(r.op,'record');return {_id:String(r.sequence).padStart(64,'0'),contentHash:hash(r.raw),trialId:plan.trialId,batchId:r.batchId,shardId:r.worker,sourceSessionHash:r.sessionHash,sequence:r.sequence,fixtureOnly:false,buy:0,normalized:r.normalized,raw:r.raw};
 }};
 const control={allowed:async()=>store.get('state','pool:'+plan.trialId)};
 const pool=new RunnerPool({store,plan,group:'primary',commit,now:()=>time});
 const ctl=new BatchController({store,transport,gate,analyzer:parser,spool:{append(){},confirmed(){}},control,plan,group:'primary',commit,now:()=>time,sleep:async()=>{}});
 const campaign=new GithubCampaign({store,transport,control,analyzer:parser,plans:{[plan.gameId]:plan},group:'primary',commit,owner:'auditor',now:()=>time});
 return {store,docs,rounds,plan,spec,key,pool,ctl,campaign,commit,session,conflict(){failCAS=3;},advance(){time+=600001;},read:async()=>(await store.get('state',pool.key)).value};
}

for(const lanes of [2,4])test(`${lanes} independent lanes per host conserve exact last seven quotas under contention`,async()=>{
 const f=await fixture({target:7,baseline:false,lanes});
 const leases=await Promise.all(Array.from({length:20*lanes},(_,index)=>{
  const lane=Math.floor(index/20),host=index%20;
  const worker=host+40*lane;return f.pool.register(worker,{owner:'worker'+worker,sessionHash:hash('session'+worker)});
 }));
 f.conflict();const batches=await Promise.all(leases.map(l=>f.pool.take(l)));
 assert.equal(batches.filter(Boolean).length,7);
 const pool=await f.read();assert.equal(pool.countAllocation.reserved,7);
 assert.equal(Object.keys(pool.workers).length,20*lanes);
 assert.equal(new Set(batches.filter(Boolean).map(b=>b.start)).size,7);
 await assert.rejects(f.pool.register(20,{owner:'other-group',sessionHash:hash('other')}),/WORKER_GROUP/);
 await assert.rejects(f.pool.register(40*lanes,{owner:'extra-lane',sessionHash:hash('extra')}),/WORKER_GROUP/);
 const previous=hash([...f.docs]);
 await assert.rejects(f.pool.register(0,{owner:'stolen',sessionHash:hash('session40')}));
 assert.equal(hash([...f.docs]),previous);
});
test('environment-style plan expansion cannot bypass immutable activation or silently downgrade it',async()=>{
 const f=await fixture({lanes:2,baseline:false});
 f.plan.sessionLayout.lanesPerHost=4;
 await assert.rejects(f.pool.register(80,{owner:'unreviewed',sessionHash:hash('unreviewed')}),/COUNT_AUTHORIZATION/);
 delete f.plan.sessionLayout;
 await assert.rejects(f.pool.register(0,{owner:'downgrade',sessionHash:hash('downgrade')}),/COUNT_AUTHORIZATION/);
});

test('production campaign -> controller -> capture -> complete -> audit crosses old sequence tail',async()=>{
 const f=await fixture();assert.equal((await f.campaign.selectForRun('capture-run:1:1')).action,'capture');
 const rpc=(op,r={})=>f.ctl.rpc(op,{shardId:0,...r});
 const identity={owner:'new',sessionHash:f.session,commitSha:f.commit,planHash:hash(f.plan)};
 const registered=await rpc('register',identity),owner={owner:'new',workerEpoch:registered.workerEpoch};
 for(let i=0;i<2;i++){
  const lease=await rpc('next',owner);assert.equal(lease.sequenceBase,300+i);
  const owned={...owner,batchId:lease.batchId,epoch:lease.epoch};let calls=0;
  await captureBatch({plan:f.plan,lease,owned,rpc,evidence:{completedThisRun:0},state:{balance:10000},prepareRound:()=>({bonus:0,money:{endBalanceRaw:9975}}),payload:()=> 'MSGID=BET',bootstrap:async()=>10000,
   post:async(requestPayload,msgId)=>{calls++;assert.equal((await f.store.get('state',f.ctl.batchKey)).value.pending.awaiting,requestPayload);return {requestPayload,msgId,responsePayload:'MSGID=BET&NFG=0',elapsedMs:1};},shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
  assert.equal(calls,1);
 }
 assert.equal((await f.read()).confirmed,3);assert.equal((await rpc('next',owner)).done,true);
 assert.equal((await f.campaign.select()).action,'audit');assert.equal((await f.campaign.audit(f.plan)).fullReadback,3);
 assert.equal((await f.store.get('state','campaign')).value.games[0].status,'complete');
 assert.deepEqual([...f.rounds.values()].map(r=>r.sequence),[1,301,302]);
});

test('production CAS allocates only seven last slots under twenty-worker contention',async()=>{
 const f=await fixture({target:7,baseline:false});
 const leases=await Promise.all(Array.from({length:20},(_,i)=>f.pool.register(i,{owner:'worker'+i,sessionHash:(i+1).toString(16).padStart(64,'0')})));
 f.conflict();const batches=await Promise.all(leases.map(l=>f.pool.take(l)));
 assert.equal(batches.filter(Boolean).length,7);assert.equal((await f.read()).countAllocation.reserved,7);
 assert.equal(new Set(batches.filter(Boolean).map(b=>b.start)).size,7);
});

for(const bad of ['missing-complete','wrong-runtime','plan-downgrade','counter','baseline'])test('count permission rejects '+bad,async()=>{
 const f=await fixture();
 if(bad==='missing-complete')f.docs.delete('journal/'+f.key+':complete');
 if(bad==='wrong-runtime')f.pool.commit='f'.repeat(40);
 if(bad==='plan-downgrade')delete f.plan.countAllocation;
 if(bad==='counter')await f.store.update('state',f.pool.key,v=>({...v,confirmed:v.confirmed+1}));
 if(bad==='baseline')await f.store.update('state',f.pool.key,v=>{v.countAllocation.batches[1].sessionHash='f'.repeat(64);return v;});
 await assert.rejects(f.pool.register(0,{owner:'x',sessionHash:f.session}));
});

test('spent allocation ceiling stops fresh reservation despite complete deficit',async()=>{
 const f=await fixture({target:3,ceiling:301}),l=await f.pool.register(0,{owner:'x',sessionHash:f.session}),b=await f.pool.take(l);
 await f.pool.complete(l,b,{pending:null,confirmed:1,fullReadback:true});assert.equal(await f.pool.take(l),null);
 assert.equal((await f.read()).confirmed,2);
});

test('count-aware pool avoids legacy sequence tail exit; old behavior is preserved',async()=>{
 const f=await fixture();const p=await f.read();p.workers[0]={activeBatch:null,leaseUntil:0};
 assert.equal(await f.campaign.idleAtTail(f.plan,p,0),false);
 assert.equal(idleAtAssignedTail(p,0,3,100000),false);delete p.countAllocation;
 assert.equal(idleAtAssignedTail(p,0,3,100000),true);
});

test('parent worker yields when allocation ceiling is reached without claiming target completion',async()=>{
 const f=await fixture({target:3,ceiling:301}),l=await f.pool.register(0,{owner:'x',sessionHash:f.session}),b=await f.pool.take(l);
 await f.pool.complete(l,b,{pending:null,confirmed:1,fullReadback:true});await f.pool.release(l);
 assert.equal(await f.campaign.idleAtTail(f.plan,await f.read(),0),true);
 assert.equal((await f.read()).confirmed,2);
});

test('count controller settles a partial range, rotates session and audits the old immutable batch',async()=>{
 const f=await fixture({target:41,baseline:false,rotation:true});
 const rpc=(op,r={})=>f.ctl.rpc(op,{shardId:0,...r});
 const identity={owner:'first',sessionHash:f.session,commitSha:f.commit,planHash:hash(f.plan)};
 const registered=await rpc('register',identity),owner={owner:identity.owner,workerEpoch:registered.workerEpoch};
 const lease=await rpc('next',owner),owned={...owner,batchId:lease.batchId,epoch:lease.epoch};
 assert.equal(lease.sequenceTarget,3);
 const result=await captureBatch({plan:f.plan,lease,owned,rpc,evidence:{completedThisRun:0},state:{balance:10000},
  prepareRound:()=>({bonus:0,money:{endBalanceRaw:9975}}),payload:()=> 'MSGID=BET',bootstrap:async()=>10000,
  post:async(requestPayload,msgId)=>({requestPayload,msgId,responsePayload:'MSGID=BET&NFG=0',elapsedMs:1}),
  shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 assert.equal(result.status,'complete');assert.equal(result.discarded,2);
 const p=await f.read();assert.equal(p.confirmed,1);assert.equal(p.countAllocation.reserved,0);
 assert.equal(p.workers[0].activeBatch,null);assert.equal(p.nextSequence,4);
 await assert.rejects(f.pool.register(0,{owner:'second',sessionHash:'f'.repeat(64)}),/COUNT_SESSION_STILL_ACTIVE/);
 await f.pool.release(f.ctl.lease);
 await assert.rejects(f.pool.register(0,{owner:'second',sessionHash:f.session}),/COUNT_NEW_SESSION_REQUIRED/);
 const next=await f.pool.register(0,{owner:'second',sessionHash:'f'.repeat(64)});
 assert.equal((await f.pool.take(next)).start,4);
 const {auditCountBatch}=await import('./complete-count.mjs');
 const args={store:f.store,pool:await f.read(),plan:f.plan,spec:f.spec,record:[...f.rounds.values()][0],cache:new Map()};
 await auditCountBatch(args);
 await f.store.update('state',f.ctl.batchKey,b=>({...b,checkpoint:0}));
 await assert.rejects(auditCountBatch({...args,cache:new Map()}),/COUNT_AUDIT_BATCH_CHANGED/);
});

for(const dirty of ['pending','bootstrapAwaiting','pendingOriginal','checkpoint'])test('count settlement rejects '+dirty+' without releasing capacity',async()=>{
 const f=await fixture({target:41,baseline:false,rotation:true}),rpc=(op,r={})=>f.ctl.rpc(op,{shardId:0,...r});
 const reg=await rpc('register',{owner:'first',sessionHash:f.session,commitSha:f.commit,planHash:hash(f.plan)});
 const owner={owner:'first',workerEpoch:reg.workerEpoch},lease=await rpc('next',owner);
 // An external write must fail the controller fence even if a caller tries to release.
 await f.store.update('state',f.ctl.batchKey,b=>({...b,[dirty]:dirty==='checkpoint'?-1:{unknown:true}}));
 await assert.rejects(rpc('release',{...owner,batchId:lease.batchId,epoch:lease.epoch}));
 assert.equal((await f.read()).confirmed,0);assert.equal((await f.read()).countAllocation.reserved,3);
 assert.equal((await f.read()).workers[0].activeBatch.id,lease.batchId);
});
test('peer protocol stop after full settlement preserves batch bytes and immutable receipt',async()=>{
 const f=await fixture({target:1,baseline:false,rotation:true}),rpc=(op,r={})=>f.ctl.rpc(op,{shardId:0,...r});
 const identity={owner:'first',sessionHash:f.session,commitSha:f.commit,planHash:hash(f.plan)};
 const reg=await rpc('register',identity),owner={owner:'first',workerEpoch:reg.workerEpoch},lease=await rpc('next',owner);
 const owned={...owner,batchId:lease.batchId,epoch:lease.epoch};
 await captureBatch({plan:f.plan,lease,owned,rpc,evidence:{completedThisRun:0},state:{balance:10000},
  prepareRound:()=>({bonus:0,money:{endBalanceRaw:9975}}),payload:()=> 'MSGID=BET',bootstrap:async()=>10000,
  post:async(requestPayload,msgId)=>({requestPayload,msgId,responsePayload:'MSGID=BET&NFG=0',elapsedMs:1}),
  shouldStop:()=>false,requestStop(){},deadline:performance.now()+60000,limit:1});
 const batch=hash((await f.store.get('state',f.ctl.batchKey)).value);
 await f.store.update('state',f.pool.key,p=>({...p,enabled:false,failure:'PROTOCOL_VALIDATION_FAILED'}));
 await rpc('fail',{...owned,code:'POOL_PAUSED'});
 assert.equal(hash((await f.store.get('state',f.ctl.batchKey)).value),batch);
 const {auditCountBatch}=await import('./complete-count.mjs');
 await auditCountBatch({store:f.store,pool:await f.read(),plan:f.plan,spec:f.spec,record:{batchId:lease.batchId},cache:new Map()});
});
