import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createLiveAgController} from './sg-ag-live-controller.mjs';
import {cohortRepos,participantKey} from './sg-federation.mjs';
import {taskKey} from './sg-task-store.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {inspectExistingWorkflowPolicy,inspectExistingGameBinding} from './sg-ag-existing-workflow.mjs';
import {deliverOrdinaryBusiness} from './sg-ag-ordinary-business.mjs';
import {prepareExistingAgResume} from './sg-ag-existing-resume.mjs';
import {protectMongoOnce} from './sg-ag-once-mongo.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

function fixture(ids=['32441','32442']){
 const queueId='own-queue',commit='a'.repeat(40),runs={primary:'123:1',secondary:'456:1'},games=ids.map(id=>({gameId:id,dbName:'sg_'+id,campaignId:'sg_'+id+'-'+queueId,baseline:0}));
 const profile={activation:'b'.repeat(64),nativeGatewayHash:'c'.repeat(64),nativeManifestHash:'d'.repeat(64),payload:{queueId,games},manifest:[],federation:{schema:'sg-ag-two-cohort-v1',namespace:'primary',lanesPerCohort:20,totalLanes:40,assignments:games.map((g,i)=>({gameId:g.gameId,cohort:i?'secondary':'primary'}))}};
 const docs=new Map(),changes=[],contexts=[],jobs={primary:[],secondary:[]};
 for(const [cohort,game] of [['primary',games[0]],['secondary',games[1]]]){
  jobs[cohort]=Array.from({length:20},(_,i)=>({id:(cohort==='primary'?1000:2000)+i,name:'AG rolling lane '+(i+1),status:'in_progress',conclusion:null,run_id:Number(runs[cohort].split(':')[0])}));
  for(const [kind,max] of [['canary',2],['worker',20]])for(let index=1;index<=max;index++){
   const value={_id:kind+':'+index,queueId,campaignId:game.campaignId,status:'pending'};
   docs.set('state/'+taskKey(queueId,game,value._id),{version:0,value});
  }
 }
 const participant={schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,activation:profile.activation,profileHash:queueHash(profile),queueId,coordinatorRun:runs.primary,commit,run:runs.secondary,assignmentHash:queueHash(profile.federation),sourceRequests:0};
 // Use the same participant fields as the actual federation validator.
 participant.federationHash=queueHash(profile.federation);
 docs.set('journal/'+participantKey(profile),{value:participant});
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},async create(c,k,v){if(!docs.has(c+'/'+k))docs.set(c+'/'+k,{version:0,value:structuredClone(v)});return this.get(c,k);},async cas(c,k,b,v){assert.equal(docs.get(c+'/'+k).version,b.version);docs.set(c+'/'+k,{version:b.version+1,value:structuredClone(v)});changes.push(v);return true;},async writable(){}};
 let closed=null;
 const api=createLiveAgController({profile,store,coordinatorRun:runs.primary,commit,sourceClose:()=>closed,makeContext:async({repository,cohortRun,state})=>{
  contexts.push({repository,cohortRun,state});return {transport:{async request(op){if(op==='global_holds')return [{value:{active:false}},{value:{active:false}}];if(op==='hello')return {group:'primary',database:'sg_capture_staging_v1',rollingNamespace:'primary',gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash};assert.fail(op);}},
   parser:{},businessClient:{},ObjectId:class{},bindings:{},plans:{},currentRtp:async()=>{},privateControlPersist:()=>({fullReadback:true}),
   githubRead:async p=>{const cohort=p.includes(cohortRepos.primary)?'primary':'secondary',id=Number(runs[cohort].split(':')[0]);return p.includes('/jobs?')?{total_count:20,jobs:structuredClone(jobs[cohort])}:{id,run_attempt:1,head_sha:commit,repository:{full_name:cohortRepos[cohort]},event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',status:'in_progress'};},
   admission:{guard:async()=>{},assertCapturedEnding:async()=>{},assertResumeBoundary:async()=>{throw Error('no actual ending');},dispatchRemaining:async()=>{throw Error('no dispatch');},finishCohort:async()=>{},originalCount:async()=>0,originalDocuments:async()=>[]}}
 }});
 const task=(cohort,index)=>docs.get('state/'+taskKey(queueId,games[cohort==='primary'?0:1],'worker:'+index)).value;
 return {api,contexts,jobs,task,changes,profile,store,docs,games,setClosed:v=>{closed=v;},runs,commit};
}
test('existing primary controller invokes AG separately for each true cohort and settles only own ended lanes',async()=>{
 const f=fixture();for(const cohort of ['primary','secondary']){const t=f.task(cohort,1);Object.assign(t,{status:'running',owner:f.runs[cohort].replace(':1','-1')+':1:worker:1'});f.jobs[cohort][0].status='completed';f.jobs[cohort][0].conclusion='failure';}
 await f.api.reconcile();assert.equal(f.contexts.length,2);assert.deepEqual(f.contexts.map(c=>[c.cohortRun,c.state.games.map(g=>g.gameId)]),[['123:1',['32441']],['456:1',['32442']]]);
 assert.equal(f.task('primary',1).status,'failed');assert.equal(f.task('secondary',1).status,'failed');assert.equal(f.task('primary',2).status,'pending');
});

function resumeFixture(ids){
 const f=fixture(ids),receipt={schema:'sg-ag-rolling-window-ended-v1',run:f.runs.primary,sourceRequests:0};
 const ended={status:'completed',sourceJobsEnded:true,queueId:f.profile.payload.queueId,run:f.runs.primary,proofHash:queueHash(receipt)};
 const profile={...f.profile,activation:'e'.repeat(64),fullAgControl:{},resume:{previousActivation:f.profile.activation,previousRun:f.runs.primary,endedProofHash:ended.proofHash}};
 f.docs.set('journal/rolling-ended:'+ended.queueId+':'+ended.run,{value:receipt});
 const prepared=[];
 return {...f,ended,profile,previous:f.profile,prepared,args:{profile,previous:f.profile,prior:{run:f.runs.primary,commit:f.commit},ended,store:f.store,guard:async()=>{},prepareGame:async({game})=>prepared.push(game.gameId)}};
}
function savedResumeState(f,changes,cohort='secondary'){
 const oldRun=f.runs[cohort],index=cohort==='primary'?0:1,key='rolling-ag-control:'+queueHash([f.ended.queueId,oldRun,f.commit]);
 const state={version:1,queueId:f.ended.queueId,runId:Number(oldRun.split(':')[0]),phase:'paused',games:[{...f.games[index],phase:'blocked',...changes}]};
 const saved={cohortRun:oldRun,commit:f.commit,state,sequence:3,journal:key+':3'};
 f.docs.set('state/'+key,{version:2,value:structuredClone(saved)});
 f.docs.set('journal/'+saved.journal,{version:0,value:{file:'own-control-state',value:structuredClone(state),cohortRun:oldRun,commit:f.commit}});
 return {key,state: f.docs.get('state/'+key),journal:f.docs.get('journal/'+saved.journal)};
}
test('existing admit uses the original AG resume for both own cohorts and hands off to the existing permit without source requests',async()=>{
 const f=resumeFixture(),result=await prepareExistingAgResume(f.args);
 assert.deepEqual(f.prepared,['32441','32442']);assert.deepEqual(result.map(r=>[r.previousRun,r.remaining]),[['123:1',['32441']],['456:1',['32442']]]);
 assert(result.every(r=>r.sourceRequests===0));
 await assert.rejects(prepareExistingAgResume(f.args),/EXISTING_HANDOFF_NO_REPLAY/);
});
test('saved blocked or unknown games are retained across the actual admission resume',async()=>{
 for(const unknown of [false,true]){const f=resumeFixture();savedResumeState(f,{phase:unknown?'merging':'blocked',...(unknown?{sgOutcomeUnknownRetained:true}:{})});
  const result=await prepareExistingAgResume(f.args);assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
});

const insufficient='有效 289001 条，低于 300000；保留数据等待续跑或协议诊断';
const initialBudget={schema:'sg-ag-game-budget-v1',startedAt:1000,deadlineAt:1801000};
const exhaustedBudget={...initialBudget,exhaustedAt:1801000,stoppedPhase:'accepted-prefix-page',stoppedGamePhase:'ready'};

test('the exact original AG insufficient quota state resumes through the original full prepareGame and dispatches remaining work',async()=>{
 for(const budget of [undefined,initialBudget]){
  const f=resumeFixture(),saved=savedResumeState(f,{reason:insufficient,...(budget?{sgGameBudget:budget}:{})});
  const before=structuredClone(saved.state);f.args.canResumeQuotaGame=game=>game.gameId==='32442';
  const result=await prepareExistingAgResume(f.args);
  assert.deepEqual(f.prepared,['32441','32442']);assert.deepEqual(result[1].remaining,['32442']);
  assert.deepEqual(saved.state,before,'the previous immutable evidence is retained; only the new AG resume view is ready');
 }
});

test('only an exact expired read-only game budget can resume in a new verified window',async()=>{
 const f=resumeFixture();savedResumeState(f,{reason:'SG_AG_GAME_BUDGET_EXHAUSTED',sgGameBudget:exhaustedBudget});
 f.args.canResumeQuotaGame=()=>true;const result=await prepareExistingAgResume(f.args);
 assert.deepEqual(f.prepared,['32441','32442']);assert.deepEqual(result[1].remaining,['32442']);
});

test('unknown operations, malformed quota reasons and noninitial budgets never unlock blocked games',async()=>{
 const changes=[{reason:'SG_AG_CONTROL_EXISTING_OPERATION_NO_REPLAY'},
  {reason:'有效 300000 条，低于 300000；保留数据等待续跑或协议诊断'},
  {reason:'有效 0289001 条，低于 300000；保留数据等待续跑或协议诊断'},
  {reason:insufficient+' '},{acceptedTotal:300000},{acceptedTotal:0},
  {sgOutcomeUnknownRetained:true},{sgOutcomeUnknownRetained:false},{sgExistingOperationRetained:true},{sgExistingOperationRetained:false},
  {phase:'merging'},{phase:'merged'},{sgGameBudget:{...initialBudget,unknown:true}},
  {sgGameBudget:{...initialBudget,deadlineAt:1801001}},{sgGameBudget:exhaustedBudget}];
 for(const change of changes){
  const f=resumeFixture();savedResumeState(f,{reason:insufficient,...change});f.args.canResumeQuotaGame=()=>true;
  const result=await prepareExistingAgResume(f.args);assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
});

test('write-phase budget stops, missing clock proof and unknown outcome remain isolated',async()=>{
 for(const change of [{stoppedGamePhase:'merging'},{stoppedGamePhase:'merged'},{exhaustedAt:1800999},
  {deadlineAt:1801001},{startedAt:-1},{schema:'other'},{extra:true},{stoppedPhase:''},{stoppedGamePhase:undefined}]){
  const f=resumeFixture();savedResumeState(f,{reason:'SG_AG_GAME_BUDGET_EXHAUSTED',sgGameBudget:{...exhaustedBudget,...change}});
  f.args.canResumeQuotaGame=()=>true;const result=await prepareExistingAgResume(f.args);
  assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
 for(const retained of [{sgOutcomeUnknownRetained:true},{sgExistingOperationRetained:true},{acceptedTotal:300000}]){
  const f=resumeFixture();savedResumeState(f,{reason:'SG_AG_GAME_BUDGET_EXHAUSTED',sgGameBudget:exhaustedBudget,...retained});
  f.args.canResumeQuotaGame=()=>true;const result=await prepareExistingAgResume(f.args);
  assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
});

test('quota restoration requires an explicit supported adapter and always excludes the retained money anomaly',async()=>{
 for(const mode of ['absent','unsupported','money-anomaly']){
  const f=resumeFixture(mode==='money-anomaly'?['32441','32629']:undefined);savedResumeState(f,{reason:insufficient});
  if(mode!=='absent')f.args.canResumeQuotaGame=()=>mode==='money-anomaly';
  const result=await prepareExistingAgResume(f.args);assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
});

test('both complete saved journal chains are checked before any task preparation or handoff',async()=>{
 const corruptions=[({state})=>{state.value.sequence=0;},({state})=>{state.value.sequence=4;},
  ({state})=>{state.value.journal='foreign:3';},({journal})=>{journal.value.file='own-exception-state';},
  ({journal})=>{journal.value.cohortRun='999:1';},({journal})=>{journal.value.extra=true;},
  ({state})=>{state.value.state.games[0].reason='tampered';},
  ({state,journal})=>{state.value.state.games[0].dbName='foreign';journal.value.value=structuredClone(state.value.state);}];
 for(const corrupt of corruptions){
  const f=resumeFixture(),saved=savedResumeState(f,{reason:insufficient});corrupt(saved);f.args.canResumeQuotaGame=()=>true;
  await assert.rejects(prepareExistingAgResume(f.args),/SG_AG_RESUME_(?:OWN_SAVED_STATE|SAVED_POINTER|SAVED_FULL_JOURNAL)/);
  assert.deepEqual(f.prepared,[]);assert(![...f.docs.keys()].some(k=>k.startsWith('journal/rolling-ag-resume:')));
 }
 const f=resumeFixture(),saved=savedResumeState(f,{reason:insufficient});f.docs.delete('journal/'+saved.state.value.journal);
 await assert.rejects(prepareExistingAgResume(f.args),/SG_AG_RESUME_SAVED_FULL_JOURNAL/);assert.deepEqual(f.prepared,[]);
});

test('a restored quota still cannot hand off when original prefix or baseline validation rejects it',async()=>{
 const f=resumeFixture();savedResumeState(f,{reason:insufficient},'primary');f.args.canResumeQuotaGame=()=>true;
 f.args.prepareGame=async()=>{throw Error('synthetic-existing-prefix-or-baseline-rejected');};
 await assert.rejects(prepareExistingAgResume(f.args),/existing-prefix-or-baseline-rejected/);
 assert(![...f.docs.keys()].some(k=>k.startsWith('journal/rolling-ag-resume:')));
});
test('a live lease or a changed immutable ending prevents resume before task recovery and source handoff',async()=>{
 for(const live of [false,true]){const f=resumeFixture();
  if(live)f.docs.set('state/'+stagingLeaseKey(f.ended.queueId,f.games[0],'worker',1),{value:{expiresAt:Date.now()+60000}});
  else f.docs.get('journal/rolling-ended:'+f.ended.queueId+':'+f.ended.run).value.changed=true;
  await assert.rejects(prepareExistingAgResume(f.args));assert.equal(f.prepared.length,0);assert(![...f.docs.keys()].some(k=>k.startsWith('journal/rolling-ag-resume:')));
 }
});
test('one unknown Mongo cursor or insert ACK poisons the admitted client and prevents every later driver call',async()=>{
 for(const operation of ['read','write']){let calls=0,closed=0;const error=Error('unknown-driver-ACK');
  const cursor={limit(){return this;},async toArray(){calls++;throw error;}};
  const collection={find(){return cursor;},async insertMany(){calls++;throw error;}};
  const once=protectMongoOnce({db:()=>({collection:()=>collection}),async close(){closed++;}}),pool=once.client.db('own').collection('simulate');
  await assert.rejects(operation==='read'?pool.find({}).limit(100).toArray():pool.insertMany([]),e=>e===error&&e.outcomeUnknown===true);
  assert.throws(()=>pool.find({}),/UNKNOWN_NO_REPLAY/);assert.throws(()=>pool.insertMany([]),/UNKNOWN_NO_REPLAY/);assert.equal(calls,1);
  await once.client.close();assert.equal(closed,1);
 }
});
test('shared lane twenty stays running without real source close and a primary close cannot end secondary twenty',async()=>{
 const f=fixture();for(const cohort of ['primary','secondary'])Object.assign(f.task(cohort,20),{status:'running',owner:f.runs[cohort].replace(':1','-1')+':20:worker:20'});
 await f.api.reconcile();assert.equal(f.task('primary',20).status,'running');assert.equal(f.task('secondary',20).status,'running');
 f.setClosed({run:f.runs.primary,lane:20,sourceClosed:true,pid:100,code:0,signal:null});await f.api.reconcile();
 assert.equal(f.task('primary',20).status,'failed');assert.equal(f.task('secondary',20).status,'running');
});
test('foreign close identity cannot settle a live shared controller source',async()=>{const f=fixture();f.setClosed({run:'999:1',lane:20,sourceClosed:true,code:0,signal:null});await assert.rejects(f.api.reconcile(),/SOURCE_CLOSE_IDENTITY/);assert.equal(f.changes.length,0);});
test('the live primary controller waits for its actual companion receipt without inventing a cohort or failing healthy source startup',async()=>{const f=fixture();f.docs.delete('journal/'+participantKey(f.profile));const results=await f.api.reconcile();assert(results.every(r=>r.status==='ready'));assert.equal(f.contexts.length,0);assert.equal(f.changes.length,0);});
test('existing workflow mode requires its own complete Linux evidence binding and preserves completed receipt identities',()=>{
 const policy={schema:'sg-ag-existing-workflow-control-v1',evidenceMode:'existing-immutable-audit',linuxEvidenceFile:'config/ag-full-control-linux-'+ 'a'.repeat(64)+'.json',linuxEvidenceSha256:'b'.repeat(64),completedBusinessReceipts:{}};
 assert.equal(inspectExistingWorkflowPolicy({fullAgControl:policy}),policy);
 assert.throws(()=>inspectExistingWorkflowPolicy({fullAgControl:{...policy,linuxEvidenceSha256:null}}));
 assert.throws(()=>inspectExistingWorkflowPolicy({fullAgControl:{...policy,completedBusinessReceipts:{'32441':{nativeReceiptHash:'a'.repeat(64),auditDocumentHash:'b'.repeat(64),auditCompleteKey:'game:32529:'+ 'a'.repeat(64)+':complete'}}}}));
});
test('existing ordinary audit path preserves actual original counts 20, 99, 100 and 150 without requiring a new private parent',async()=>{
 for(const count of [20,99,100,150]){let reached=false;await assert.rejects(deliverOrdinaryBusiness({plan:{adapter:'native-nextgen-v1',gameId:'32441'},binding:{gameId:32441,queueId:'queue'},expectedProof:{queueId:'queue'},expectedOriginalCount:count,owner:'123:1:business',evidenceMode:'existing-immutable-audit',guard:async()=>{reached=true;throw Error('own original admission stops before IO');}}),/own original admission/);assert(reached);}
});

test('all actual 81 game bindings retain the native alias and their own runtime business database',()=>{
 const read=name=>JSON.parse(fs.readFileSync(new URL('../../../config/'+name,import.meta.url),'utf8'));
 const profile=read('ag-rolling-queue-554533d7f75bedde74e5d9544dfb93188dfb7ad6ece00ae72da0fc051eb4dd31.json');
 const bindings=read('ag-business-bindings.json').bindings,plans=read('ag-rolling-plans.json').plans;
 assert.equal(profile.payload.games.length,81);
 for(const game of profile.payload.games){const binding=bindings[game.gameId],plan=plans[game.gameId];
  assert.equal(inspectExistingGameBinding({binding,game,profile,plan}),binding);
  assert.notEqual(binding.database,game.dbName);
  for(const changed of [{...binding,database:game.dbName},{...binding,gameId:99999},{...binding,trialId:'foreign'},{...binding,runtimeGameId:-1}])
   assert.throws(()=>inspectExistingGameBinding({binding:changed,game,profile,plan}),/OWN_BINDING/);
 }
});
