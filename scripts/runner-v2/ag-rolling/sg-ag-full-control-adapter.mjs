import assert from 'node:assert/strict';
import {createOriginalAgFullControl} from './ag-original-full-control.mjs';
import {workerSummary,quotas} from './ag-core.mjs';
import {stable} from '../mongo-writer.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';

// This is an I/O adapter for the unedited AG controller declarations, not a new
// scheduling loop. No CLI, credentials, network client or production grant is
// created here. Actual deployment still needs its own reviewed entry and Linux.
export function createSgAgFullControlAdapter({state,cohortRun,commit,queueId,store,io,now=Date.now}){
 assert(state?.version===1&&state.queueId===queueId&&/^\d+:1$/.test(cohortRun)&&/^[a-f0-9]{40}$/.test(commit),'SG_AG_CONTROL_IDENTITY');
 assert(state.runId===Number(cohortRun.split(':')[0]),'SG_AG_CONTROL_RUN');
 for(const name of ['guard','readJobs','readRun','persist','verifyPrefix','ensureNative','deliverBusiness','countBusiness','inspectBusiness','readBusinessReceipt','inspectPriorOperation','finishGame','close','assertResumeBoundary','resetEndedTask','dispatchRemaining','finishCohort','sealSettlement','ackSettlement'])assert(typeof io?.[name]==='function','SG_AG_CONTROL_IO_REQUIRED:'+name);
 const games=new Map(state.games.map(g=>[g.dbName,g]));assert(games.size===state.games.length&&new Set(state.games.map(g=>g.gameId)).size===state.games.length,'SG_AG_CONTROL_GAMES');
 const prefixProofs=new Map(),businessReceipts=new Map();
 function own(g){assert(games.get(g.dbName)===g&&g.campaignId&&Number.isSafeInteger(g.baseline)&&g.baseline>=0&&g.baseline<300000,'SG_AG_CONTROL_GAME');return g;}
 async function taskRows(g){own(g);const ids=[...['canary:1','canary:2'],...Array.from({length:20},(_,i)=>'worker:'+(i+1))],rows=await store.getMany('state',ids.map(id=>taskKey(queueId,g,id)));
  assert(rows.length===22&&rows.every((r,i)=>r?.value._id===ids[i]&&r.value.queueId===queueId&&r.value.campaignId===g.campaignId),'SG_AG_CONTROL_TASKS');workerSummary(rows.map(r=>r.value),queueId,g.campaignId);return rows;
 }
 const projectOwner=owner=>{const m=new RegExp('^'+cohortRun.replace(':1','-1')+':([1-9]|1[0-9]|20):(canary|worker):([1-9]|1[0-9]|20)$').exec(owner??'');return m?state.runId+':'+m[1]+':'+m[2]+':'+m[3]:owner;};
 async function live(g,kind,index){const r=await store.get('state',stagingLeaseKey(queueId,g,kind,index));return r?.value.expiresAt>now()?1:0;}
 function db(g){own(g);return {game:g,collection(name){assert(['capture_queue','capture_locks','simulate'].includes(name),'SG_AG_CONTROL_COLLECTION');return {
  find(query){assert(name==='capture_queue'&&(Object.keys(query).length===0||query.queueId===queueId&&query.campaignId===g.campaignId),'SG_AG_CONTROL_QUERY');return {toArray:async()=>(await taskRows(g)).map(r=>({...structuredClone(r.value),...(r.value.owner?{owner:projectOwner(r.value.owner)}:{})}))};},
  async countDocuments(query){if(name==='capture_locks'){const m=new RegExp('^gh_'+g.campaignId+'_(canary|worker)_([1-9]|1[0-9]|20)$').exec(query._id);assert(m&&query.expiresAt.$gt instanceof Date,'SG_AG_CONTROL_LEASE_QUERY');return live(g,m[1],Number(m[2]));}
   assert(name==='simulate'&&(query['data.captureCampaignId']?.$ne===g.campaignId||query['data.captureCampaignId']===g.campaignId),'SG_AG_CONTROL_BASELINE_QUERY');await io.guard('baseline',g);
   // AG countDocuments is a fresh count, not another full source/target audit.
   // Original rows are verified by delivery and inspectTarget below; a count
   // alone can never authorize cleanup or mark the game complete.
   const v=await io.countBusiness(g);assert(Number.isSafeInteger(v.captureBaseline)&&v.captureBaseline>=0&&Number.isSafeInteger(v.campaignCount)&&v.campaignCount>=0,'SG_AG_CONTROL_BUSINESS_COUNT');return query['data.captureCampaignId']===g.campaignId?v.campaignCount:v.captureBaseline;
  },
  async updateOne(query,update){assert(name==='capture_queue'&&query.queueId===queueId&&query.campaignId===g.campaignId,'SG_AG_CONTROL_SETTLE_QUERY');await io.guard('settle-ended-node',g);
   const key=taskKey(queueId,g,query._id),before=await store.get('state',key),row=before?.value;assert(row&&row.status===query.status&&(!query.owner||projectOwner(row.owner)===query.owner),'SG_AG_CONTROL_SETTLE_CHANGED');
   const [kind,index]=row._id.split(':');assert(!await live(g,kind,Number(index)),'SG_AG_CONTROL_SETTLE_LIVE_LEASE');
   assert(['failed','blocked'].includes(update.$set.status)&&update.$set.exitCode===79,'SG_AG_CONTROL_SETTLE_STATUS');
   const value={...row,...update.$set,finishedAt:update.$set.finishedAt.toISOString(),updatedAt:new Date(now()).toISOString()};
   const intent=await io.sealSettlement(g,{before:structuredClone(row),after:structuredClone(value),cohortRun,commit});assert(intent?.fullReadback===true,'SG_AG_CONTROL_SETTLE_INTENT');
   await io.guard('settle-ended-node-cas',g);assert(!await live(g,kind,Number(index)),'SG_AG_CONTROL_SETTLE_LIVE_LEASE');
   assert(await store.cas('state',key,before,value),'SG_AG_CONTROL_SETTLE_RACE');assert(stable((await store.get('state',key))?.value)===stable(value),'SG_AG_CONTROL_SETTLE_READBACK');await io.ackSettlement(g,intent,value);return {matchedCount:1};
  },
  async updateMany(query){assert(name==='capture_queue'&&query.queueId===queueId&&query.campaignId===g.campaignId&&stable(query.status.$in)===stable(['running','failed','blocked']),'SG_AG_CONTROL_RESUME_QUERY');
   await io.assertResumeBoundary();for(const r of await taskRows(g))if(query.status.$in.includes(r.value.status))await io.resetEndedTask(g,r.value);return {acknowledged:true};
  }
 };}};}
 const client={db:name=>db(games.get(name)),close:()=>io.close()};
 function persist(file,value){const result=io.persist(file,structuredClone(value));assert(!result?.then&&result?.fullReadback===true,'SG_AG_CONTROL_SYNC_DURABLE_STATE');}
 const gh={async get(url){await io.guard('github-read');if(url.endsWith('/jobs')){
   const v=await io.readJobs(cohortRun,commit);assert(v.run===cohortRun&&v.commit===commit&&v.at<=now()&&now()-v.at<=60000&&v.total_count===v.jobs.length&&v.jobs.length<100,'SG_AG_CONTROL_JOB_INVENTORY');
   const lanes=v.jobs.filter(j=>/^AG rolling lane ([1-9]|1[0-9]|20)$/.test(j.name));assert(lanes.length===20&&new Set(lanes.map(j=>j.name)).size===20,'SG_AG_CONTROL_JOB_LANES');
   return {data:{jobs:lanes.map(j=>({...j,name:j.name.replace('AG rolling lane ','滚动通道 ')}))}};
  }const v=await io.readRun(cohortRun,commit);assert(v.run===cohortRun&&v.commit===commit&&now()-v.at<=60000&&v.at<=now(),'SG_AG_CONTROL_RUN_READBACK');return {data:v};
 }};
 const runtime=createOriginalAgFullControl({fs:{existsSync:()=>false},credentialPath:'private-memory-credentials',read:()=>({}),mongo:async()=>client,load:()=>state,statePath:'own-control-state',save:persist,path:{join:(...p)=>p.join('/')},directory:'private-control-evidence',repository:'own-reviewed-cohort',secret:'own-cohort-lifecycle',githubClient:()=>gh,
  deleteRepositorySecret:()=>io.finishCohort(state),safeMessage:error=>{const code=error.code??error.message;return /^SG_[A-Z_]{1,100}$/.test(code??'')?code:'SG_AG_OWN_GAME_REVIEW_REQUIRED';},console:{log:()=>{},error:v=>io.recordException?.(JSON.parse(v))},
  async liveLeases(database){const rows=await taskRows(database.game),keys=rows.map(r=>{const [kind,index]=r.value._id.split(':');return stagingLeaseKey(queueId,database.game,kind,Number(index));});
   const leases=await store.getMany('state',keys);assert(leases.length===keys.length,'SG_AG_CONTROL_LEASE_INVENTORY');return leases.filter(r=>r?.value.expiresAt>now()).length;},
  async validateRows(database,g,index){await io.guard('full-prefix-validation',g);const row=(await taskRows(g)).find(r=>r.value._id==='worker:'+index).value;assert(!['running','pending'].includes(row.status),'SG_AG_CONTROL_ACTIVE_PREFIX');
   assert(!g.sgOutcomeUnknownRetained,'SG_AG_CONTROL_UNKNOWN_RETAINED_NO_REPLAY');
   let proof;try{proof=await io.verifyPrefix(g,index,row);}catch(error){if(error.outcomeUnknown===true){g.sgOutcomeUnknownRetained=true;persist('own-control-state',state);}throw error;}
   const quota=quotas(g.baseline)[index-1];assert(proof?.fullReadback&&proof.independentlyVerified&&proof.queueId===queueId&&proof.gameId===g.gameId&&proof.campaignId===g.campaignId&&proof.taskId===row._id&&proof.acceptedUnknownRequests===0&&Number.isSafeInteger(proof.count)&&proof.count>=0&&proof.count<=quota+7,'SG_AG_CONTROL_PREFIX_PROOF');
   if(row.status==='success')assert(row.proof?.fullReadback&&row.proof.independentlyVerified&&row.proof.recordsHash===proof.recordsHash&&row.proof.count===proof.count,'SG_AG_CONTROL_SUCCESS_PROOF_CHANGED');
   prefixProofs.set(g.gameId+':'+index,structuredClone(proof));return proof.count;
  },
  async mergeSelectedRows(database,g,selected,total){assert(!g.sgOutcomeUnknownRetained,'SG_AG_CONTROL_UNKNOWN_RETAINED_NO_REPLAY');await io.guard('per-game-final-delivery',g);const prior=await io.inspectPriorOperation(g);
   if(prior?.canStartOnce!==true){
    // An existing intent needs evidence-based recovery, never another insert.
    // Isolate it once; rescanning all 300000 rows every controller tick cannot
    // resolve that intent and only delays other independently eligible games.
    g.phase='blocked';g.reason='SG_AG_CONTROL_EXISTING_OPERATION_NO_REPLAY';g.sgExistingOperationRetained=true;persist('own-control-state',state);
    throw Error(g.reason);
   }
   const proofs=Array.from({length:20},(_,i)=>prefixProofs.get(g.gameId+':'+(i+1)));assert(proofs.every(Boolean),'SG_AG_CONTROL_FULL_INVENTORY');
   // Native full proof is an intermediate SG storage format. It cannot set the
   // AG game complete; the same per-game control call must reach simulate.
   try{const native=await io.ensureNative(g,{selected,total,proofs});assert(native?.fullReadback&&native.independentlyVerified&&native.count===total&&stable(native.selected)===stable(selected),'SG_AG_CONTROL_NATIVE_PROOF');
    const receipt=await io.deliverBusiness(g,native);assert(receipt?.gameId===g.gameId&&receipt.queueId===queueId&&receipt.fullReadback&&receipt.independentlyVerified&&receipt.campaignCount===total-g.baseline&&receipt.originalUnchanged&&receipt.businessCount===receipt.originalCount+receipt.campaignCount,'SG_AG_CONTROL_FINAL_BUSINESS_PROOF');businessReceipts.set(g.gameId,structuredClone(receipt));
   }catch(error){if(error.outcomeUnknown===true){g.sgOutcomeUnknownRetained=true;persist('own-control-state',state);}throw error;}
  },
  async inspectTarget(c,g){await io.guard('final-target-full-readback',g);const v=await io.inspectBusiness(g);assert(v.fullReadback&&v.originalUnchanged,'SG_AG_CONTROL_FINAL_TARGET');return {total:v.captureBaseline+v.campaignCount,campaign:v.campaignCount,invalid:v.invalid};},
  async cleanupGame(c,s,g){const receipt=businessReceipts.get(g.gameId)??await io.readBusinessReceipt(g);assert(receipt?.gameId===g.gameId&&receipt.fullReadback&&receipt.independentlyVerified&&receipt.originalUnchanged,'SG_AG_CONTROL_NO_CLEANUP_BEFORE_BUSINESS');await io.guard('per-game-finalize',g);const r=await io.finishGame(g,receipt);assert(r?.fullReadback&&r.originalEvidencePreserved,'SG_AG_CONTROL_FINALIZE_PROOF');g.phase='complete';persist('own-control-state',state);},
  assertNoRuns:()=>io.assertResumeBoundary(),dispatch:async(s)=>{await io.assertResumeBoundary();const remaining=s.games.filter(g=>g.phase==='ready');return io.dispatchRemaining(s,remaining);}
 });
 return {reconcile:runtime.reconcile,resume:runtime.resume,productionEntryPresent:false,controllerAlgorithmsChanged:0};
}
