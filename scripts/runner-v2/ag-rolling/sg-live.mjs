import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectGateway} from '../transport.mjs';
import {RunnerState} from '../state-store.mjs';
import {ResourceGate} from '../resource-gate.mjs';
import {authenticatedRead} from '../github-boundary.mjs';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {checkPrimaryLeases} from '../lease-boundary.mjs';
import {analyzer} from '../analyzer.mjs';
import {serializeTransport} from './sg-transport.mjs';
import {queueProfile,queueHash} from './sg-queue-profile.mjs';
import {activateQueue,sourcePermit,readTasks} from './sg-queue-control.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {createTaskRuntime} from './sg-task-runtime.mjs';
import {runSgLane} from './sg-lane.mjs';
import {mergeGame} from './sg-merge.mjs';
import {resetEndedTask} from './sg-resume.mjs';
import {inspectFormalBaseline} from './sg-formal-baseline.mjs';
import {inspectNewGame} from './sg-new-game.mjs';
import {LANE_BUDGET_MS} from './ag-core.mjs';
import {auditTasks,readOnlyAuditTransport} from './sg-admission-audit.mjs';

assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'
 &&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner',
 'SG_AG_GITHUB_OWNER');
const mode=process.argv[2],name=process.env.SG_AG_QUEUE_PROFILE;
assert(['admit','lane','controller','reconcile'].includes(mode)&&/^ag-rolling-queue-[a-f0-9]{64}\.json$/.test(name??''),'SG_AG_LIVE_MODE');
if(mode==='controller')assert(process.env.GITHUB_JOB==='ag-rolling-capture'&&process.env.SG_AG_CONTROLLER_LANE==='20'
 &&process.env.SG_TRIAL_DEMO_CONFIG===undefined&&process.env.SG_AG_LANE===undefined,'SG_AG_CONTROLLER_SCOPE');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const registry=read('config/ag-rolling-plans.json'),profile=queueProfile({name,profile:read('config/'+name),
 authorization:read('config/ag-rolling-authorizations.json'),plans:registry,readBytes:file=>fs.readFileSync(file)});
const run=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT,commit=process.env.GITHUB_SHA;
assert(/^\d+:1$/.test(run)&&/^[a-f0-9]{40}$/.test(commit),'SG_AG_RUN_IDENTITY');
const transport=serializeTransport(connectGateway()),gate=new ResourceGate(),deadline=Date.now()+(['lane','controller'].includes(mode)?LANE_BUDGET_MS:mode==='admit'?120*60000:40*60000);
const store=new RunnerState({transport,gate,deadline}),stop=new AbortController();
let localLaneEnded=false;
if(mode==='controller')process.on('message',message=>{
 if(message?.type==='lane-source-ended'&&message.lane===20)localLaneEnded=true;
});
let mergeParser,mergeTail=Promise.resolve(),recoverMerging,auditReaders=[];
process.on('SIGTERM',()=>stop.abort());process.on('SIGINT',()=>stop.abort());
const log=row=>console.log(row),sourceCheck={at:-Infinity,pending:null};let tasksChecking=new Map(),sourceJobsEnded=false;
async function globalGuard(context={}){
 assert(mode!=='controller'||!stop.signal.aborted,'SG_AG_CONTROLLER_STOPPED');
 await store.writable();assert(gate.status().metrics.diskFreeBytes>=(context.msgId==='BET'?30:25)*1024**3,'SG_AG_DISK_RESERVE');
 if(sourceCheck.pending)await sourceCheck.pending;
 else if(Date.now()-sourceCheck.at>=1000){
  const checking=(async()=>{
   await sourcePermit({profile,store,run,commit,sourceJobsEnded});
   const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'SG_AG_GLOBAL_HOLD');
   sourceCheck.at=Date.now();
  })();sourceCheck.pending=checking;
  try{await checking;}finally{if(sourceCheck.pending===checking)sourceCheck.pending=null;}
 }
 // The allowed resource flag is never cached. Every request observes its
 // current resource gate; mutable source identity/holds expire after 1 sec.
 assert(gate.status().allowed&&Date.now()-sourceCheck.at<=1000,'SG_AG_GUARD_STALE');
}
function taskGuard(context){
 const {game,queueId,kind,index,owner}=context;
 return async request=>{
  await globalGuard(request);const id=`${kind}:${index}`,key=taskKey(queueId,game,id);
  let check=tasksChecking.get(key);
  if(check?.pending){await check.pending;check=tasksChecking.get(key);}
  if(!check||Date.now()-check.at>=1000){
   const pending=(async()=>{
    const row=(await store.get('state',key))?.value;
    assert(row?.status==='running'&&row.owner===owner&&row.queueId===queueId&&row.campaignId===game.campaignId,'SG_AG_TASK_OWNER');
    return {row,at:Date.now()};
   })();check={pending,at:-Infinity};tasksChecking.set(key,check);
   try{check={...await pending,pending:null};tasksChecking.set(key,check);}catch(error){tasksChecking.delete(key);throw error;}
  }
  assert(check.row.owner===owner&&Date.now()-check.at<=1000,'SG_AG_TASK_CHECK_STALE');
  if(request?.stage==='request'){
   const lease=(await store.get('state',stagingLeaseKey(queueId,game,kind,index)))?.value;
   assert(lease?.owner===owner&&lease.expiresAt>Date.now(),'SG_AG_SOURCE_LEASE');
  }
 };
}
async function verifyRecords(plan,records){
 const rows=structuredClone(records).sort((a,b)=>a.sequence-b.sequence);
 const next=mergeTail.then(()=>{mergeParser??=analyzer();return mergeParser.verifyPage(plan,rows);});
 mergeTail=next.catch(()=>{});return next;
}
async function merge(game){
 const plan=registry.plans[game.gameId];
 const result=await mergeGame({store,transport,game,queueId:profile.payload.queueId,plan,guard:globalGuard,
  verifyRecords:records=>verifyRecords(plan,records),inspectBaseline:async()=>{
   assert(game.baseline===0,'SG_AG_FIRST_QUEUE_BASELINE');return {verified:true,count:0};},
  owner:run+':'+process.env.GITHUB_JOB+':'+(process.env.SG_AG_LANE??'controller'),cleanup:true,recoverMerging});
 if(result.status!=='active')log(JSON.stringify({gameId:game.gameId,phase:result.status??'complete',count:result.count??0,
  reason:result.reason??null}));return result;
}
try{
 if(mode==='admit'){
  const gh=authenticatedRead(process.env.GH_TOKEN),boundary=maintenanceBoundary({read:gh,store,
   oldProfile:read('config/demo-pilot-beaver-20260930.json'),run,commit,workflowPath:'.github/workflows/trial-300k.yml'});
  const result=await activateQueue({profile,store,transport,boundary,commit,run,
   readLinux:id=>gh(`repos/287113535qq-cmyk/sg-capture-runner/actions/runs/${id}`),
   readEnded:id=>gh(`repos/zyzuoyang/sg-capture-runner/actions/runs/${id}`),
   readEndedJobs:id=>gh(`repos/zyzuoyang/sg-capture-runner/actions/runs/${id}/jobs?filter=all&per_page=100`),
   readPrevious:activation=>read(`config/ag-rolling-queue-${activation}.json`),
   checkNewGame:context=>inspectNewGame({...context,store,transport,plan:registry.plans[context.game.gameId]}),
   prepareResume:async({game,queueId,ended,previous,guard})=>{
    const permit=(await store.get('journal','rolling-activation:'+profile.resume.previousActivation+':complete'))?.value;
    assert(queueHash(previous)===permit.profileHash&&previous.payload.queueId===queueId
     &&previous.payload.games.some(g=>queueHash(g)===queueHash(game)),'SG_AG_RESUME_GAME_CHANGED');
    const plan=registry.plans[game.gameId];
    const baseline=await inspectFormalBaseline({profile,game,plan,store,transport,ended,guard});
    if(baseline.status==='complete')return; // Its immutable proof survives staging cleanup.
    const oldEntry=previous.manifest.find(g=>g.gameId===game.gameId),entry=profile.manifest.find(g=>g.gameId===game.gameId);
    assert(oldEntry&&entry,'SG_AG_RESUME_MANIFEST_REQUIRED');
    const revalidateSuccess=oldEntry.planHash!==entry.planHash||oldEntry.adapterProofHash!==entry.adapterProofHash;
    if(!auditReaders.length)auditReaders=Array.from({length:4},()=>{
     const reader=readOnlyAuditTransport(serializeTransport(connectGateway({compression:true}))),parser=analyzer();
     const readStore=new RunnerState({transport:reader,gate,deadline});
     const scopedStore={get:readStore.get.bind(readStore),getMany:readStore.getMany.bind(readStore),
      create:store.create.bind(store),cas:store.cas.bind(store)};
     return {reader,parser,store:scopedStore};
    });
    await auditTasks([...[1,2].map(i=>['canary',i]),...Array.from({length:20},(_,i)=>['worker',i+1])],{
     contexts:auditReaders,audit:async([kind,index],context)=>resetEndedTask({store:context.store,transport:context.reader,
      game,queueId,kind,index,guard,ended,revalidateSuccess,verifyRecords:rows=>context.parser.verifyPage(plan,[...rows].sort((a,b)=>a.sequence-b.sequence))})});
   },
   checkBaselines:async(_profile,ended)=>{
    await checkPrimaryLeases({store,plans:read('config/round-one-plans.json'),read});
    const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(r=>r?.value.active===false),'SG_AG_GLOBAL_HOLD');
    const campaign=(await store.get('state','campaign'))?.value;
    for(const game of profile.payload.games){
     assert(campaign?.games.find(g=>g.game_id===Number(game.gameId))?.status!=='complete','SG_AG_ALREADY_COMPLETE');
     await inspectFormalBaseline({profile,game,plan:registry.plans[game.gameId],store,transport,ended,
      guard:async()=>{await store.writable();const fresh=await transport.request('global_holds');
       assert(fresh.length===2&&fresh.every(r=>r?.value.active===false),'SG_AG_GLOBAL_HOLD');}});
    }
   }});log(JSON.stringify(result));
 }else if(mode==='lane'){
  const base=JSON.parse(process.env.SG_TRIAL_DEMO_CONFIG??'{}'),lane=Number(process.env.SG_AG_LANE);
  const healthy=await runSgLane({payload:profile.payload,manifest:profile.manifest,lane,
   runId:process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,store,deadline,signal:stop.signal,log,
   guard:()=>globalGuard(),createTask:async context=>{
    const row=(await store.get('state',taskKey(context.queueId,context.game,`${context.kind}:${context.index}`)))?.value;
    assert(row?.owner===context.owner&&row.status==='running','SG_AG_TASK_OWNER');
    return createTaskRuntime({...context,store,transport,resume:row.resume,
     plan:registry.plans[context.game.gameId],base,guard:taskGuard(context)});
   }});
  process.exitCode=healthy?0:2;
 }else if(mode==='controller'){
  const gh=authenticatedRead(process.env.GH_TOKEN),completed=new Set();
  while(!stop.signal.aborted&&Date.now()<deadline){
   for(const game of profile.payload.games){if(completed.has(game.gameId))continue;
    try{const result=await merge(game);if(result.count===300000)completed.add(game.gameId);}
    catch(error){if(error.outcomeUnknown===true||transport.status().poison||stop.signal.aborted)throw error;
     const code=error.code??error.message;log(JSON.stringify({gameId:game.gameId,status:'retained',
      reason:/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_AG_MERGE_REVIEW_REQUIRED'}));}
   }
   const jobs=await gh(`repos/zyzuoyang/sg-capture-runner/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=all&per_page=100`);
   assert(jobs.total_count===jobs.jobs.length&&jobs.total_count<100,'SG_AG_JOBS_TRUNCATED');
   const lanes=jobs.jobs.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));
   if(lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20
    &&lanes.every(j=>j.status==='completed'||j.name==='AG rolling lane 20'&&localLaneEnded))break;
   await new Promise(r=>setTimeout(r,30000));
  }
  log(JSON.stringify({phase:'controller-ended',complete:completed.size,sourceRequests:0}));
 }else{
  const gh=authenticatedRead(process.env.GH_TOKEN),jobs=await gh(`repos/zyzuoyang/sg-capture-runner/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?filter=all&per_page=100`);
  assert(jobs.total_count===jobs.jobs.length&&jobs.total_count<100,'SG_AG_JOBS_TRUNCATED');
  const lanes=jobs.jobs.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));
  assert(lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20&&lanes.every(j=>j.status==='completed'),'SG_AG_SOURCE_JOBS_ACTIVE');
  sourceJobsEnded=true;
  recoverMerging=async previous=>{
   assert(previous.owner===run+':ag-rolling-capture:controller','SG_MERGE_RECOVERY_OWNER');
   const actor=jobs.jobs.filter(j=>j.name==='AG rolling lane 20');
   assert(actor.length===1&&actor[0].status==='completed','SG_MERGE_CONTROLLER_ACTIVE');
   return {actorEnded:true,owner:previous.owner,run,commit,jobId:actor[0].id,sourceRequests:0};
  };
  const results=[];for(const game of profile.payload.games){
   try{results.push(await merge(game));}catch(error){
    if(error.outcomeUnknown===true||transport.status().poison)throw error;
    const code=error.code??error.message;
    const failure={gameId:game.gameId,status:'blocked',reason:/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_AG_MERGE_REVIEW_REQUIRED'};
    results.push(failure);log(JSON.stringify(failure));
   }
  }
  const keys=profile.payload.games.flatMap(game=>[...[1,2].map(i=>stagingLeaseKey(profile.payload.queueId,game,'canary',i)),
   ...Array.from({length:20},(_,i)=>stagingLeaseKey(profile.payload.queueId,game,'worker',i+1))]);
  for(;;){let live=0;for(let i=0;i<keys.length;i+=100){const rows=await store.getMany('state',keys.slice(i,i+100));
    live+=rows.filter(r=>r?.value.expiresAt>Date.now()).length;}
   if(live===0)break;assert(Date.now()<deadline,'SG_AG_SOURCE_LEASES_ACTIVE');await new Promise(r=>setTimeout(r,10000));
  }
  const before=await store.get('state','rolling-source');
  assert(before.value.owner===run&&before.value.status==='running','SG_AG_SOURCE_FENCE');
  const result={schema:'sg-ag-rolling-window-ended-v1',queueId:profile.payload.queueId,run,commit,
   activation:profile.activation,profileHash:queueHash(profile),
   complete:results.filter(r=>r.count===300000).length,retained:results.filter(r=>r.count!==300000).length,
   games:results.map(r=>({gameId:r.gameId,status:r.status??'complete',count:r.count??0})),sourceRequests:0};
  await store.create('journal','rolling-ended:'+profile.payload.queueId+':'+run,result,{immutable:true});
  assert(await store.cas('state','rolling-source',before,{owner:null,queueId:null,status:'idle',lastRun:run,
   lastQueueId:profile.payload.queueId,endedProofHash:queueHash(result)}),'SG_AG_SOURCE_FENCE');log(JSON.stringify(result));
 }
}catch(error){const code=error.code??error.message;log(JSON.stringify({outcome:'stopped',code:/^[A-Z_]{1,100}$/.test(code??'')?code:'SG_AG_CONTROL_STOPPED'}));process.exitCode=2;}
finally{await mergeTail;mergeParser?.close();for(const [index,context] of auditReaders.entries()){
 log(JSON.stringify({kind:'sg-ag-admission-read-performance',reader:index+1,...context.reader.metrics()}));context.parser.close();context.reader.close();}
 log(JSON.stringify({kind:'sg-ag-native-performance',...transport.metrics()}));transport.close();}
