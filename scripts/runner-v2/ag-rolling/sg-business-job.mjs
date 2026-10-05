import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {analyzer} from '../analyzer.mjs';
import {stable} from '../mongo-writer.mjs';
import {captureCollector} from '../../trial/collector-loader.mjs';
import {heldBalanceFields,BALANCE_CONTRACT} from './sg-held-balance.mjs';
import {automaticFreeFields,AUTOMATIC_FREE_CONTRACT} from './sg-automatic-free.mjs';
import {terminalFields} from './sg-automatic-terminal.mjs';
import {businessDocument,verifyBusinessPage} from './sg-business-document.mjs';
import {assertCompleteBinding,deliverPage,verifyLegacyPage,digest,missingDocuments} from './sg-business-delivery.mjs';
import {taskKey} from './sg-task-store.mjs';
import {stagingLeaseKey} from './sg-staging-store.mjs';
import {requireBusinessLinux} from './sg-business-linux.mjs';
import {businessInventory,readBusinessNativePages} from './sg-business-native-reader.mjs';
import {requireValidationEndedActor,verifyValidationRecoveryReadback} from './sg-business-validation-recovery.mjs';
const require=createRequire(import.meta.url);
const {MongoClient,ObjectId}=require('../../../collector/node_modules/mongodb');
require('../../../collector/node_modules/ts-node').register({project:'collector/tsconfig.json',transpileOnly:true});
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_OS==='Linux'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'
 &&process.env.GITHUB_REPOSITORY==='zyzuoyang/sg-capture-runner'&&process.env.GITHUB_REF==='refs/heads/sg-business-delivery-20261005','SG_BUSINESS_REVIEWED_ACTOR');
assert(process.env.SG_BUSINESS_MONGO_PASSWORD&&process.env.SG_BUSINESS_GAME_IDS,'SG_BUSINESS_CONFIGURATION');
const ids=process.env.SG_BUSINESS_GAME_IDS.split(',');assert(ids.length<=21&&new Set(ids).size===ids.length&&ids.every(x=>/^32\d{3}$/.test(x)),'SG_BUSINESS_GAMES');
const bindings=JSON.parse(fs.readFileSync('config/ag-business-bindings.json')).bindings;
const plans=JSON.parse(fs.readFileSync('config/ag-rolling-plans.json')).plans;
const policy=JSON.parse(fs.readFileSync('config/ag-business-delivery-policy.json'));
assert(ids.every(id=>bindings[id]&&policy.completeProofs[id]),'SG_BUSINESS_UNREVIEWED_GAME');
const linuxProof=await requireBusinessLinux({id:process.env.SG_BUSINESS_LINUX_RUN,commit:process.env.GITHUB_SHA,token:process.env.GH_TOKEN});
const recoveryPolicy=JSON.parse(fs.readFileSync('config/ag-business-validation-recovery.json')).games;
const endedRecovery={};for(const id of ids)if(recoveryPolicy[id])endedRecovery[id]=await requireValidationEndedActor(recoveryPolicy[id],process.env.GH_TOKEN);
const client=new MongoClient('mongodb://52.87.94.113:27017',{auth:{username:'sg_simulate_delivery_v1',password:process.env.SG_BUSINESS_MONGO_PASSWORD},authSource:'admin',authMechanism:'SCRAM-SHA-1',retryReads:false,retryWrites:false,maxPoolSize:2,connectTimeoutMS:10000,serverSelectionTimeoutMS:10000,socketTimeoutMS:60000});
const parser=analyzer();const owner=process.env.GITHUB_RUN_ID+':'+process.env.GITHUB_RUN_ATTEMPT+':business';
const report={schema:'sg-business-delivery-run-v1',run:owner,commit:process.env.GITHUB_SHA,linuxProof,games:[],sourceRequests:0,captureMetadataWrites:0};
const jsonDoc=d=>({...d,_id:String(d._id)}),dbDoc=d=>({...d,_id:new ObjectId(d._id)});
async function verifyNative(records,plan){
 for(const r of records){
  const f=r.normalized;
  const js=r.raw.automaticTerminalContract!==undefined?terminalFields(plan,r.raw,f.typeMappingHash):r.raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeFields(plan,r.raw,f.typeMappingHash):r.raw.balanceContract===BALANCE_CONTRACT?heldBalanceFields(plan,r.raw,f.typeMappingHash):captureCollector('nextgen').prepareNextgenRound(r.raw,{buy:f.buy,bonus:f.bonus,typeMappingHash:f.typeMappingHash});
  assert(stable(js)===stable(f),'SG_BUSINESS_NATIVE_JS_FIELDS');
 }
 await parser.verifyPage(plan,[...records].sort((a,b)=>a.sequence-b.sequence));
}
export async function eachNativePage(source,b,plan,inventory,visit){
 return readBusinessNativePages({source,binding:b,inventory,verify:records=>verifyNative(records,plan),visit});
}
async function currentRtp(b){
 const sha=execFileSync('ssh',['-T','-i',process.env.SG_BUSINESS_SSH_KEY_FILE,'-o','IdentityAgent=none','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+process.env.SG_SSH_HOSTS_FILE,'-o','ConnectTimeout=10','sgdelivery@'+process.env.SG_SSH_HOST,String(b.gameId)],{encoding:'utf8',timeout:20000}).trim();
 assert(sha===b.rtpFileSha256,'SG_BUSINESS_CURRENT_RTP_CHANGED');
}
async function endedWorkers(staging,b){
 const game=policy.completeProofs[String(b.gameId)].sourceGame;assert(game.gameId===String(b.gameId)&&game.campaignId===`sg_${b.gameId}-${b.queueId}`&&game.baseline===0);
 const taskKeys=Array.from({length:20},(_,i)=>'primary/'+taskKey(b.queueId,game,'worker:'+(i+1)));
 const tasks=await staging.collection('capture_state_v2').find({_id:{$in:taskKeys}},{maxTimeMS:15000}).toArray();
 assert(tasks.length===20&&tasks.every(d=>d.value.status==='success'&&d.value.proof?.fullReadback&&d.value.proof?.independentlyVerified&&d.value.proof?.pending===0&&d.value.proof?.unknownRequests===0&&d.value.proof?.activeLeases===0),'SG_BUSINESS_WORKERS_NOT_VERIFIED');
 const leaseKeys=Array.from({length:20},(_,i)=>'primary/'+stagingLeaseKey(b.queueId,game,'worker',i+1));
 const leases=await staging.collection('capture_state_v2').find({_id:{$in:leaseKeys}},{maxTimeMS:15000}).toArray();
 assert(leases.every(d=>d.value.expiresAt<=Date.now()),'SG_BUSINESS_LIVE_WORKER_LEASE');
}
try{
 await client.connect();const staging=client.db('sg_capture_staging_v1'),audit=staging.collection('business_delivery_v1'),source=staging.collection('official_rounds');
 for(const id of ids){
  let phase='configuration-and-source-proof';
  try{
   const b=bindings[id],plan=plans[id];assert(plan.adapter==='native-nextgen-v1','SG_BUSINESS_ADAPTER_REVIEW_REQUIRED');await currentRtp(b);
   const campaignId=`sg_${id}-${b.queueId}`,key='rolling-merge:'+digest([b.queueId,id,campaignId]);
   const state=await staging.collection('capture_state_v2').findOne({_id:'primary/'+key}),receipt=await staging.collection('capture_journal_v2').findOne({_id:'primary/'+key+':complete'});
   const proof=assertCompleteBinding(state,receipt,b);assert(digest(proof)===policy.completeProofs[id].receiptHash&&proof.recordsHash===policy.completeProofs[id].recordsHash,'SG_BUSINESS_PROOF_CHANGED');
   await endedWorkers(staging,b);
   assert(await source.countDocuments({trialId:b.trialId},{maxTimeMS:15000})===300000,'SG_BUSINESS_SOURCE_COUNT');
   phase='business-claim-and-ended-validation-review';
   const pool=client.db(b.database).collection('simulate'),originalClaimId='game:'+id+':'+digest(proof);
   let claimId=originalClaimId,recoveryReadback;
   const previousClaim=await audit.findOne({_id:originalClaimId});
   if(previousClaim){
    const spec=recoveryPolicy[id];assert(spec&&endedRecovery[id]?.allJobsEnded,'SG_BUSINESS_EXISTING_ACTOR_REVIEW_REQUIRED');
    const ownAudit=await audit.find({_id:{$gte:originalClaimId,$lt:originalClaimId+'\uffff'}},{projection:{_id:1},hint:'_id_',maxTimeMS:15000}).limit(4).toArray();
    const backup=await audit.findOne({_id:spec.backupKey});
    const originals=(await pool.find({'data.captureCampaignId':{$ne:campaignId}},{sort:{_id:1},maxTimeMS:15000}).limit(101).toArray()).map(jsonDoc);
    const campaignCount=await pool.countDocuments({'data.captureCampaignId':campaignId},{maxTimeMS:15000});
    recoveryReadback=verifyValidationRecoveryReadback({spec,claim:previousClaim,backup,auditKeys:ownAudit.map(d=>d._id),originals,campaignCount,proofHash:digest(proof)});
    claimId=originalClaimId+':recovery:'+owner;
   }else assert(!recoveryPolicy[id],'SG_BUSINESS_RECOVERY_CLAIM_MISSING');
   assert(!await audit.findOne({_id:claimId}),'SG_BUSINESS_EXISTING_ACTOR_REVIEW_REQUIRED');
   await audit.insertOne({_id:claimId,status:'validating',owner,proofHash:digest(proof),at:new Date().toISOString(),...(recoveryReadback?{validationRecovery:recoveryReadback,previousClaimPreserved:true}:{} )});
   phase='original-full-validation-and-backup';
   const baselineQuery={'data.captureCampaignId':{$ne:campaignId}},baselineCount=await pool.countDocuments(baselineQuery,{maxTimeMS:15000});
   const baseHash=createHash('sha256');let baseline=0,tagChanges=[];
   const cursor=pool.find(baselineQuery,{sort:{_id:1},batchSize:100,maxTimeMS:30000});let page=[];
   async function baselinePage(rows){
    await verifyLegacyPage({documents:rows,plan,binding:b,parser});
    await audit.insertOne({_id:claimId+':backup:'+baseline,owner,documents:rows,documentsHash:digest(rows),immutable:true});
    for(const d of rows){baseHash.update(stable({...d,rtp:b.rtp})+'\n');if(stable(d.rtp)!==stable(b.rtp))tagChanges.push(d);}
   }
   for await(const row of cursor){assert(row._id instanceof ObjectId,'SG_BUSINESS_LEGACY_ID');page.push(jsonDoc(row));baseline++;if(page.length===100){await baselinePage(page);page=[];}}
   if(page.length)await baselinePage(page);assert(baseline===baselineCount);const baselineHash=baseHash.digest('hex');
   phase='indexed-source-inventory';const inventory=await businessInventory(source,b);
   phase='source-full-independent-validation';
   const verified=await eachNativePage(source,b,plan,inventory,async()=>{});assert(verified.recordsHash===proof.recordsHash,'SG_BUSINESS_FULL_SOURCE_HASH');
   await audit.insertOne({_id:claimId+':validated',owner,baselineCount,baselineHash,sourceCount:verified.count,sourceHash:verified.recordsHash,originalDataFullyValidated:true,immutable:true});
   await currentRtp(b);
   await endedWorkers(staging,b);
   phase='original-rtp-cas-and-readback';for(const d of tagChanges){
    const actual=jsonDoc(await pool.findOne({_id:new ObjectId(d._id)}));assert(stable(actual)===stable(d),'SG_BUSINESS_BASELINE_CHANGED');
    await audit.insertOne({_id:claimId+':rtp-intent:'+d._id,owner,before:d,afterRtp:b.rtp,immutable:true});
    const res=await pool.updateOne({_id:new ObjectId(d._id),rtp:d.rtp},{$set:{rtp:b.rtp}});assert(res.matchedCount===1&&res.modifiedCount===1,'SG_BUSINESS_RTP_CAS');
    const saved=jsonDoc(await pool.findOne({_id:new ObjectId(d._id)}));assert(stable(saved)===stable({...d,rtp:b.rtp}),'SG_BUSINESS_RTP_READBACK');
    await audit.insertOne({_id:claimId+':rtp-complete:'+d._id,owner,readbackHash:digest(saved),immutable:true});
   }
   let inserted=0;
   const sink={plan,read:async hex=>(await pool.find({_id:{$in:hex.map(x=>new ObjectId(x))}},{maxTimeMS:15000}).toArray()).map(jsonDoc),insert:async docs=>{await pool.insertMany(docs.map(dbDoc),{ordered:true});}};
   const batchAudit={begin:async(id,v)=>audit.insertOne({_id:claimId+':intent:'+id,owner,...v,immutable:true}),end:async(id,v)=>audit.insertOne({_id:claimId+':ack:'+id,owner,...v,immutable:true})};
   phase='business-page-intent-write-and-readback';
   const written=await eachNativePage(source,b,plan,inventory,async(records,worker,n)=>{const r=await deliverPage({records,binding:b,campaignId,parser,sink,audit:batchAudit,batchId:worker+':'+n});inserted+=r.inserted;if(n===15000)console.log(JSON.stringify({gameId:id,verifiedAndWritten:(worker+1)*15000,sourceRequests:0}));});
   assert(written.recordsHash===proof.recordsHash);
   // Independent full reread in the same AG selection order precedes completion.
   phase='full-source-target-and-original-readback';let targetCount=0;const targetHash=createHash('sha256');
   await eachNativePage(source,b,plan,inventory,async records=>{const expected=records.map(r=>businessDocument(r,b,campaignId));const saved=await sink.read(expected.map(d=>d._id));assert(missingDocuments(expected,saved).length===0);const by=new Map(saved.map(d=>[d._id,d]));const ordered=expected.map(d=>by.get(d._id));verifyBusinessPage(records,ordered,b,campaignId);for(const d of ordered)targetHash.update(stable(d)+'\n');targetCount+=ordered.length;});
   const afterHash=createHash('sha256');let afterCount=0;
   for await(const row of pool.find(baselineQuery,{sort:{_id:1},batchSize:100,maxTimeMS:30000})){afterHash.update(stable(jsonDoc(row))+'\n');afterCount++;}
   assert(afterCount===baselineCount&&afterHash.digest('hex')===baselineHash&&targetCount===300000,'SG_BUSINESS_BASELINE_FULL_READBACK');
   assert(await pool.countDocuments({'data.captureCampaignId':campaignId},{maxTimeMS:15000})===300000&&await pool.countDocuments({},{maxTimeMS:15000})===300000+baselineCount,'SG_BUSINESS_FINAL_COUNT');
   const actualReceipt=await staging.collection('capture_journal_v2').findOne({_id:receipt._id});assert(stable(actualReceipt)===stable(receipt),'SG_BUSINESS_IMMUTABLE_SOURCE_CHANGED');
   const done={gameId:id,database:b.database,businessCount:300000+baselineCount,campaignCount:300000,existingCount:baselineCount,retagged:tagChanges.length,inserted,sourceProofHash:digest(proof),sourceRecordsHash:proof.recordsHash,businessRecordsHash:targetHash.digest('hex'),baselineHash,fullReadback:true,independentlyVerified:true,sourceRequests:0};
   await audit.insertOne({_id:claimId+':complete',owner,value:done,immutable:true});assert(stable((await audit.findOne({_id:claimId+':complete'})).value)===stable(done));report.games.push({...done,status:'complete'});console.log(JSON.stringify({...done,status:'complete'}));
  }catch(e){report.games.push({gameId:id,status:'stopped-review-required',phase,reason:/^[A-Z_]+$/.test(e.message??'')?e.message:'BUSINESS_IO_OR_VALIDATION_STOP_NO_RETRY',...(Number.isInteger(e.code)?{databaseErrorCode:e.code}:{})});console.log(JSON.stringify(report.games.at(-1)));}
 }
}finally{parser.close();await client.close();fs.mkdirSync('business-evidence',{recursive:true});fs.writeFileSync('business-evidence/result.json',JSON.stringify(report,null,2)+'\n');}
assert(report.games.every(g=>g.status==='complete'),'SG_BUSINESS_DELIVERY_INCOMPLETE_REVIEW_REQUIRED');
