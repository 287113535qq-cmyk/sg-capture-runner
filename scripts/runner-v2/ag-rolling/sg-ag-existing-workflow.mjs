import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {analyzer} from '../analyzer.mjs';
import {stable} from '../mongo-writer.mjs';
import {maintenanceBoundary} from '../demo-run-fence.mjs';
import {cohortRepos,participantKey,inspectParticipant} from './sg-federation.mjs';
import {sourcePermit} from './sg-queue-control.mjs';
import {assertOrdinaryPrivileges} from './sg-ag-ordinary-admission.mjs';
import {verifyOwnStrictLinux} from './sg-ag-ordinary-linux.mjs';
import {mongoOnce} from './sg-ag-ordinary-business.mjs';
import {createLiveAgController} from './sg-ag-live-controller.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {protectMongoOnce} from './sg-ag-once-mongo.mjs';
import {createGameBudget} from './sg-ag-game-budget.mjs';
import {loadExistingControlState} from './sg-ag-control-journal-cursor.mjs';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export function inspectExistingWorkflowPolicy(profile){
 const policy=profile.fullAgControl;
 assert(policy?.schema==='sg-ag-existing-workflow-control-v1'
  &&Object.keys(policy).sort().join(',')==='completedBusinessReceipts,evidenceMode,linuxEvidenceFile,linuxEvidenceSha256,schema'
  &&policy.evidenceMode==='existing-immutable-audit'
  &&/^config\/ag-full-control-linux-[a-f0-9]{64}\.json$/.test(policy.linuxEvidenceFile??'')
  &&/^[a-f0-9]{64}$/.test(policy.linuxEvidenceSha256??''),'SG_AG_EXISTING_WORKFLOW_POLICY');
 assert(policy.completedBusinessReceipts&&typeof policy.completedBusinessReceipts==='object'
  &&Object.entries(policy.completedBusinessReceipts).every(([id,v])=>/^32\d{3}$/.test(id)
   &&Object.keys(v).sort().join(',')==='auditCompleteKey,auditDocumentHash,nativeReceiptHash'
   &&typeof v.auditCompleteKey==='string'&&v.auditCompleteKey.startsWith('game:'+id+':'+v.nativeReceiptHash)
   &&(/:complete$/.test(v.auditCompleteKey))
   &&/^[a-f0-9]{64}$/.test(v.auditDocumentHash)&&/^[a-f0-9]{64}$/.test(v.nativeReceiptHash)),'SG_AG_EXISTING_COMPLETED_PROOFS');
 return policy;
}
export function inspectExistingGameBinding({binding:b,game:g,profile,plan}){
 assert(b&&plan&&String(b.gameId)===g.gameId&&String(plan.gameId)===g.gameId
  &&b.queueId===profile.payload.queueId&&g.dbName==='sg_'+g.gameId
  &&b.database==='sg_'+plan.runtimeSlug&&b.runtimeSlug===plan.runtimeSlug
  &&b.runtimeGameId===plan.runtimeGameId&&b.trialId===plan.trialId,'SG_AG_EXISTING_OWN_BINDING');
 return b;
}
export async function openExistingWorkflowControl({profile,store,transport,guard,githubRead,coordinatorRun,commit,sourceClose,sourceJobsEnded=()=>false}){
 const policy=inspectExistingWorkflowPolicy(profile);
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'
  &&process.env.GITHUB_REPOSITORY===cohortRepos.primary&&['ag-rolling-capture','ag-rolling-finalize'].includes(process.env.GITHUB_JOB),'SG_AG_EXISTING_WORKFLOW_IDENTITY');
 const bytes=fs.readFileSync(policy.linuxEvidenceFile);
 assert(createHash('sha256').update(bytes).digest('hex')===policy.linuxEvidenceSha256,'SG_AG_EXISTING_WORKFLOW_LINUX_BYTES');
 const linux=verifyOwnStrictLinux(JSON.parse(bytes),profile.codeCommit,process.cwd());
 assert(linux.run===Number(profile.linuxRun)&&linux.joinedCommands===14&&linux.sealedTasks===9,'SG_AG_EXISTING_WORKFLOW_OWN_LINUX');
 assert(process.env.SG_BUSINESS_MONGO_PASSWORD&&process.env.SG_BUSINESS_SSH_KEY_FILE&&process.env.SG_SSH_HOSTS_FILE,'SG_AG_EXISTING_WRITER_CONFIGURATION');
 const bindings=read('config/ag-business-bindings.json').bindings,plans=read('config/ag-rolling-plans.json').plans;
 const require=createRequire(import.meta.url),{MongoClient,ObjectId}=require('../../../collector/node_modules/mongodb');
 const once=protectMongoOnce(new MongoClient('mongodb://52.87.94.113:27017',{auth:{username:'sg_simulate_delivery_v1',password:process.env.SG_BUSINESS_MONGO_PASSWORD},authSource:'admin',authMechanism:'SCRAM-SHA-1',retryReads:false,retryWrites:false,maxPoolSize:2,waitQueueTimeoutMS:10000,connectTimeoutMS:10000,serverSelectionTimeoutMS:10000,socketTimeoutMS:60000})),client=once.client;
 let parser;
 try{
 await mongoOnce(()=>client.connect());
 assertOrdinaryPrivileges(await mongoOnce(()=>client.db('admin').command({connectionStatus:1,showPrivileges:true})),{profile,plans,binding:bindings[profile.payload.games[0].gameId]});
 parser=analyzer();const originals=new Map();let canonicalAt=-Infinity;
 const directory=path.resolve('business-evidence');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 function persist(file,value){
  const safe=file.replaceAll(/[^A-Za-z0-9_-]/g,'_'),filename=path.join(directory,safe+'.json');
  const data=Buffer.from(stable(value)+'\n'),fd=fs.openSync(filename,'w',0o600);
  try{let offset=0;while(offset<data.length)offset+=fs.writeSync(fd,data,offset,data.length-offset);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  assert(fs.readFileSync(filename).equals(data),'SG_AG_EXISTING_CONTROL_FULL_READBACK');
  return {fullReadback:true};
 }
 const baseline=async g=>{
  if(!originals.has(g.gameId)){
   const b=inspectExistingGameBinding({binding:bindings[g.gameId],game:g,profile,plan:plans[g.gameId]});
   const pool=client.db(b.database).collection('simulate'),query={'data.captureCampaignId':{$ne:g.campaignId}};
   const count=await mongoOnce(()=>pool.countDocuments(query,{maxTimeMS:15000}));
   const documents=(await mongoOnce(()=>pool.find(query,{sort:{_id:1},maxTimeMS:30000}).limit(count+1).toArray())).map(d=>({...d,_id:String(d._id)}));
   assert(documents.length===count,'SG_AG_EXISTING_ORIGINAL_COUNT');originals.set(g.gameId,{count,documents});
  }
  return originals.get(g.gameId);
 };
 async function ordinaryGuard(phase,g){
  once.assertUsable();await guard();
  if(g&&!phase.startsWith('settle-ended'))assert(bindings[g.gameId]&&plans[g.gameId].adapter==='native-nextgen-v1','SG_AG_EXISTING_OWN_ADAPTER_REQUIRED');
  if(Date.now()-canonicalAt<15000)return;
  const part=(await store.get('journal',participantKey(profile)))?.value;
  if(profile.federation&&part)inspectParticipant({profile,receipt:part,coordinatorRun,commit});
  await sourcePermit({profile,store,run:coordinatorRun,commit,sourceJobsEnded:sourceJobsEnded()});
  for(const [cohort,run] of [['primary',coordinatorRun],...(part?[['secondary',part.run]]:[])]){
   const repository=cohortRepos[cohort],actor=await githubRead(`repos/${repository}/actions/runs/${run.split(':')[0]}`),jobs=await githubRead(`repos/${repository}/actions/runs/${run.split(':')[0]}/jobs?filter=all&per_page=100`);
   const control=cohort==='primary'?'ag-rolling-admit':'ag-rolling-join',lanes=jobs.jobs?.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));
   assert(actor.id===Number(run.split(':')[0])&&actor.run_attempt===1&&actor.head_sha===commit&&actor.head_branch==='main'
    &&actor.repository?.full_name===repository&&actor.event==='workflow_dispatch'&&actor.path==='.github/workflows/trial-300k.yml'
    &&['in_progress','completed'].includes(actor.status),'SG_AG_EXISTING_CAPTURE_IDENTITY');
   assert(jobs.total_count===jobs.jobs?.length&&jobs.total_count<100&&lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20
    &&jobs.jobs.every(j=>j.run_id===actor.id)&&jobs.jobs.filter(j=>j.name===control&&j.status==='completed'&&j.conclusion==='success').length===1
    &&jobs.jobs.filter(j=>j.conclusion!=='skipped').every(j=>lanes.includes(j)||j.name===control||cohort==='primary'&&j.name==='ag-rolling-finalize')
    &&(actor.status!=='completed'||jobs.jobs.every(j=>j.status==='completed')),'SG_AG_EXISTING_CAPTURE_FULL_INVENTORY');
  }
  await maintenanceBoundary({read:async p=>{
   const result=await githubRead(p);if(!part||!p.startsWith(`repos/${cohortRepos.secondary}/actions/runs?`))return result;
   assert(result.total_count===result.workflow_runs?.length&&result.total_count<100,'SG_AG_EXISTING_CANONICAL_INVENTORY');
   const remove=result.workflow_runs.filter(r=>String(r.id)===part.run.split(':')[0]);
   assert(remove.length<=1&&remove.every(r=>r.head_sha===commit&&r.run_attempt===1&&r.path==='.github/workflows/trial-300k.yml'),'SG_AG_EXISTING_CANONICAL_COMPANION');
   return {...result,total_count:result.total_count-remove.length,workflow_runs:result.workflow_runs.filter(r=>!remove.includes(r))};
  },store,oldProfile:read('config/demo-pilot-beaver-20260930.json'),run:coordinatorRun,commit,workflowPath:'.github/workflows/trial-300k.yml'})();
  canonicalAt=Date.now();
 }
 const control=createLiveAgController({profile,store,coordinatorRun,commit,sourceClose,canStart:async participant=>{
  inspectParticipant({profile,receipt:participant,coordinatorRun,commit});
  const actor=await githubRead(`repos/${cohortRepos.secondary}/actions/runs/${participant.run.split(':')[0]}`);
  assert(actor.id===Number(participant.run.split(':')[0])&&actor.run_attempt===1&&actor.head_sha===commit&&actor.repository?.full_name===cohortRepos.secondary
   &&actor.path==='.github/workflows/trial-300k.yml'&&actor.head_branch==='main'&&actor.event==='workflow_dispatch','SG_AG_EXISTING_JOIN_ACTOR');
  const jobs=await githubRead(`repos/${cohortRepos.secondary}/actions/runs/${actor.id}/jobs?filter=all&per_page=100`);
  assert(jobs.total_count===jobs.jobs?.length&&jobs.total_count<100&&jobs.jobs.every(j=>j.run_id===actor.id),'SG_AG_EXISTING_JOIN_INVENTORY');
  const join=jobs.jobs.filter(j=>j.name==='ag-rolling-join');assert(join.length===1,'SG_AG_EXISTING_JOIN_JOB');
  if(join[0].status!=='completed')return false;
  assert(join[0].conclusion==='success','SG_AG_EXISTING_JOIN_FAILED');
  const lanes=jobs.jobs.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));return lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20;
 },makeContext:async({repository,cohortRun,state})=>{
  const key='rolling-ag-control:'+queueHash([profile.payload.queueId,cohortRun,commit]),pending=[];let sequence=0,poisoned=false;
  async function flushControl(){
   assert(!poisoned,'SG_AG_CONTROL_UNKNOWN_ACK_NO_REPLAY');
   try{while(pending.length){const {file,value}=pending[0],journal=key+':'+(++sequence);
    await store.create('journal',journal,{file,value,cohortRun,commit},{immutable:true});
    assert(stable((await store.get('journal',journal))?.value)===stable({file,value,cohortRun,commit}),'SG_AG_CONTROL_JOURNAL_FULL_READBACK');
    if(file==='own-control-state'){const before=await store.create('state',key,{cohortRun,commit,state:null});
     assert(before.value.cohortRun===cohortRun&&before.value.commit===commit,'SG_AG_CONTROL_STATE_OWNER');
     const next={cohortRun,commit,state:value,sequence,journal};assert(await store.cas('state',key,before,next),'SG_AG_CONTROL_STATE_CAS');
     assert(stable((await store.get('state',key))?.value)===stable(next),'SG_AG_CONTROL_STATE_FULL_READBACK');
    }
    pending.shift();
   }}catch(error){poisoned=true;error.outcomeUnknown=true;throw error;}
  }
  const privateControlPersist=(file,value)=>{const saved=persist(cohortRun+'-'+file,value);pending.push({file,value:structuredClone(value)});return saved;};
  const gameBudget=createGameBudget({state,persist:privateControlPersist,flush:flushControl});
  return {
  transport,parser,businessClient:client,ObjectId,bindings,plans,githubRead,evidenceMode:policy.evidenceMode,sourceJobsEnded,
  actorRun:coordinatorRun,actorCommit:commit,privateControlPersist,
  flushControl,loadState:async()=>{
   // Exception journals share the append sequence but do not move the saved
   // state pointer. Recover only a verified blocked-game exception suffix.
   const loaded=await loadExistingControlState({store,key,cohortRun,commit});
   sequence=loaded.sequence;return loaded.state;
  },
  acceptCompletedGames:async saved=>{for(const game of saved.games){
   if(game.gameId==='32629'){game.phase='blocked';game.reason='SG_EXISTING_INDEPENDENT_MONEY_ANOMALY_RETAINED';continue;}
   if(plans[game.gameId].adapter!=='native-nextgen-v1'){game.phase='blocked';game.reason='SG_OWN_BUSINESS_ADAPTER_REVIEW_REQUIRED';continue;}
   const proof=policy.completedBusinessReceipts[game.gameId];if(!proof)continue;
   const nativeKey='rolling-merge:'+queueHash([profile.payload.queueId,game.gameId,game.campaignId]);
   const native=(await store.get('journal',nativeKey+':complete'))?.value,stateRow=(await store.get('state',nativeKey))?.value;
   assert(native&&queueHash(native)===proof.nativeReceiptHash&&stable(stateRow?.result)===stable(native)&&stateRow.status==='complete'
    &&native.count===300000&&native.fullReadback&&native.independentlyVerified,'SG_AG_EXISTING_COMPLETED_NATIVE_PROOF');
   const complete=await mongoOnce(()=>client.db('sg_capture_staging_v1').collection('business_delivery_v1').findOne({_id:proof.auditCompleteKey}));
   assert(complete?.immutable===true&&queueHash(complete)===proof.auditDocumentHash,'SG_AG_EXISTING_COMPLETED_BUSINESS_WHOLE');
   const value=complete.value??complete;
   assert(String(value.gameId)===game.gameId&&value.campaignCount===300000&&value.fullReadback&&value.independentlyVerified
    &&value.sourceProofHash===proof.nativeReceiptHash,'SG_AG_EXISTING_COMPLETED_FINAL_PROOF');
   game.phase='complete';
  }},
  currentRtp:async b=>{const sha=execFileSync('ssh',['-T','-i',process.env.SG_BUSINESS_SSH_KEY_FILE,'-o','IdentityAgent=none','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+process.env.SG_SSH_HOSTS_FILE,'-o','ConnectTimeout=10','sgdelivery@'+process.env.SG_SSH_HOST,String(b.gameId)],{encoding:'utf8',timeout:20000}).trim();assert(sha===b.rtpFileSha256,'SG_BUSINESS_CURRENT_RTP_CHANGED');},
  admission:{guard:async(phase,g)=>{await flushControl();await gameBudget.check(phase,g);await ordinaryGuard(phase,g);await gameBudget.check(phase,g);},assertCapturedEnding:async()=>{throw Error('SG_AG_SOURCE_PERMIT_REQUIRED');},
   originalCount:async g=>(await baseline(g)).count,originalDocuments:async g=>structuredClone((await baseline(g)).documents),
   // Resume is wired into the existing admit job, after its full ending and
   // immutable revision checks. A live source controller cannot start it.
   assertResumeBoundary:async()=>{throw Error('SG_AG_LIVE_SOURCE_CANNOT_RESUME');},dispatchRemaining:async()=>{throw Error('SG_AG_LIVE_SOURCE_CANNOT_DISPATCH');},
   finishCohort:async()=>{await flushControl();return persist(cohortRun+'-cohort-final',{state,originalAccountsAndProofsPreserved:true});}}
 };}});
 return {...control,async close(){try{parser.close();}finally{await client.close();}}};
 }catch(error){
  // Before a handle is returned, the caller cannot release these resources.
  // Preserve the original failure (and its driver provenance) on cleanup errors.
  try{parser?.close();}catch{}
  try{await client.close();}catch{}
  throw error;
 }
}
