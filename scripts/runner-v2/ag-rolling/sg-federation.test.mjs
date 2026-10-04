import test from 'node:test';import assert from 'node:assert/strict';
import {cohortRepos,cohortView,inspectFederation,joinCohort,participantKey,endedCohortJobs} from './sg-federation.mjs';
import {queueHash} from './sg-queue-profile.mjs';import {sourcePermit} from './sg-queue-control.mjs';
import {runLane,taskId} from './ag-core.mjs';import {prepareTasks,connectTaskStore,taskKey} from './sg-task-store.mjs';
function fixture(){
 const games=['32441','32442','32443','32464'].map(id=>({gameId:id,campaignId:'sg_'+id+'-queue',dbName:'sg_'+id,baseline:299980,mongoUri:'fixture:'+id}));
 const profile={activation:'a'.repeat(64),payload:{version:1,queueId:'queue',games},manifest:games.map(g=>({...g,phase:'ready'})),
  nativeGatewayHash:'b'.repeat(64),nativeManifestHash:'c'.repeat(64),federation:{schema:'sg-ag-two-cohort-v1',lanesPerCohort:20,totalLanes:40,namespace:'primary',
   assignments:games.map((g,i)=>({gameId:g.gameId,cohort:i%2?'secondary':'primary'}))}};
 const docs=new Map(),writes=[];
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},
  async create(c,k,v,{immutable=false}={}){writes.push(['create',k]);const old=docs.get(c+'/'+k);if(old&&immutable)assert.equal(queueHash(old.value),queueHash(v));
   if(!old)docs.set(c+'/'+k,{value:structuredClone(v),version:0});return this.get(c,k);},
  async cas(c,k,b,v){writes.push(['cas',k]);if(docs.get(c+'/'+k).version!==b.version)return null;docs.set(c+'/'+k,{value:structuredClone(v),version:b.version+1});return this.get(c,k);}};
 return {profile,store,docs,writes};
}
test('forty original AG lanes cover disjoint games once and retain the original 22-task quota namespace',async()=>{
 const {profile,store,docs}=fixture(),calls=new Map(),pause=()=>new Promise(r=>setImmediate(r));
 for(const g of profile.payload.games)await prepareTasks({store,game:g,queueId:'queue',guard:async()=>{}});
 const oldKeys=[...docs.keys()];
 await Promise.all(Object.values(cohortRepos).flatMap(repository=>{
  const view=cohortView(profile,repository);return Array.from({length:20},(_,i)=>runLane(view.payload,i+1,view.cohort,{
   now:()=>0,pause,log:()=>{},connect:async g=>connectTaskStore({store,game:g,queueId:'queue',guard:async()=>{},
    verifyTask:async({kind,index,owner,quota})=>({queueId:'queue',gameId:g.gameId,campaignId:g.campaignId,taskId:taskId(kind,index),owner,count:quota,
     fullReadback:true,independentlyVerified:true,pending:0,activeLeases:0,unknownRequests:0,recordsHash:'d'.repeat(64)})}),
   run:async(g,kind,index)=>{const key=taskKey('queue',g,taskId(kind,index));calls.set(key,(calls.get(key)??0)+1);await pause();return 0;}}));
 }));
 assert.equal(calls.size,4*22);assert.ok([...calls.values()].every(n=>n===1));assert.deepEqual([...docs.keys()],oldKeys);
 for(const g of profile.payload.games){const expected=profile.federation.assignments.find(a=>a.gameId===g.gameId).cohort;
  for(const [key,row] of docs)if(row.value.campaignId===g.campaignId){assert.equal(row.value.status,'success');assert.ok(row.value.owner.startsWith(expected+':'));}}
});
test('duplicate, reordered, missing or unknown-cohort game assignments cannot enable a second source',()=>{
 for(const change of [p=>p.federation.assignments[1].gameId=p.federation.assignments[0].gameId,
  p=>p.federation.assignments.reverse(),p=>p.federation.assignments.pop(),p=>p.federation.assignments[0].cohort='other',
  p=>p.federation.lanesPerCohort=40,p=>p.federation.namespace='secondary']){
  const {profile}=fixture();change(profile);assert.throws(()=>inspectFederation(profile));}
 assert.throws(()=>cohortView({...fixture().profile,federation:undefined},cohortRepos.secondary),/REQUIRED/);
});
test('companion joins once behind the exact source permit and both native file hashes',async()=>{
 const {profile,store,writes}=fixture(),commit='e'.repeat(40),run='102:1',coordinatorRun='101:1';let checks=0;
 const receipt=await joinCohort({profile,store,run,coordinatorRun,commit,boundary:async()=>checks++,checkPermit:async()=>checks++,
  transport:{request:async()=>({group:'secondary',rollingNamespace:'primary',database:'sg_capture_staging_v1',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash})}});
 assert.equal(checks,4);assert.deepEqual(writes,[['create',participantKey(profile)]]);assert.equal(receipt.sourceRequests,0);
 await assert.rejects(joinCohort({profile,store,run,coordinatorRun,commit,boundary:async()=>{},checkPermit:async()=>{},
  transport:{request:async()=>({group:'secondary',rollingNamespace:'primary',database:'sg_capture_staging_v1',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash})}}),/ALREADY_JOINED/);
});
test('secondary source permission binds its own run and the primary coordinator; neither receipt nor wrong owner is enough',async()=>{
 const {profile,store,docs}=fixture(),commit='e'.repeat(40),run='102:1',coordinatorRun='101:1';
 const permit={schema:'sg-ag-rolling-permit-v1',queueId:'queue',run:coordinatorRun,commit,activation:profile.activation,profileHash:queueHash(profile),startsAt:1,expiresAt:1000};
 docs.set('journal/rolling-activation:'+profile.activation+':complete',{value:permit});docs.set('state/rolling-source',{value:{status:'running',owner:coordinatorRun,queueId:'queue',commit,activation:profile.activation}});
 const args={profile,store,run,coordinatorRun,commit,repository:cohortRepos.secondary,now:()=>100};
 await assert.rejects(sourcePermit(args),/PARTICIPANT/);
 await joinCohort({profile,store,run,coordinatorRun,commit,boundary:async()=>{},checkPermit:async()=>{},
  transport:{request:async()=>({group:'secondary',rollingNamespace:'primary',database:'sg_capture_staging_v1',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash})}});
 assert.equal((await sourcePermit(args)).run,coordinatorRun);
 await assert.rejects(sourcePermit({...args,run:'103:1'}),/PARTICIPANT/);
 docs.get('state/rolling-source').value.owner='104:1';await assert.rejects(sourcePermit(args),/SOURCE_PERMISSION/);
});
test('all twenty companion source jobs must end; the primary local lane notification cannot end the companion',()=>{
 const jobs={total_count:20,jobs:Array.from({length:20},(_,i)=>({name:'AG rolling lane '+(i+1),status:'completed'}))};
 jobs.jobs[19].status='in_progress';assert.equal(endedCohortJobs(jobs),false);assert.equal(endedCohortJobs(jobs,{localLaneEnded:true}),true);
 jobs.jobs[19].status='completed';assert.equal(endedCohortJobs(jobs),true);jobs.jobs[0].name='AG rolling lane 2';assert.equal(endedCohortJobs(jobs),false);
});
