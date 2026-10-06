import assert from 'node:assert/strict';
import {stable} from '../mongo-writer.mjs';
import {sourcePermit,readTasks} from './sg-queue-control.mjs';
import {cohortRepos,participantKey,inspectParticipant} from './sg-federation.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {quotas} from './ag-core.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {inspectStaging,resetEndedTask} from './sg-resume.mjs';
import {mergeGameWithVerifiedPrefixes} from './sg-ag-native-merge.mjs';
import {auditCompletedNativePrefixes} from './sg-ag-completed-prefix.mjs';
import {deliverOrdinaryBusiness,verifyOrdinaryNativePage,mongoOnce} from './sg-ag-ordinary-business.mjs';
import {assertCompleteBinding,digest,verifyLegacyPage,missingDocuments} from './sg-business-delivery.mjs';
import {businessInventory,readBusinessNativePages} from './sg-business-native-reader.mjs';
import {businessDocument,verifyBusinessPage} from './sg-business-document.mjs';
import {createHash} from 'node:crypto';

// RunnerState/gateway perform the original SG scoped metadata I/O. Business
// Mongo uses its original account independently; it never gains metadata CAS.
// The protected entry owns admission, SSH memory agents and evidence endpoints.
export function createProductionSgIo({profile,cohortRun,coordinatorRun,commit,repository,store,transport,parser,businessClient,ObjectId,bindings,plans,githubRead,admission,privateEvidence,privateControlPersist,currentRtp,now=Date.now}){
 const queueId=profile.payload.queueId,owner=cohortRun+':strict-ag-control',prefixes=new Map(),done=new Map(),completedAudits=new Map();
 assert(Object.values(cohortRepos).includes(repository)&&/^\d+:1$/.test(cohortRun),'SG_AG_PRODUCTION_IDENTITY');
 for(const method of ['guard','assertCapturedEnding','assertResumeBoundary','dispatchRemaining','finishCohort','originalCount','originalDocuments'])assert(typeof admission?.[method]==='function','SG_AG_PRODUCTION_ADMISSION_REQUIRED:'+method);
 assert(typeof githubRead==='function'&&typeof privateControlPersist==='function'&&typeof currentRtp==='function','SG_AG_PRODUCTION_PRIVATE_PORTS');
 const gameKey=g=>'rolling-merge:'+queueHash([queueId,g.gameId,g.campaignId]);
 const businessKey=(g,p)=>'game:'+g.gameId+':'+digest(p);
 async function guard(phase,g){
  if(g)assert(profile.payload.games.some(x=>x.gameId===g.gameId&&x.campaignId===g.campaignId&&x.dbName===g.dbName&&x.baseline===g.baseline),'SG_AG_PRODUCTION_GAME_SCOPE');
  await admission.guard(phase,g);await store.writable();
  const source=(await store.get('state','rolling-source'))?.value;
  if(source?.status==='running')await sourcePermit({profile,store,run:coordinatorRun,commit,repository:cohortRepos.primary,coordinatorRun});
  else await admission.assertCapturedEnding({source,profile,cohortRun,coordinatorRun,commit});
  const holds=await transport.request('global_holds');assert(holds.length===2&&holds.every(x=>x?.value.active===false),'SG_AG_GLOBAL_HOLD');
  const hello=await transport.request('hello');assert(hello.database==='sg_capture_staging_v1'&&hello.gatewaySha256===profile.nativeGatewayHash&&hello.accessManifestHash===profile.nativeManifestHash&&hello.rollingNamespace==='primary','SG_AG_PRODUCTION_NATIVE_BYTES');
  if(profile.federation){const participant=(await store.get('journal',participantKey(profile)))?.value;inspectParticipant({profile,receipt:participant,coordinatorRun,commit});}
 }
 async function nativeDocuments(g){return {state:await store.get('state',gameKey(g)),receipt:await store.get('journal',gameKey(g)+':complete')};}
 async function workers(g){const tasks=await readTasks({store,game:g,queueId}),rows=tasks.filter(t=>t._id.startsWith('worker:'));assert(rows.length===20&&rows.every(t=>!['pending','running'].includes(t.status)),'SG_AG_PRODUCTION_ACTIVE_WORKER');const leases=await store.getMany('state',Array.from({length:20},(_,i)=>stagingLeaseKey(queueId,g,'worker',i+1)));assert(leases.every(x=>!x||x.value.expiresAt<=now()),'SG_AG_PRODUCTION_LIVE_LEASE');return tasks;}
 async function readNativePrefix(g,index,row){
  await guard('full-prefix-validation',g);const docs=await nativeDocuments(g);
  if(docs.state?.value.status==='complete'){
   if(!completedAudits.has(g.gameId)){
    const tasks=await workers(g),proofs=await auditCompletedNativePrefixes({source:businessClient.db('sg_capture_staging_v1').collection('official_rounds'),store,game:g,queueId,plan:plans[g.gameId],binding:bindings[g.gameId],parser,tasks,state:docs.state,receipt:docs.receipt,guard:()=>guard('completed-native-full-prefix',g)});
    assert(stable((await nativeDocuments(g)).receipt)===stable(docs.receipt)&&stable(await workers(g))===stable(tasks),'SG_AG_PRODUCTION_PREFIX_CHANGED');completedAudits.set(g.gameId,proofs);
   }
   const proof=completedAudits.get(g.gameId)[index-1];assert(proof.taskHash===queueHash(row),'SG_AG_PRODUCTION_TASK_CHANGED');return proof;
  }
  const accepted=await inspectStaging({store,transport,game:g,queueId,kind:'worker',index,max:quotas(g.baseline)[index-1]+7,guard:()=>guard('accepted-prefix-page',g),verifyRecords:records=>verifyOrdinaryNativePage({records,plan:plans[g.gameId],parser})});
  const proof={...accepted,queueId,gameId:g.gameId,campaignId:g.campaignId,taskId:row._id,owner:row.owner,taskHash:queueHash(row),acceptedUnknownRequests:0,activeLeases:0};prefixes.set(g.gameId+':'+index,proof);return proof;
 }
 return {
  guard,
  async readRun(run,sha){assert(run===cohortRun&&sha===commit,'SG_AG_PRODUCTION_GH_SCOPE');const actor=await githubRead(`repos/${repository}/actions/runs/${run.split(':')[0]}`);assert(actor.id===Number(run.split(':')[0])&&actor.head_sha===commit&&actor.run_attempt===1&&actor.repository.full_name===repository&&actor.event==='workflow_dispatch'&&actor.path==='.github/workflows/trial-300k.yml','SG_AG_PRODUCTION_GH_IDENTITY');return {...actor,run,commit,at:now()};},
  async readJobs(run,sha){await this.readRun(run,sha);const jobs=await githubRead(`repos/${repository}/actions/runs/${run.split(':')[0]}/jobs?filter=all&per_page=100`);assert(jobs.total_count===jobs.jobs.length&&jobs.total_count<100,'SG_AG_PRODUCTION_GH_INVENTORY');return {...jobs,run,commit,at:now()};},
  persist:privateControlPersist,
  verifyPrefix:readNativePrefix,
  async ensureNative(g,{selected,total,proofs}){
   await guard('native-selection',g);await workers(g);
   const result=await mergeGameWithVerifiedPrefixes({store,transport,game:g,queueId,plan:plans[g.gameId],owner,cleanup:false,verifiedPrefixes:proofs,guard:()=>guard('native-selection-page',g),verifyRecords:records=>verifyOrdinaryNativePage({records,plan:plans[g.gameId],parser}),inspectBaseline:async()=>({verified:true,count:0})});
   assert(result.fullReadback&&result.independentlyVerified&&result.count===total&&stable(result.selected)===stable(selected),'SG_AG_PRODUCTION_NATIVE_SELECTION');return result;
  },
  async inspectPriorOperation(g){const {state,receipt}=await nativeDocuments(g);if(state?.value.status==='merging')return {canStartOnce:false};const p=receipt?.value;if(!p)return {canStartOnce:true};const key=businessKey(g,p),audit=businessClient.db('sg_capture_staging_v1').collection('business_delivery_v1');return {canStartOnce:!await mongoOnce(()=>audit.findOne({_id:key}))};},
  async deliverBusiness(g,native){const docs=await nativeDocuments(g),p=assertCompleteBinding(docs.state,docs.receipt,bindings[g.gameId]);assert(stable(p)===stable(native),'SG_AG_PRODUCTION_NATIVE_CHANGED');
   const receipt=await deliverOrdinaryBusiness({client:businessClient,ObjectId,parser,binding:bindings[g.gameId],plan:plans[g.gameId],nativeState:docs.state,nativeReceipt:docs.receipt,expectedProof:p,expectedOriginalCount:await admission.originalCount(g),owner,guard:phase=>guard(phase,g),currentRtp,assertWorkers:()=>workers(g),evidence:privateEvidence});done.set(g.gameId,receipt);return receipt;},
  async inspectBusiness(g){
   await guard('final-business-snapshot',g);const pool=businessClient.db(bindings[g.gameId].database).collection('simulate'),campaign=g.campaignId,originalCount=await admission.originalCount(g),campaignCount=await mongoOnce(()=>pool.countDocuments({'data.captureCampaignId':campaign},{maxTimeMS:15000})),all=await mongoOnce(()=>pool.countDocuments({},{maxTimeMS:15000}));
   assert(all===originalCount+campaignCount,'SG_AG_PRODUCTION_BUSINESS_COUNT');
   const final=done.get(g.gameId);assert(campaignCount===0||final?.fullReadback&&final.campaignCount===campaignCount,'SG_AG_PRODUCTION_NO_COMPLETE_WITHOUT_FULL_TARGET');
   const binding=bindings[g.gameId],plan=plans[g.gameId],jsonDoc=d=>({...d,_id:String(d._id)});
   const originals=(await mongoOnce(()=>pool.find({'data.captureCampaignId':{$ne:campaign}},{sort:{_id:1},maxTimeMS:15000}).limit(originalCount+1).toArray())).map(jsonDoc),expected=await admission.originalDocuments(g);
   assert(originals.length===originalCount&&expected.length===originalCount&&stable(originals)===stable(final?expected.map(d=>({...d,rtp:binding.rtp})):expected),'SG_AG_PRODUCTION_ORIGINAL_WHOLE_CHANGED');
   await verifyLegacyPage({documents:originals,plan,binding,parser});
   if(final){
    const source=businessClient.db('sg_capture_staging_v1').collection('official_rounds'),inventory=await mongoOnce(()=>businessInventory(source,binding)),hash=createHash('sha256');
    const full=await mongoOnce(()=>readBusinessNativePages({source,binding,inventory,verify:records=>verifyOrdinaryNativePage({records,plan,parser}),visit:async records=>{
     await guard('final-whole-target-page',g);const expected=records.map(r=>businessDocument(r,binding,campaign)),saved=(await mongoOnce(()=>pool.find({_id:{$in:expected.map(d=>new ObjectId(d._id))}},{maxTimeMS:15000}).toArray())).map(jsonDoc);
     assert(missingDocuments(expected,saved).length===0,'SG_AG_PRODUCTION_FINAL_TARGET_MISSING');const by=new Map(saved.map(d=>[d._id,d])),ordered=expected.map(d=>by.get(d._id));verifyBusinessPage(records,ordered,binding,campaign);for(const d of ordered)hash.update(stable(d)+'\n');
    }}));assert(full.recordsHash===final.sourceRecordsHash&&hash.digest('hex')===final.businessRecordsHash,'SG_AG_PRODUCTION_FINAL_WHOLE_HASH_CHANGED');
   }
   return {captureBaseline:0,campaignCount,fullReadback:true,originalUnchanged:true,invalid:0};
  },
  async readBusinessReceipt(g){const docs=await nativeDocuments(g);if(!docs.receipt)return null;const complete=await mongoOnce(()=>businessClient.db('sg_capture_staging_v1').collection('business_delivery_v1').findOne({_id:businessKey(g,docs.receipt.value)+':complete'}));return complete?.value;},
  async finishGame(g,receipt){await guard('final-business-receipt-seal',g);const key='rolling-final-business:'+queueHash([queueId,g.gameId,g.campaignId]);await store.create('journal',key,{receipt,originalEvidencePreserved:true},{immutable:true});assert(stable((await store.get('journal',key))?.value)===stable({receipt,originalEvidencePreserved:true}),'SG_AG_PRODUCTION_FINAL_RECEIPT_READBACK');return {fullReadback:true,originalEvidencePreserved:true};},
  async sealSettlement(g,value){await guard('settle-ended-intent',g);const key='rolling-node-settlement:'+queueHash([queueId,g.gameId,value]);await store.create('journal',key,value,{immutable:true});assert(stable((await store.get('journal',key))?.value)===stable(value),'SG_AG_PRODUCTION_SETTLEMENT_INTENT');return {key,fullReadback:true};},
  async ackSettlement(g,intent,value){await store.create('journal',intent.key+':complete',{value},{immutable:true});assert(stable((await store.get('journal',intent.key+':complete'))?.value)===stable({value}),'SG_AG_PRODUCTION_SETTLEMENT_ACK');},
  assertResumeBoundary:()=>admission.assertResumeBoundary(),
  async resetEndedTask(g,row){const ended=await admission.assertResumeBoundary();const [kind,index]=row._id.split(':');return resetEndedTask({store,transport,game:g,queueId,kind,index:Number(index),ended,guard:()=>guard('resume-prefix',g),verifyRecords:records=>verifyOrdinaryNativePage({records,plan:plans[g.gameId],parser})});},
  dispatchRemaining:(state,games)=>admission.dispatchRemaining(state,games),finishCohort:state=>admission.finishCohort(state),
  close:async()=>{},recordException:row=>{const result=privateControlPersist('own-exception-state',row);assert(!result?.then&&result?.fullReadback,'SG_AG_PRODUCTION_EXCEPTION_DURABLE_ACK');}
 };
}
