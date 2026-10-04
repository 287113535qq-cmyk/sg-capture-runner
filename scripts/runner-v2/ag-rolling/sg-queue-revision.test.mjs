import assert from 'node:assert/strict';
import test from 'node:test';
import {queueHash} from './sg-queue-profile.mjs';
import {inspectQueueRevision,appendQueueGames} from './sg-queue-revision.mjs';
import {inspectNewGame} from './sg-new-game.mjs';
import {activateQueue} from './sg-queue-control.mjs';
import {prepareTasks,taskKey} from './sg-task-store.mjs';
import {stagingPrefix,stagingLeaseKey} from './sg-staging-store.mjs';
const oldGame={gameId:'32441',dbName:'sg_32441',campaignId:'sg_32441-queue',baseline:0,mongoUri:'sg-native://primary/sg_32441'};
const newGame={gameId:'32749',dbName:'sg_32749',campaignId:'sg_32749-queue',baseline:0,mongoUri:'sg-native://primary/sg_32749'};
const plan={gameId:32749,trialId:'sg_ag_r1_20261004_32749'};
const entry=g=>({...g,phase:'ready',planHash:queueHash(['plan',g.gameId]),adapterProofHash:queueHash(['proof',g.gameId])});
const guard=async()=>{};
function profiles(){
 const previous={schema:'sg-ag-rolling-queue-v1',group:'primary',target:300000,lanes:20,sessionsPerLane:8,
  canaries:2,canaryRounds:10,stagingOveragePerLane:7,activation:'1'.repeat(64),payload:{version:1,queueId:'queue',games:[oldGame]},
  manifest:[entry(oldGame)]};
 const prior={schema:'sg-ag-rolling-permit-v1',activation:previous.activation,profileHash:queueHash(previous),run:'123:1',commit:'a'.repeat(40),queueId:'queue'};
 const ended={schema:'sg-ag-rolling-window-ended-v1',activation:previous.activation,run:prior.run,commit:prior.commit,queueId:'queue'};
 const profile={...structuredClone(previous),activation:'2'.repeat(64),codeCommit:'b'.repeat(40),linuxRun:456,
  nativeGatewayHash:'3'.repeat(64),nativeManifestHash:'4'.repeat(64),resume:{previousActivation:previous.activation,previousRun:prior.run,endedProofHash:queueHash(ended)},
  payload:{version:1,queueId:'queue',games:[oldGame,newGame]},manifest:[entry(oldGame),entry(newGame)],
  append:{schema:'sg-ag-rolling-append-v1',previousPayloadHash:queueHash(previous.payload),previousManifestHash:queueHash(previous.manifest),
   emptyEvidenceHash:queueHash(['fresh-zero-evidence']),gameBindings:[{gameId:newGame.gameId,planHash:entry(newGame).planHash,adapterProofHash:entry(newGame).adapterProofHash}]}};
 return {previous,prior,ended,profile};
}
function memory(){
 const docs=new Map(),calls=[];let count=0;
 const store={docs,async writable(){},async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},
  async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},
  async create(c,k,value){if(!docs.has(c+'/'+k))docs.set(c+'/'+k,{version:0,value:structuredClone(value)});return this.get(c,k);},
  async cas(c,k,b,value){assert.equal(docs.get(c+'/'+k)?.version,b.version);docs.set(c+'/'+k,{version:b.version+1,value:structuredClone(value)});return this.get(c,k);}};
 const transport={calls,async request(op,args){calls.push({op,args});
  if(op==='hello')return {group:'primary',database:'sg_capture_staging_v1',rollingJournalBatchEnabled:true,rollingCleanupEnabled:true,
   gatewaySha256:'3'.repeat(64),accessManifestHash:'4'.repeat(64)};
  if(op==='rounds_game_count')return {gameId:plan.gameId,count};
  if(op==='rolling_campaign_baselines')return [{_id:'primary/campaign',value:(await store.get('state','campaign'))?.value},
   {_id:'secondary/campaign',value:(await store.get('state','secondary-campaign'))?.value??{games:[]}}];
  if(op==='scan')return [...docs].filter(([key])=>key.startsWith('journal/'+args.key)).map(([,r])=>structuredClone(r)).slice(0,100);
  if(op==='rolling_task_insert'){for(const row of args.records)await store.create('state',row.key,row.value);return {inserted:args.records.length};}
  assert.fail(op);
 }};
 return {store,transport,setCount:n=>{count=n;}};
}
async function setup(){
 const m=memory(),p=profiles();
 await m.store.create('state','rolling-source',{status:'idle',owner:null,lastRun:p.prior.run,lastQueueId:'queue',endedProofHash:queueHash(p.ended)});
 await m.store.create('journal','rolling-activation:'+p.previous.activation+':complete',p.prior);
 await m.store.create('journal','rolling-ended:queue:'+p.prior.run,p.ended);
 await m.store.create('state','campaign',{games:[{game_id:32749,baseline:0,confirmed:0,status:'pending'}]});
 await prepareTasks({...m,game:oldGame,queueId:'queue',guard});
 const key=taskKey('queue',oldGame,'worker:1'),row=await m.store.get('state',key);
 await m.store.cas('state',key,row,{...row.value,status:'success',owner:'preserved',proof:{fullReadback:true},count:15000});
 const oldRecords=queueHash([...m.store.docs].filter(([k])=>k.includes('rolling-task:')));
 const args={...m,profile:p.profile,run:'789:1',commit:'c'.repeat(40),boundary:guard,checkBaselines:guard,
  checkNewGame:context=>inspectNewGame({...context,...m,plan}),readPrevious:async()=>p.previous,
  readEnded:async()=>({status:'completed',head_sha:p.prior.commit}),
  readLinux:async()=>({status:'completed',conclusion:'success',head_sha:p.profile.codeCommit,path:'.github/workflows/preflight.yml'}),
  prepareResume:async()=>{}};
 return {m,p,args,oldRecords};
}
test('append retains original AG game order and namespaces while binding each new adapter',()=>{
 const p=profiles(),r=inspectQueueRevision(p);assert.deepEqual(r,{existing:[oldGame],added:[newGame]});
 assert.equal(queueHash(p.previous.payload),p.profile.append.previousPayloadHash);
 for(const mutate of [p=>p.profile.payload.games.reverse(),p=>p.profile.payload.games[0].campaignId+='changed',
  p=>p.profile.payload.queueId+='changed',p=>p.profile.append.gameBindings[0].planHash='f'.repeat(64),
  p=>p.profile.manifest[0].unexpected=true,p=>p.profile.lanes=40,p=>p.prior.profileHash='f'.repeat(64),
  p=>delete p.profile.append,p=>delete p.profile.resume]){
  const bad=profiles();mutate(bad);assert.throws(()=>inspectQueueRevision(bad));
 }
});
test('old game with a missing canary or worker never becomes a fresh game and causes zero activation writes',async()=>{
 for(const id of ['canary:1','worker:20']){
  const {m,args}=await setup();m.store.docs.delete('state/'+taskKey('queue',oldGame,id));
  const before=queueHash([...m.store.docs]);m.transport.calls.length=0;
  await assert.rejects(()=>activateQueue(args),/TASK_INVENTORY/);
  assert.equal(queueHash([...m.store.docs]),before);
  assert.equal(m.transport.calls.filter(c=>c.op==='rolling_task_insert').length,0);
 }
});
test('fresh append provisions only new game tasks and keeps the exact old successful task snapshot',async()=>{
 const {m,p,args,oldRecords}=await setup();m.transport.calls.length=0;let resumed=0;
 const result=await activateQueue({...args,prepareResume:async context=>{
  assert.equal(context.game.gameId,oldGame.gameId);assert.deepEqual(context.previous,p.previous);resumed++;
 }});
 assert.equal(resumed,1);assert.equal(result.games,2);
 const preserved=[...m.store.docs].filter(([k,r])=>k.includes('rolling-task:')&&r.value.campaignId===oldGame.campaignId);
 assert.equal(queueHash(preserved),oldRecords);
 const seeded=m.transport.calls.filter(c=>c.op==='rolling_task_insert');assert.equal(seeded.length,1);
 assert.equal(seeded[0].args.records.length,22);assert(seeded[0].args.records.every(r=>r.value.campaignId===newGame.campaignId));
 assert.equal(m.transport.calls.filter(c=>c.op==='rounds_game_count').length,4,'fresh global counts before and after the source fence');
});
test('historical official rows and orphan staging stop append before the source fence or task reset',async()=>{
 for(const corrupt of [m=>m.setCount(100),async m=>m.store.create('journal',stagingPrefix('queue',newGame,'worker',3)+'0000000001',{retained:true}),
  async m=>m.store.create('state',stagingLeaseKey('queue',newGame,'worker',2),{expiresAt:0}),
  async m=>m.store.create('state','secondary-campaign',{games:[{game_id:32749,baseline:100,confirmed:0,status:'pending'}]}),
  async m=>m.store.create('journal','rolling-merge:'+queueHash(['queue',newGame.gameId,newGame.campaignId])+':complete',{retained:true})]){
  const {m,args}=await setup();await corrupt(m);const before=queueHash([...m.store.docs]);m.transport.calls.length=0;
  await assert.rejects(()=>activateQueue(args),/SG_NEW_GAME_/);assert.equal(queueHash([...m.store.docs]),before);
  assert.equal(m.transport.calls.filter(c=>c.op==='rolling_task_insert').length,0);
 }
});
test('unknown native count is never retried or interpreted as empty',async()=>{
 const {m,args}=await setup(),request=m.transport.request.bind(m.transport);let reads=0;
 m.transport.request=async(op,a)=>{if(op==='rounds_game_count'){reads++;throw Object.assign(new Error('NATIVE_READ_UNKNOWN'),{outcomeUnknown:true});}return request(op,a);};
 const before=queueHash([...m.store.docs]);await assert.rejects(()=>activateQueue(args),/NATIVE_READ_UNKNOWN/);
 assert.equal(reads,1);assert.equal(queueHash([...m.store.docs]),before);
});
test('a count or campaign change during indexed staging audit cannot grant new source permission',async()=>{
 const {m,args}=await setup(),request=m.transport.request.bind(m.transport);
 m.transport.request=async(op,a)=>{const result=await request(op,a);if(op==='scan')m.setCount(1);return result;};
 const before=queueHash([...m.store.docs]);await assert.rejects(()=>activateQueue(args),/HISTORICAL_RECORDS/);
 assert.equal(queueHash([...m.store.docs]),before);
});
function appendFixture(){
 const p=profiles(),plans={plans:{32749:plan},proofs:{32749:{planHash:queueHash(plan),acceptedBaseRounds:995,
  formalAdmission:'requires-two-AG-live-canaries'}},alreadyComplete:[]};
 const evidence={schema:'sg-ag-rolling-new-game-empty-v1',at:Math.floor(Date.now()/1000),queueId:'queue',
  profileHash:queueHash(p.previous),previousActivation:p.previous.activation,previousRun:p.prior.run,
  endedProofHash:queueHash(p.ended),planRegistryHash:queueHash(plans),holds:[false,false],
  source:{status:'idle',owner:null,lastRun:p.prior.run,lastQueueId:'queue',endedProofHash:queueHash(p.ended)},
  games:[{gameId:'32749',trialId:plan.trialId,officialCount:0,history:[{group:'primary',game_id:32749,baseline:0,confirmed:0,status:'pending'}]}]};
 return {previous:p.previous,manifest:p.previous.manifest,plans,evidence,resume:p.profile.resume};
}
test('registration append uses fresh fixed native evidence and never assigns zero baseline to historical records',()=>{
 const f=appendFixture(),before=queueHash(f),r=appendQueueGames(f);
 assert.equal(queueHash(f),before);assert.equal(queueHash(r.payload.games[0]),queueHash(oldGame));
 assert.equal(r.payload.queueId,'queue');assert.equal(r.payload.games[1].campaignId,'sg_32749-queue');
 const p=profiles();p.profile.payload=r.payload;p.profile.manifest=r.manifest;p.profile.append=r.append;
 assert.equal(inspectQueueRevision(p).added.length,1);
 f.evidence.games[0].officialCount=100;
 const preserved=appendQueueGames(f);assert.equal(queueHash(preserved.payload),queueHash(f.previous.payload));
 assert.equal(preserved.append,undefined);assert.deepEqual(preserved.excluded,[{gameId:'32749',reason:'historical-baseline-or-native-prefix'}]);
});
test('registration refuses active or stale snapshots, another predecessor, duplicate candidates and unproved adapters',()=>{
 for(const change of [f=>f.evidence.at-=301,f=>f.evidence.source.status='running',f=>f.evidence.previousRun='other:1',
  f=>f.evidence.planRegistryHash='f'.repeat(64),f=>f.evidence.games.push(f.evidence.games[0]),
  f=>f.evidence.games[0].history=[],f=>f.evidence.games[0].gameId='32441',
  f=>{f.plans.proofs[32749].acceptedBaseRounds=0;f.evidence.planRegistryHash=queueHash(f.plans);}]){
  const f=appendFixture();change(f);assert.throws(()=>appendQueueGames(f));
 }
});
