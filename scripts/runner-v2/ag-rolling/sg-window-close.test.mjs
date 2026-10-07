import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {queueHash} from './sg-queue-profile.mjs';
import {sourcePermit,activateQueue} from './sg-queue-control.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {participantKey,cohortRepos,verifyEndedFederation} from './sg-federation.mjs';
import {closureKey,assertWindowJobScope} from './sg-window-recovery-binding.mjs';
import {closeEndedWindow} from './sg-window-close.mjs';
function setup(){
 const games=['32441','32442'].map(gameId=>({gameId,dbName:'sg_'+gameId,campaignId:'sg_'+gameId+'-queue',baseline:0,mongoUri:'sg-native://primary/sg_'+gameId}));
 const target={schema:'sg-ag-rolling-queue-v1',activation:'a'.repeat(64),payload:{version:1,queueId:'queue',games},
  manifest:games.map(g=>({...g,phase:'ready'})),nativeGatewayHash:'b'.repeat(64),nativeManifestHash:'c'.repeat(64),
  federation:{schema:'sg-ag-two-cohort-v1',lanesPerCohort:20,totalLanes:40,namespace:'primary',assignments:games.map((g,i)=>({gameId:g.gameId,cohort:i?'secondary':'primary'}))}};
 const targetRun='101:1',targetCommit='d'.repeat(40),run='103:1',commit='e'.repeat(40);
 const source={status:'running',owner:targetRun,commit:targetCommit,activation:target.activation,queueId:'queue',expiresAt:100};
 const permit={schema:'sg-ag-rolling-permit-v1',run:targetRun,commit:targetCommit,activation:target.activation,queueId:'queue',profileHash:queueHash(target),startsAt:1,expiresAt:100};
 const participant={schema:'sg-ag-cohort-joined-v1',cohort:'secondary',repository:cohortRepos.secondary,run:'102:1',coordinatorRun:targetRun,
  commit:targetCommit,activation:target.activation,profileHash:queueHash(target),queueId:'queue',assignmentHash:queueHash(target.federation),sourceRequests:0};
 const proof={schema:'sg-ag-rolling-complete-v1',queueId:'queue',gameId:games[0].gameId,campaignId:games[0].campaignId,count:300000,fullReadback:true,independentlyVerified:true,recordsHash:'f'.repeat(64)};
 const mergeKey='rolling-merge:'+queueHash(['queue',games[0].gameId,games[0].campaignId]);
 const profile={...structuredClone(target),activation:'1'.repeat(64),operation:'close-ended-window',sourceAllowance:0,codeCommit:'2'.repeat(40),linuxRun:104,
  windowRecovery:{schema:'sg-ag-ended-window-recovery-v1',targetActivation:target.activation,targetRun,targetCommit,targetProfileHash:queueHash(target),
   nativeSourceHash:queueHash(source),permitHash:queueHash(permit),participantHash:queueHash(participant),finalizerJobId:77,
   completedProofs:[{gameId:games[0].gameId,receiptHash:queueHash(proof),recordsHash:proof.recordsHash}]}};
 const docs=new Map(),writes=[],seed=(c,k,value)=>docs.set(c+'/'+k,{_id:'primary/'+k,value:structuredClone(value),version:0});
 seed('state','rolling-source',source);seed('journal','rolling-activation:'+target.activation+':complete',permit);seed('journal',participantKey(target),participant);
 seed('state',mergeKey,{status:'complete',result:proof});seed('journal',mergeKey+':complete',proof);
 for(const game of games)for(const id of ['canary:1','canary:2',...Array.from({length:20},(_,i)=>'worker:'+(i+1))])
  seed('state',taskKey('queue',game,id),{_id:id,queueId:'queue',campaignId:game.campaignId,status:'success',owner:'preserved:'+id});
 const store={async get(c,k){return structuredClone(docs.get(c+'/'+k)??null);},async getMany(c,keys){return Promise.all(keys.map(k=>this.get(c,k)));},
  async create(c,k,value){writes.push(['create',k]);assert(!docs.has(c+'/'+k),'immutable already exists');seed(c,k,value);return this.get(c,k);},
  async cas(c,k,b,value){writes.push(['cas',k]);assert.equal(docs.get(c+'/'+k).version,b.version);docs.set(c+'/'+k,{value:structuredClone(value),version:b.version+1});return true;}};
 const wf=(id,repository,sha)=>({id,run_attempt:1,status:'completed',conclusion:'failure',head_branch:'main',head_sha:sha,event:'workflow_dispatch',path:'.github/workflows/trial-300k.yml',repository:{full_name:repository}});
 const workflows=new Map([[101,wf(101,cohortRepos.primary,targetCommit)],[102,wf(102,cohortRepos.secondary,targetCommit)],
  [103,{...wf(103,cohortRepos.primary,commit),conclusion:'success'}]]);
 const lanes=()=>Array.from({length:20},(_,i)=>({id:i+1,name:'AG rolling lane '+(i+1),status:'completed',conclusion:i<3?'failure':i===19?'cancelled':'success'}));
 const jobs=new Map([[101,{total_count:22,jobs:[...lanes(),{id:76,name:'ag-rolling-admit',status:'completed',conclusion:'success'},
  {id:77,name:'ag-rolling-finalize',status:'completed',conclusion:'cancelled',runner_id:0,steps:[]}]}],
  [102,{total_count:21,jobs:[...lanes(),{id:78,name:'ag-rolling-join',status:'completed',conclusion:'success'}]}],
  [103,{total_count:2,jobs:[{id:79,name:'ag-rolling-window-close',status:'completed',conclusion:'success',runner_id:9},
   {name:'AG rolling lane ${{ matrix.lane }}',status:'completed',conclusion:'skipped'}]}]]);
 const linux={...wf(104,cohortRepos.secondary,profile.codeCommit),conclusion:'success',path:'.github/workflows/preflight.yml'};
 const transport={request:async op=>{assert.equal(op,'hello');return {group:'primary',database:'sg_capture_staging_v1',rollingNamespace:'primary',
  rollingJournalBatchEnabled:true,rollingCleanupEnabled:true,gatewaySha256:profile.nativeGatewayHash,accessManifestHash:profile.nativeManifestHash};},status:()=>({poison:false})};
 const calls=[],args={profile,target,store,transport,boundary:async()=>{},guard:async()=>{},run,commit,now:()=>1000,
  readLinux:async()=>linux,readEnded:async id=>structuredClone(workflows.get(Number(id))),readEndedJobs:async id=>structuredClone(jobs.get(Number(id))),
  merge:async(game,options)=>{calls.push(options);return game.gameId===proof.gameId?structuredClone(proof):{gameId:game.gameId,status:'active'};}};
 const verify=()=>verifyEndedFederation({previous:target,prior:permit,receipt:docs.get('journal/rolling-ended:queue:101:1').value,
  store,readEnded:args.readEnded,readEndedJobs:args.readEndedJobs,readRecoveryProfile:async()=>profile});
 return {args,docs,writes,source,permit,participant,proof,mergeKey,workflows,jobs,linux,seed,calls,verify};
}
function sourceOnlySetup(){
 const s=setup(),job=s.jobs.get(101).jobs.at(-1);
 Object.assign(job,{conclusion:'failure',runner_id:9,started_at:'2026-10-07T02:30:44Z',completed_at:'2026-10-07T02:40:23Z',
  steps:[{name:'Reconcile ended AG lanes without source requests',status:'completed',conclusion:'failure'}]});
 Object.assign(s.args.profile.windowRecovery,{schema:'sg-ag-ended-window-recovery-v2',sourceOnly:true,finalizerJobHash:queueHash(job)});
 s.linux.head_branch='sg-ag-strict-control-20261006';
 s.args.merge=()=>{throw Error('SOURCE_ONLY_MUST_NOT_MERGE');};
 return s;
}
test('executed failed finalizer can be sealed by a distinct source-only actor without replaying tasks, merge or business',async()=>{
 const s=sourceOnlySetup(),before=queueHash([...s.docs]);
 const result=await closeEndedWindow(s.args);
 assert.equal(result.complete,1);assert.equal(result.retained,1);assert.equal(s.calls.length,0);
 assert.deepEqual(s.writes.map(v=>v[0]),['create','create','create','cas']);
 const receipt=s.docs.get('journal/rolling-ended:queue:101:1').value;
 assert.equal(receipt.sourceOnly,true);assert.equal(receipt.sourceJobsEnded,true);assert.equal(receipt.leasesGone,true);
 assert.equal(receipt.games[1].countKnown,false);assert.equal(receipt.failedFinalizerJobHash,queueHash(s.jobs.get(101).jobs.at(-1)));
 assert.equal((await s.verify()).closure.run,'103:1');assert.equal(s.jobs.get(101).jobs.at(-1).conclusion,'failure');
 const savedSource=s.docs.get('state/rolling-source');s.docs.set('state/rolling-source',{_id:'primary/rolling-source',value:s.source,version:0});
 for(const [,key] of s.writes.filter(v=>v[0]==='create'))s.docs.delete('journal/'+key);
 assert.equal(queueHash([...s.docs]),before);assert.equal(savedSource.value.status,'idle');
});
for(const [name,change] of [
 ['failed job document changed',s=>s.jobs.get(101).jobs.at(-1).runner_id++],
 ['cancelled finalizer cannot borrow failure proof',s=>s.jobs.get(101).jobs.at(-1).conclusion='cancelled'],
 ['unfinished finalizer step',s=>{const j=s.jobs.get(101).jobs.at(-1);j.steps[0].status='in_progress';s.args.profile.windowRecovery.finalizerJobHash=queueHash(j);}],
 ['wrong failed step',s=>{const j=s.jobs.get(101).jobs.at(-1);j.steps[0].name='Setup';s.args.profile.windowRecovery.finalizerJobHash=queueHash(j);}],
 ['missing failure hash',s=>delete s.args.profile.windowRecovery.finalizerJobHash],
 ['sourceOnly false',s=>s.args.profile.windowRecovery.sourceOnly=false],
 ['live expired-window lease',s=>s.seed('state',stagingLeaseKey('queue',s.args.target.payload.games[1],'worker',20),{expiresAt:1001})],
 ['unregistered complete native',s=>{const g=s.args.target.payload.games[1];s.seed('state','rolling-merge:'+queueHash(['queue',g.gameId,g.campaignId]),{status:'complete',result:s.proof});}],
 ['existing end receipt unknown',s=>s.seed('journal','rolling-ended:queue:101:1',{unknown:true})],
 ['unknown extra recovery field',s=>s.args.profile.windowRecovery.skip=true]
])test('source-only '+name+' prevents every write',async()=>{const s=sourceOnlySetup();change(s);await assert.rejects(closeEndedWindow(s.args));assert.deepEqual(s.writes,[]);});
test('source-only preserves existing control journal and detects a task changing before ending',async()=>{
 const s=sourceOnlySetup();s.seed('journal','rolling-ag-control:old:1',{file:'own-control-state',value:{retained:true}});
 let n=0;s.args.boundary=async()=>{if(++n===3){const g=s.args.target.payload.games[1];s.docs.get('state/'+taskKey('queue',g,'worker:1')).value.owner='new-actor';}};
 await assert.rejects(closeEndedWindow(s.args),/RETAINED_METADATA_CHANGED/);
 assert.equal(s.docs.get('state/rolling-source').value.status,'running');assert.equal(s.writes.length,1);
 assert.deepEqual(s.docs.get('journal/rolling-ag-control:old:1').value,{file:'own-control-state',value:{retained:true}});
});
for(const [name,change] of [
 ['missing source-only marker',r=>delete r.sourceOnly],['unconfirmed source ending',r=>r.sourceJobsEnded=false],
 ['unconfirmed leases',r=>r.leasesGone=false],['different failed job',r=>r.failedFinalizerJobHash='9'.repeat(64)],
 ['missing retained metadata hash',r=>delete r.retainedMetadataHash],['wrong total',r=>r.complete++],
 ['wrong retained total',r=>r.retained--],['invented game completion',r=>r.games[1]={gameId:r.games[1].gameId,status:'complete',count:300000}],
 ['retained count claimed known',r=>delete r.games[1].countKnown],['game ordering changed',r=>r.games.reverse()]
])test('ended proof reader rejects '+name+' even with a matching new audit hash',async()=>{
 const s=sourceOnlySetup();await closeEndedWindow(s.args);const receipt=s.docs.get('journal/rolling-ended:queue:101:1').value;
 change(receipt);s.docs.get('journal/rolling-window-close:'+s.args.target.activation+':101:1:complete').value.receiptHash=queueHash(receipt);
 await assert.rejects(s.verify(),/SOURCE_ONLY_RECEIPT_CHANGED/);
});
test('distinct closure preserves the original namespace, all tasks and own completed proof, and independently verifies its real successful actor',async()=>{
 const s=setup(),before=queueHash([...s.docs].filter(([k])=>k.includes('rolling-task:')||k.includes('rolling-merge:')));
 const result=await closeEndedWindow(s.args);assert.equal(result.targetRun,'101:1');assert.equal(result.actingRun,'103:1');assert.equal(result.sourceRequests,0);
 assert.equal(queueHash([...s.docs].filter(([k])=>k.includes('rolling-task:')||k.includes('rolling-merge:'))),before);
 assert.deepEqual(s.writes.map(v=>v[0]),['create','create','create','cas']);assert.equal(s.docs.get('state/rolling-source').value.lastRun,'101:1');
 assert.equal((await s.verify()).closure.run,'103:1');assert.equal(s.jobs.get(101).jobs.at(-1).conclusion,'cancelled');
});
test('original expired permit permits only ended-target validation; the closure operation cannot admit tasks or request source',async()=>{
 const s=setup();assert.equal((await sourcePermit({profile:s.args.target,store:s.args.store,run:'101:1',commit:s.permit.commit,sourceJobsEnded:true,now:()=>1000})).run,'101:1');
 await assert.rejects(sourcePermit({profile:s.args.target,store:s.args.store,run:'101:1',commit:s.permit.commit,now:()=>1000}),/SOURCE_PERMISSION/);
 await assert.rejects(sourcePermit({...s.args,sourceJobsEnded:true}),/CONTROL_PROFILE_HAS_NO_SOURCE/);
 await assert.rejects(activateQueue(s.args),/CONTROL_PROFILE_HAS_NO_SOURCE/);assert.deepEqual(s.writes,[]);
});
for(const [name,change] of [
 ['active companion',s=>s.jobs.get(102).jobs[5].status='in_progress'],
 ['duplicate lane',s=>s.jobs.get(101).jobs[0].name='AG rolling lane 2'],
 ['incomplete inventory',s=>s.jobs.get(102).total_count++],
 ['foreign successful job',s=>{s.jobs.get(101).jobs.push({name:'foreign',status:'completed',conclusion:'success'});s.jobs.get(101).total_count++;}],
 ['failed join',s=>s.jobs.get(102).jobs.at(-1).conclusion='failure'],
 ['executed cancelled finalizer',s=>s.jobs.get(101).jobs.at(-1).runner_id=8],
 ['finalizer with steps',s=>s.jobs.get(101).jobs.at(-1).steps=[{status:'completed'}]],
 ['another finalizer',s=>s.jobs.get(101).jobs.at(-1).id++],
 ['target run attempt two',s=>s.workflows.get(101).run_attempt=2],
 ['target commit changed',s=>s.workflows.get(102).head_sha='9'.repeat(40)],
 ['acting identity equals target',s=>s.args.run='101:1'],
 ['source claim changed',s=>s.docs.get('state/rolling-source').value.owner='999:1'],
 ['permit changed',s=>s.docs.get('journal/rolling-activation:'+s.args.target.activation+':complete').value.expiresAt++],
 ['participant changed',s=>s.docs.get('journal/'+participantKey(s.args.target)).value.run='999:1'],
 ['payload changed',s=>s.args.profile.payload.games.reverse()],
 ['scope changed',s=>s.args.profile.sourceAllowance=1],
 ['live canary lease',s=>s.seed('state',stagingLeaseKey('queue',s.args.target.payload.games[0],'canary',1),{expiresAt:1001})],
 ['unknown lease expiry',s=>s.seed('state',stagingLeaseKey('queue',s.args.target.payload.games[1],'worker',20),{})],
 ['missing task',s=>s.docs.delete('state/'+taskKey('queue',s.args.target.payload.games[1],'worker:19'))],
 ['own immutable proof changed',s=>s.docs.get('journal/'+s.mergeKey+':complete').value.recordsHash='8'.repeat(64)],
 ['old Linux borrowed',s=>s.linux.head_sha=s.permit.commit],
 ['failed Linux',s=>s.linux.conclusion='failure'],
 ['non-main Linux',s=>s.linux.head_branch='other']]){
 test(name+' prevents every closure write',async()=>{const s=setup();change(s);await assert.rejects(closeEndedWindow(s.args));assert.deepEqual(s.writes,[]);});
}
test('the immutable intent prevents a second actor after an interrupted closure, without retrying old metadata writes',async()=>{
 const s=setup();s.args.merge=async()=>{throw Object.assign(new Error('unknown'),{outcomeUnknown:true});};
 await assert.rejects(closeEndedWindow(s.args),/unknown/);assert.equal(s.writes.length,1);assert.deepEqual(s.docs.get('state/rolling-source').value,s.source);
 s.args.run='105:1';await assert.rejects(closeEndedWindow(s.args),/ALREADY_STARTED_NO_RETRY/);assert.equal(s.writes.length,1);
});
test('an unknown source CAS is issued once and cannot be credited as a successful independent ending',async()=>{
 const s=setup();let calls=0;s.args.store.cas=async()=>{calls++;throw Object.assign(new Error('unknown cas'),{outcomeUnknown:true});};
 await assert.rejects(closeEndedWindow(s.args),/unknown cas/);assert.equal(calls,1);assert.equal(s.docs.get('state/rolling-source').value.status,'running');
 await assert.rejects(closeEndedWindow(s.args),/ALREADY_STARTED_NO_RETRY/);assert.equal(calls,1);
});
test('ended controller recovery is bound to its actual original owner and preserves already saved rows',async()=>{
 const s=setup();await closeEndedWindow(s.args);const fn=s.calls[0].recoverMerging;
 assert.equal((await fn({owner:'101:1:ag-rolling-capture:controller'})).jobId,20);
 await assert.rejects(fn({owner:'103:1:ag-rolling-window-close:controller'}),/RECOVERY_OWNER/);
});
test('an unknown GH read has one attempt and zero durable writes',async()=>{
 const s=setup();let n=0;s.args.readEndedJobs=async()=>{n++;throw Object.assign(new Error('unknown gh'),{outcomeUnknown:true});};
 await assert.rejects(closeEndedWindow(s.args),/unknown gh/);assert.equal(n,1);assert.deepEqual(s.writes,[]);
});
test('a newly appearing actor at the final boundary prevents native idle and is not retried',async()=>{
 const s=setup();let n=0;s.args.boundary=async()=>{if(++n===3)throw new Error('OTHER_RUN_ACTIVE');};
 await assert.rejects(closeEndedWindow(s.args),/OTHER_RUN_ACTIVE/);assert.equal(s.docs.get('state/rolling-source').value.status,'running');assert.equal(s.writes.length,1);
});
test('independent ending never borrows old source SUCCESS, a queued closure, failed closure or altered immutable intent',async()=>{
 for(const change of [s=>s.workflows.get(103).status='queued',s=>s.workflows.get(103).conclusion='failure',
  s=>s.jobs.get(103).jobs[0].runner_id=0,s=>s.jobs.get(103).jobs[0].name='ag-rolling-admit',
  s=>s.jobs.get(103).jobs[0].status='in_progress',s=>s.docs.get('journal/'+closureKey(s.args.profile.windowRecovery)).value.run='104:1']){
  const s=setup();await closeEndedWindow(s.args);change(s);await assert.rejects(s.verify());
 }
});
test('old finalizer failure with no separately bound closure remains rejected by the original federation gate',async()=>{
 const s=setup();await closeEndedWindow(s.args);delete s.docs.get('journal/rolling-ended:queue:101:1').value.closure;
 await assert.rejects(s.verify(),/CONTROL_FAILED/);
});
test('workflow closure has one 35 minute hosted job, locked dependencies, and no gameplay secrets or source matrix',()=>{
 const yaml=createRequire(import.meta.url)('../../../collector/node_modules/js-yaml'),workflow=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
 const job=workflow.jobs['ag-rolling-window-close'];assert.equal(job['timeout-minutes'],35);assert.equal(job['runs-on'],'ubuntu-latest');assert.equal(job.strategy,undefined);
 assert.equal(job.env.SG_TRIAL_DEMO_CONFIG,undefined);assert.equal(job.env.SG_AG_LANE,undefined);
 const install=job.steps.findIndex(s=>s.run==='npm ci --ignore-scripts --no-audit --no-fund'),entry=job.steps.findIndex(s=>s.run?.includes('sg-window-close-job.mjs'));
 assert(install>=0&&install<entry);assert(job.if.includes("inputs.role == 'ag-rolling-window-close'"));
 assert.equal(workflow.jobs['ag-rolling-capture']['timeout-minutes'],350);
 assert.equal(workflow.jobs['ag-rolling-capture'].strategy['max-parallel'],20);
});
test('the real entry refuses another repo, branch, attempt, job or gameplay secret before connecting native transport',()=>{
 const env={GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REPOSITORY:cohortRepos.primary,
  GITHUB_JOB:'ag-rolling-window-close',GITHUB_REF:'refs/heads/main',GITHUB_RUN_ID:'103',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'e'.repeat(40)};
 assertWindowJobScope(env);
 for(const [key,value] of [['GITHUB_REPOSITORY',cohortRepos.secondary],['GITHUB_REF','refs/heads/other'],['GITHUB_RUN_ATTEMPT','2'],
  ['GITHUB_JOB','ag-rolling-finalize'],['SG_AG_LANE','20'],['SG_TRIAL_DEMO_CONFIG','fixture'],['RUNNER_ENVIRONMENT','self-hosted']])
  assert.throws(()=>assertWindowJobScope({...env,[key]:value}),/GITHUB_SCOPE/);
});
