import assert from 'node:assert/strict';
import test from 'node:test';
import {finalizeEndedSource,withSourceEndingReserve,SOURCE_ENDING_RESERVE_MS} from './sg-source-finalizer.mjs';
import {protectMongoOnce} from './sg-ag-once-mongo.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {cohortRepos} from './sg-federation.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {RunnerState} from '../state-store.mjs';
import {mongoOnce} from './sg-ag-ordinary-business.mjs';

function fixture({federated=false}={}){
 const run='123:1',commit='a'.repeat(40),events=[],docs=new Map(),leases=new Map();let clock=1000;
 const profile={activation:'b'.repeat(64),payload:{queueId:'own-queue',games:['32441','32442'].map(gameId=>({gameId,dbName:'sg_'+gameId,campaignId:'sg_'+gameId+'-own-queue'}))}};
 if(federated)profile.federation={schema:'sg-ag-two-cohort-v1',namespace:'primary',lanesPerCohort:20,totalLanes:40,
  assignments:profile.payload.games.map((g,i)=>({gameId:g.gameId,cohort:i?'secondary':'primary'}))};
 const participant=federated?{schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,
  activation:profile.activation,profileHash:queueHash(profile),queueId:profile.payload.queueId,coordinatorRun:run,commit,
  run:'456:1',assignmentHash:queueHash(profile.federation),sourceRequests:0}:undefined;
 const source={owner:run,status:'running',queueId:profile.payload.queueId,activation:profile.activation,commit,expiresAt:5000};
 docs.set('state/rolling-source',{_id:'primary/rolling-source',version:3,value:source});
 docs.set('journal/rolling-activation:'+profile.activation+':complete',{value:{schema:'sg-ag-rolling-permit-v1',queueId:profile.payload.queueId,
  run,commit,activation:profile.activation,profileHash:queueHash(profile),startsAt:500,expiresAt:5000}});
 docs.set('journal/business-intent',{value:{status:'unknown',count:173}});
 const status={closed:false,poison:null};
 const store={deadline:4000000,async get(c,k){events.push(['get',c,k]);return structuredClone(docs.get(c+'/'+k)??null);},
  async getMany(c,keys){events.push(['leases',...keys]);return keys.map(k=>leases.has(k)?{_id:'primary/'+k,value:structuredClone(leases.get(k))}:null);},
  async create(c,k,v,{immutable}){events.push(['create',c,k]);assert.equal(immutable,true);assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,{_id:'primary/'+k,version:0,value:structuredClone(v)});},
  async cas(c,k,b,v){events.push(['cas',c,k]);assert.equal(docs.get(c+'/'+k).version,b.version);docs.set(c+'/'+k,{_id:'primary/'+k,version:b.version+1,value:structuredClone(v)});return true;}};
 const args={profile,run,commit,store,transport:{status:()=>({...status})},sourceJobsEnded:true,deadline:4000000,now:()=>clock,
  sleep:async ms=>{events.push(['sleep',ms]);clock+=ms;},guard:async()=>events.push(['guard',store.deadline]),
  confirmSourceEnded:async()=>{events.push(['jobs']);return {sourceJobsEnded:true,...(participant?{participant:structuredClone(participant)}:{})};},
  reconcile:async()=>{events.push(['reconcile',store.deadline]);return [{gameId:'32441',status:'complete',count:300000},{gameId:'32442',status:'blocked',count:270000,reason:'SG_TASK_QUOTA_SHORT'}];}};
 return {args,events,docs,leases,status,participant,setTime:v=>{clock=v;},source:()=>docs.get('state/rolling-source').value,
  leaseKey:stagingLeaseKey(profile.payload.queueId,profile.payload.games[0],'worker',20),
  endingKey:'journal/rolling-ended:'+profile.payload.queueId+':'+run};
}
const mutated=f=>f.events.filter(e=>e[0]==='create'||e[0]==='cas');

test('ended source waits ten-minute leases, reconciles once, freshly rechecks evidence and seals actual results',async()=>{
 const f=fixture({federated:true});f.leases.set(f.leaseKey,{expiresAt:601000});
 const result=await finalizeEndedSource(f.args);
 assert.equal(result.complete,1);assert.equal(result.retained,1);assert.equal(result.games[1].count,270000);
 assert.equal(result.participant.run,'456:1');assert.equal(f.source().status,'idle');assert.equal(f.source().endedProofHash,queueHash(result));
 assert.equal(f.events.filter(e=>e[0]==='reconcile').length,1);assert.equal(f.events.filter(e=>e[0]==='jobs').length,2);
 assert.equal(f.events.filter(e=>e[0]==='sleep').reduce((sum,e)=>sum+e[1],0),600000);
 const business=f.events.findIndex(e=>e[0]==='reconcile'),fresh=f.events.findIndex((e,i)=>i>business&&e[0]==='leases');
 assert(fresh>business&&f.events.findIndex(e=>e[0]==='create')>fresh);
 assert.deepEqual(mutated(f).map(e=>e[0]),['create','cas']);
 assert.equal(f.docs.get('journal/business-intent').value.status,'unknown');
});

test('known business fault and genuine driver unknown both seal only source, retaining every intent and unknown result',async()=>{
 for(const driver of [false,true]){
  const f=fixture(),fault=Error(driver?'socket closed':'SG_AG_GAME_BUDGET_EXHAUSTED');let calls=0;
  const once=protectMongoOnce({async read(){calls++;throw fault;}});
  f.args.reconcile=async()=>{f.events.push(['reconcile']);if(driver)return once.client.read();calls++;throw fault;};
  const snapshot=structuredClone(f.docs.get('journal/business-intent')),result=await finalizeEndedSource(f.args);
  assert.equal(result.complete,0);assert.equal(result.retained,2);assert(result.businessFailure);
  assert(result.games.every(r=>r.status==='retained'&&r.count===0&&r.countKnown===false));
  assert.deepEqual(f.docs.get('journal/business-intent'),snapshot);assert.equal(calls,1);assert.equal(f.source().status,'idle');
  assert.equal(f.events.filter(e=>e[0]==='jobs').length,2);
 }
});

test('missing results remain explicitly unknown without inventing completion; blocked full-count remains retained',async()=>{
 const f=fixture();f.args.reconcile=async()=>[{gameId:'32441',status:'blocked',count:300000}];
 const result=await finalizeEndedSource(f.args);assert.equal(result.complete,0);assert.equal(result.retained,2);
 assert.equal(result.games[0].count,300000);assert.equal(result.games[1].countKnown,false);
});

test('native unknown, poisoned transport and closed transport always preserve the source fence',async()=>{
 for(const kind of ['unknown','poison','closed']){
  const f=fixture();f.args.reconcile=async()=>{
   if(kind==='unknown')throw Object.assign(Error('GATEWAY_ACK_UNKNOWN'),{outcomeUnknown:true});
   f.status[kind==='poison'?'poison':'closed']=kind==='poison'?'GATEWAY_ACK_UNKNOWN':true;
   throw Error('SG_AG_GAME_BUDGET_EXHAUSTED');
  };
  await assert.rejects(finalizeEndedSource(f.args));assert.equal(f.source().status,'running');assert.deepEqual(mutated(f),[]);
 }
});

test('an unknown callback wrapped by a protected business driver does not authorize source release',async()=>{
 const f=fixture(),fault=Object.assign(Error('SG_AG_GAME_BUDGET_PERSIST_UNKNOWN'),{outcomeUnknown:true});
 const once=protectMongoOnce({async read(){throw fault;}});f.args.reconcile=()=>once.client.read();
 await assert.rejects(finalizeEndedSource(f.args),error=>error===fault);assert.deepEqual(mutated(f),[]);
});

test('nonended initial jobs or fresh jobs after a business failure prevent source release',async()=>{
 for(const after of [false,true]){
  const f=fixture();let checks=0,calls=0;
  f.args.confirmSourceEnded=async()=>({sourceJobsEnded:++checks<(after?2:1)});
  f.args.reconcile=async()=>{calls++;throw Error('SG_BUSINESS_RETAINED');};
  await assert.rejects(finalizeEndedSource(f.args),/SOURCE_JOBS_ACTIVE/);assert.equal(calls,after?1:0);
  assert.deepEqual(mutated(f),[]);assert.equal(f.source().status,'running');
 }
});

test('a fresh live lease, missing lease readback or unknown lease read after business failure keeps fence',async()=>{
 for(const kind of ['live','missing','unknown']){
  const f=fixture();f.args.reconcile=async()=>{
   if(kind==='live')f.leases.set(f.leaseKey,{expiresAt:11000});
   else if(kind==='missing')f.args.store.getMany=async()=>[];
   else f.args.store.getMany=async()=>{throw Object.assign(Error('lease read unknown'),{outcomeUnknown:true});};
   throw Error('SG_BUSINESS_RETAINED');
  };
  await assert.rejects(finalizeEndedSource(f.args));assert.deepEqual(mutated(f),[]);assert(!f.events.some(e=>e[0]==='sleep'));
 }
});

test('changed source version, source identity, permit or participant never releases the source',async()=>{
 for(const kind of ['version','source','permit','participant']){
  const f=fixture({federated:true});f.args.reconcile=async()=>{
   if(kind==='version')f.docs.get('state/rolling-source').version++;
   if(kind==='source')f.source().owner='999:1';
   if(kind==='permit')f.docs.get('journal/rolling-activation:'+f.args.profile.activation+':complete').value.commit='c'.repeat(40);
   if(kind==='participant')f.participant.run='789:1';
   throw Error('SG_BUSINESS_RETAINED');
  };
  await assert.rejects(finalizeEndedSource(f.args));assert.deepEqual(mutated(f),[]);assert.equal(f.source().status,'running');
 }
});

test('malformed, foreign or duplicate business result never becomes a source completion proof',async()=>{
 for(const results of [null,[{gameId:'99999',count:300000}], [{gameId:'32441',status:'complete',count:5}],
  [{gameId:'32441',count:-1}],[{gameId:'32441',count:300001}],[{gameId:'32441'},{gameId:'32441'}]]){
  const f=fixture();f.args.reconcile=async()=>results;
  await assert.rejects(finalizeEndedSource(f.args),/FINALIZER_RESULT/);assert.deepEqual(mutated(f),[]);
 }
});

test('unknown ending create or readback keeps fence, and unknown CAS is issued exactly once without success',async()=>{
 for(const stage of ['create','readback','cas','cas-applied','idle-readback']){
  const f=fixture(),get=f.args.store.get,cas=f.args.store.cas;
  if(stage==='create')f.args.store.create=async()=>{f.events.push(['create']);throw Object.assign(Error('unknown create'),{outcomeUnknown:true});};
  if(stage==='readback')f.args.store.get=async(c,k)=>c+'/'+k===f.endingKey?null:get(c,k);
  if(stage==='cas'||stage==='cas-applied')f.args.store.cas=async(...args)=>{
   if(stage==='cas-applied')await cas(...args);else f.events.push(['cas']);
   throw Object.assign(Error('unknown CAS'),{outcomeUnknown:true});
  };
  if(stage==='idle-readback')f.args.store.get=async(c,k)=>{
   const row=await get(c,k);if(k==='rolling-source'&&row?.value.status==='idle')row.value.endedProofHash='bad';return row;
  };
  await assert.rejects(finalizeEndedSource(f.args));
  assert.equal(f.events.filter(e=>e[0]==='cas').length,['cas','cas-applied','idle-readback'].includes(stage)?1:0);
  if(!['cas-applied','idle-readback'].includes(stage))assert.equal(f.source().status,'running');
 }
});

test('source ending reserve expires business only, restores native deadline, and never calls business again',async()=>{
 const f=fixture(),original=f.args.store.deadline;let calls=0;
 f.args.reconcile=async()=>{calls++;assert.equal(f.args.store.deadline,original-SOURCE_ENDING_RESERVE_MS);
  f.setTime(f.args.store.deadline);throw Error('RESOURCE_WAIT_DEADLINE');};
 const result=await finalizeEndedSource(f.args);assert.equal(f.args.store.deadline,original);assert.equal(calls,1);
 assert.equal(result.businessFailure,'RESOURCE_WAIT_DEADLINE');assert.equal(f.source().status,'idle');
 const expired=fixture();expired.setTime(expired.args.deadline-SOURCE_ENDING_RESERVE_MS);let opened=0;
 expired.args.reconcile=async()=>{opened++;return [];};
 const retained=await finalizeEndedSource(expired.args);assert.equal(opened,0);assert.equal(retained.businessFailure,'SG_AG_FINALIZER_BUSINESS_DEADLINE');
 const successful=fixture();await withSourceEndingReserve({...successful.args,reconcile:async()=>[]});
 assert.equal(successful.args.store.deadline,successful.args.deadline);
});

test('real RunnerState guard expiry inside the business page wrapper remains deterministic and source can end',async()=>{
 const f=fixture();let writes=0;
 f.args.reconcile=async()=>{
  const state=new RunnerState({now:f.args.now,deadline:f.args.store.deadline});f.setTime(state.deadline);
  return mongoOnce(async()=>{await state.writable();writes++;return [];});
 };
 const result=await finalizeEndedSource(f.args);
 assert.equal(writes,0);assert.equal(result.businessFailure,'RESOURCE_WAIT_DEADLINE');assert.equal(f.source().status,'idle');
 assert.equal(f.events.filter(e=>e[0]==='jobs').length,2);
});

test('an already unknown metadata failure with deadline text remains unknown and does not release source',async()=>{
 const f=fixture(),fault=Object.assign(Error('RESOURCE_WAIT_DEADLINE'),{code:'RESOURCE_WAIT_DEADLINE',outcomeUnknown:true});
 f.args.reconcile=()=>mongoOnce(async()=>{throw fault;});
 await assert.rejects(finalizeEndedSource(f.args),error=>error===fault&&error.outcomeUnknown===true);
 assert.deepEqual(mutated(f),[]);assert.equal(f.source().status,'running');
});
