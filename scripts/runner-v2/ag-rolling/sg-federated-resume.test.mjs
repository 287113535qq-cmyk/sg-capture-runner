import assert from 'node:assert/strict';
import test from 'node:test';
import {queueHash} from './sg-queue-profile.mjs';
import {activateQueue} from './sg-queue-control.mjs';
import {appendQueueGames,inspectQueueRevision} from './sg-queue-revision.mjs';
import {prepareTasks,taskKey} from './sg-task-store.mjs';
import {cohortRepos,participantKey,resumeFederation,inspectFederationRevision,verifyEndedFederation} from './sg-federation.mjs';

const game=id=>({gameId:id,dbName:'sg_'+id,campaignId:'sg_'+id+'-queue',baseline:0,mongoUri:'sg-native://primary/sg_'+id});
function fixture(){
 const games=['32441','32442','32443'].map(game);
 const previous={schema:'sg-ag-rolling-queue-v1',group:'primary',target:300000,lanes:20,sessionsPerLane:8,
  canaries:2,canaryRounds:10,stagingOveragePerLane:7,activation:'1'.repeat(64),payload:{version:1,queueId:'queue',games},
  manifest:games.map(g=>({...g,phase:'ready',planHash:queueHash(['plan',g.gameId]),adapterProofHash:queueHash(['proof',g.gameId])})),
  federation:{schema:'sg-ag-two-cohort-v1',lanesPerCohort:20,totalLanes:40,namespace:'primary',
   assignments:games.map((g,i)=>({gameId:g.gameId,cohort:i%2?'secondary':'primary'}))}};
 const commit='a'.repeat(40),prior={schema:'sg-ag-rolling-permit-v1',activation:previous.activation,
  profileHash:queueHash(previous),run:'101:1',commit,queueId:'queue'};
 const participant={schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,run:'102:1',coordinatorRun:prior.run,
  commit,activation:previous.activation,profileHash:queueHash(previous),queueId:'queue',assignmentHash:queueHash(previous.federation),sourceRequests:0};
 const receipt={schema:'sg-ag-rolling-window-ended-v1',activation:previous.activation,profileHash:queueHash(previous),run:prior.run,commit,
  queueId:'queue',federationHash:queueHash(previous.federation),participant,sourceRequests:0};
 const profile={...structuredClone(previous),activation:'2'.repeat(64),codeCommit:'b'.repeat(40),linuxRun:456,
  nativeGatewayHash:'3'.repeat(64),nativeManifestHash:'4'.repeat(64),
  resume:{previousActivation:previous.activation,previousRun:prior.run,endedProofHash:queueHash(receipt)}};
 const workflows=new Map(),jobs=new Map();
 for(const [cohort,id] of [['primary',101],['secondary',102]]){
  workflows.set(cohort,{id,run_attempt:1,status:'completed',head_branch:'main',head_sha:commit,event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml'});
  const controls=cohort==='primary'?['ag-rolling-admit','ag-rolling-finalize']:['ag-rolling-join'];
  const rows=[...Array.from({length:20},(_,i)=>({name:'AG rolling lane '+(i+1),status:'completed',conclusion:i===0?'failure':'success'})),
   ...controls.map(name=>({name,status:'completed',conclusion:'success'})),
   ...Array.from({length:59-20-controls.length},(_,i)=>({name:i===0?'AG rolling lane ${{ matrix.lane }}':'skipped '+i,status:'completed',conclusion:'skipped'}))];
  jobs.set(cohort,{total_count:rows.length,jobs:rows});
 }
 const docs=new Map(),writes=[],reads=[];
 const store={async writable(){},async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},
  async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},
  async create(c,k,value){writes.push(['create',c,k]);if(!docs.has(c+'/'+k))docs.set(c+'/'+k,{version:0,value:structuredClone(value)});return this.get(c,k);},
  async cas(c,k,b,value){writes.push(['cas',c,k]);assert.equal(docs.get(c+'/'+k)?.version,b.version);docs.set(c+'/'+k,{version:b.version+1,value:structuredClone(value)});return this.get(c,k);}};
 const cohortFor=(id,repository)=>{const cohort=Object.keys(cohortRepos).find(k=>cohortRepos[k]===repository);
  assert(cohort&&String(workflows.get(cohort).id)===id,'READER_REPOSITORY_BINDING');return cohort;};
 const readEnded=async(id,repository)=>{reads.push(['run',id,repository]);return structuredClone(workflows.get(cohortFor(id,repository)));};
 const readEndedJobs=async(id,repository)=>{reads.push(['jobs',id,repository]);return structuredClone(jobs.get(cohortFor(id,repository)));};
 return {previous,prior,participant,receipt,profile,workflows,jobs,docs,writes,reads,store,readEnded,readEndedJobs};
}
async function ready(){
 const f=fixture();
 await f.store.create('state','rolling-source',{status:'idle',owner:null,lastRun:f.prior.run,lastQueueId:'queue',endedProofHash:queueHash(f.receipt)});
 await f.store.create('journal','rolling-activation:'+f.previous.activation+':complete',f.prior);
 await f.store.create('journal','rolling-ended:queue:'+f.prior.run,f.receipt);
 await f.store.create('journal',participantKey(f.previous),f.participant);
 for(const game of f.previous.payload.games)await prepareTasks({store:f.store,game,queueId:'queue',guard:async()=>{}});
 const key=taskKey('queue',f.previous.payload.games[0],'worker:1'),row=await f.store.get('state',key);
 await f.store.cas('state',key,row,{...row.value,status:'success',count:15000,owner:'old-owner',proof:{fullReadback:true}});
 await f.store.create('journal','rolling-source:retained-half',{retain:true,credited:false});
 f.writes.length=0;
 const args={profile:f.profile,store:f.store,run:'789:1',commit:'c'.repeat(40),boundary:async()=>{},checkBaselines:async()=>{},
  readPrevious:async()=>f.previous,readEnded:(id,repository=cohortRepos.primary)=>f.readEnded(id,repository),readEndedJobs:f.readEndedJobs,
  readLinux:async()=>({status:'completed',conclusion:'success',head_sha:f.profile.codeCommit,path:'.github/workflows/preflight.yml'}),prepareResume:async()=>{},
  transport:{request:async op=>{assert.equal(op,'hello');return {group:'primary',database:'sg_capture_staging_v1',rollingJournalBatchEnabled:true,
   rollingCleanupEnabled:true,rollingNamespace:'primary',gatewaySha256:f.profile.nativeGatewayHash,accessManifestHash:f.profile.nativeManifestHash};}}};
 return {...f,args};
}

test('federated resume independently checks both ended GH inventories and preserves existing successful tasks and half rounds',async()=>{
 const f=await ready(),retained=[...f.docs].filter(([k])=>k.includes('rolling-task:')||k.includes('retained-half'));
 await activateQueue(f.args);
 assert.equal(queueHash([...f.docs].filter(([k])=>k.includes('rolling-task:')||k.includes('retained-half'))),queueHash(retained));
 assert(f.reads.some(r=>r[0]==='jobs'&&r[1]==='101'&&r[2]===cohortRepos.primary));
 assert(f.reads.some(r=>r[0]==='jobs'&&r[1]==='102'&&r[2]===cohortRepos.secondary));
 assert.equal((await f.store.get('state','rolling-source')).value.status,'running');
});
test('a completed primary cannot reset tasks while the companion or any companion job remains active',async()=>{
 for(const change of [f=>f.workflows.get('secondary').status='in_progress',f=>f.jobs.get('secondary').jobs[19].status='in_progress',
  f=>f.jobs.get('secondary').jobs.push({name:'late skipped job',status:'queued',conclusion:null})]){
  const f=await ready();change(f);if(f.jobs.get('secondary').jobs.length===60)f.jobs.get('secondary').total_count=60;
  const before=queueHash([...f.docs]);await assert.rejects(()=>activateQueue(f.args),/COHORT.*ACTIVE/);
  assert.equal(queueHash([...f.docs]),before);assert.deepEqual(f.writes,[]);
 }
});
test('altered participant, old commit, missing or duplicate lane and failed cohort control all stop before activation writes',async()=>{
 for(const change of [f=>f.docs.get('journal/'+participantKey(f.previous)).value.run='103:1',
  f=>f.docs.get('journal/rolling-ended:queue:101:1').value.participant.assignmentHash='f'.repeat(64),
  f=>f.workflows.get('secondary').head_sha='d'.repeat(40),f=>f.workflows.get('secondary').run_attempt=2,
  f=>f.jobs.get('secondary').jobs[19].name='AG rolling lane 19',f=>f.jobs.get('secondary').total_count++,
  f=>f.jobs.get('secondary').jobs.find(j=>j.name==='ag-rolling-join').conclusion='failure',
  f=>f.jobs.get('primary').jobs.find(j=>j.name==='ag-rolling-finalize').conclusion='failure',
  f=>{const rows=f.jobs.get('secondary');rows.jobs.push({name:'unexpected source',status:'completed',conclusion:'success'});rows.total_count++;}]){
  const f=await ready();change(f);const before=queueHash([...f.docs]);
  await assert.rejects(()=>activateQueue(f.args));assert.equal(queueHash([...f.docs]),before);assert.deepEqual(f.writes,[]);
 }
});
test('unknown companion read is issued once with no task reset, new permit or retry',async()=>{
 const f=await ready(),before=queueHash([...f.docs]);let issued=0;
  f.args.readEndedJobs=async(id,repository)=>{if(repository===cohortRepos.secondary){issued++;throw Object.assign(new Error('GITHUB_READ_UNKNOWN'),{outcomeUnknown:true});}
  return f.readEndedJobs(id,repository);};
 await assert.rejects(()=>activateQueue(f.args),/GITHUB_READ_UNKNOWN/);assert.equal(issued,1);
 assert.equal(queueHash([...f.docs]),before);assert.deepEqual(f.writes,[]);
});
test('resume cannot downgrade forty lanes or move an existing game to the other cohort',async()=>{
 for(const change of [f=>delete f.profile.federation,f=>f.profile.federation.assignments[0].cohort='secondary']){
  const f=await ready();change(f);const before=queueHash([...f.docs]);await assert.rejects(()=>activateQueue(f.args),/PREVIOUS_COHORTS_CHANGED/);
  assert.equal(queueHash([...f.docs]),before);assert.deepEqual(f.writes,[]);
 }
});
test('appended games balance the cohort tail without mutating any previous assignment or namespace',()=>{
 const f=fixture(),before=queueHash(f.previous),payload={...structuredClone(f.previous.payload),games:[...structuredClone(f.previous.payload.games),game('32588'),game('32666')]};
 const federation=resumeFederation({previous:f.previous,payload});
 assert.deepEqual(federation.assignments.slice(0,3),f.previous.federation.assignments);
 assert.deepEqual(federation.assignments.slice(3),[{gameId:'32588',cohort:'secondary'},{gameId:'32666',cohort:'primary'}]);
 assert.equal(queueHash(f.previous),before);inspectFederationRevision({previous:f.previous,profile:{payload,federation}});
 const changed=structuredClone(federation);changed.assignments[3].cohort='primary';
 assert.throws(()=>inspectFederationRevision({previous:f.previous,profile:{payload,federation:changed}}),/PREVIOUS_COHORTS_CHANGED/);
 payload.games[0].campaignId+='changed';assert.throws(()=>resumeFederation({previous:f.previous,payload}),/PAYLOAD_CHANGED/);
});
test('nonfederated historical windows retain their existing single-cohort resume path',async()=>{
 const f=fixture();delete f.previous.federation;
 assert.equal(await verifyEndedFederation({...f,readEnded:()=>assert.fail('unneeded GH read')}),null);
 assert.equal(resumeFederation({previous:f.previous,payload:f.previous.payload}),undefined);
});
test('reviewed empty-game append registration forwards federation only for new games and excludes historical baselines',()=>{
 const f=fixture(),ids=['32588','32666'],plans={plans:{},proofs:{},alreadyComplete:[]};
 for(const id of ids){const plan={gameId:Number(id),trialId:'fixed-'+id};plans.plans[id]=plan;
  plans.proofs[id]={planHash:queueHash(plan),acceptedBaseRounds:100,formalAdmission:'requires-two-AG-live-canaries'};}
 const evidence={schema:'sg-ag-rolling-new-game-empty-v1',at:Math.floor(Date.now()/1000),queueId:'queue',
  profileHash:queueHash(f.previous),previousActivation:f.previous.activation,previousRun:f.prior.run,endedProofHash:queueHash(f.receipt),
  planRegistryHash:queueHash(plans),holds:[false,false],source:{status:'idle',owner:null,lastRun:f.prior.run,lastQueueId:'queue',endedProofHash:queueHash(f.receipt)},
  games:ids.map(id=>({gameId:id,trialId:plans.plans[id].trialId,officialCount:0,history:[{group:'primary',game_id:Number(id),baseline:0,confirmed:0,status:'pending'}]}))};
 const args={previous:f.previous,manifest:f.previous.manifest,plans,evidence,resume:f.profile.resume},before=queueHash(args);
 const extension=appendQueueGames(args),next={...f.profile,...extension};
 assert.equal(queueHash(args),before);assert.equal(inspectQueueRevision({profile:next,previous:f.previous,prior:f.prior}).added.length,2);
 assert.deepEqual(extension.federation.assignments.slice(0,3),f.previous.federation.assignments);
 assert.deepEqual(extension.federation.assignments.slice(3),[{gameId:'32588',cohort:'secondary'},{gameId:'32666',cohort:'primary'}]);
 evidence.games[1].officialCount=150;evidence.games[1].history[0].baseline=150;
 const filtered=appendQueueGames(args);assert.equal(filtered.payload.games.length,4);
 assert.deepEqual(filtered.federation.assignments.at(-1),{gameId:'32588',cohort:'secondary'});
 assert.deepEqual(filtered.excluded,[{gameId:'32666',reason:'historical-baseline-or-native-prefix'}]);
});
