import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveAgController} from './sg-ag-live-controller.mjs';
import {cohortRepos,participantKey} from './sg-federation.mjs';
import {taskKey} from './sg-task-store.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {inspectExistingWorkflowPolicy} from './sg-ag-existing-workflow.mjs';
import {deliverOrdinaryBusiness} from './sg-ag-ordinary-business.mjs';
import {prepareExistingAgResume} from './sg-ag-existing-resume.mjs';
import {protectMongoOnce} from './sg-ag-once-mongo.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

function fixture(){
 const queueId='own-queue',commit='a'.repeat(40),runs={primary:'123:1',secondary:'456:1'},games=['32441','32442'].map(id=>({gameId:id,dbName:'sg_'+id,campaignId:'sg_'+id+'-'+queueId,baseline:0}));
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

function resumeFixture(){
 const f=fixture(),receipt={schema:'sg-ag-rolling-window-ended-v1',run:f.runs.primary,sourceRequests:0};
 const ended={status:'completed',sourceJobsEnded:true,queueId:f.profile.payload.queueId,run:f.runs.primary,proofHash:queueHash(receipt)};
 const profile={...f.profile,activation:'e'.repeat(64),fullAgControl:{},resume:{previousActivation:f.profile.activation,previousRun:f.runs.primary,endedProofHash:ended.proofHash}};
 f.docs.set('journal/rolling-ended:'+ended.queueId+':'+ended.run,{value:receipt});
 const prepared=[];
 return {...f,ended,profile,previous:f.profile,prepared,args:{profile,previous:f.profile,prior:{run:f.runs.primary,commit:f.commit},ended,store:f.store,guard:async()=>{},prepareGame:async({game})=>prepared.push(game.gameId)}};
}
test('existing admit uses the original AG resume for both own cohorts and hands off to the existing permit without source requests',async()=>{
 const f=resumeFixture(),result=await prepareExistingAgResume(f.args);
 assert.deepEqual(f.prepared,['32441','32442']);assert.deepEqual(result.map(r=>[r.previousRun,r.remaining]),[['123:1',['32441']],['456:1',['32442']]]);
 assert(result.every(r=>r.sourceRequests===0));
 await assert.rejects(prepareExistingAgResume(f.args),/EXISTING_HANDOFF_NO_REPLAY/);
});
test('saved blocked or unknown games are retained across the actual admission resume',async()=>{
 for(const unknown of [false,true]){const f=resumeFixture(),game={...f.games[1],phase:unknown?'merging':'blocked',...(unknown?{sgOutcomeUnknownRetained:true}:{})};
  f.docs.set('state/rolling-ag-control:'+queueHash([f.ended.queueId,f.runs.secondary,f.commit]),{value:{cohortRun:f.runs.secondary,commit:f.commit,state:{version:1,queueId:f.ended.queueId,runId:456,games:[game]}}});
  const result=await prepareExistingAgResume(f.args);assert.deepEqual(f.prepared,['32441']);assert.deepEqual(result[1].remaining,[]);
 }
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
