import {ownTerminalFields} from './sg-own-terminal.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {captureCollector} from '../../trial/collector-loader.mjs';
import {heldBalanceFields,BALANCE_CONTRACT} from './sg-held-balance.mjs';
import {automaticFreeFields,AUTOMATIC_FREE_CONTRACT} from './sg-automatic-free.mjs';
import {terminalFields} from './sg-automatic-terminal.mjs';
import {businessDocument,verifyBusinessPage} from './sg-business-document.mjs';
import {assertCompleteBinding,deliverPage,verifyLegacyPage,digest,missingDocuments} from './sg-business-delivery.mjs';
import {businessInventory,readBusinessNativePages} from './sg-business-native-reader.mjs';
import {createNativePageVerificationCache} from './sg-native-page-verification-cache.mjs';

// This module receives the admitted per-game clients and memory credentials.
// Importing it performs no authentication, source request or business write.
// All actual database calls retain the existing Mongo collection interfaces.
export async function mongoOnce(operation){
 try{return await operation();}catch(error){
  // RunnerState rejects this exact local guard error before a write starts.
  // The page wrapper also includes that guard; do not turn a known deadline
  // into a fabricated native unknown. Existing unknowns (including a driver
  // failure with the same text) are never cleared or reclassified here.
  const guardDeadline=error.code==='RESOURCE_WAIT_DEADLINE'&&error.message==='RESOURCE_WAIT_DEADLINE';
  if(!guardDeadline&&!/^SG_[A-Z_]+$/.test(error.message??''))error.outcomeUnknown=true;
  throw error;
 }
}
export function immutableBusinessAudit({audit,owner,guard}){
 return async(id,value)=>{
  await guard('audit-before');
  assert(!await mongoOnce(()=>audit.findOne({_id:id})),'SG_AG_BUSINESS_EXISTING_INTENT_NO_REPLAY');
  const doc={_id:id,owner,...structuredClone(value),immutable:true};
  await mongoOnce(()=>audit.insertOne(doc));
  const saved=await mongoOnce(()=>audit.findOne({_id:id}));
  assert(stable(saved)===stable(doc),'SG_AG_BUSINESS_IMMUTABLE_FULL_READBACK');
  return saved;
 };
}
export async function verifyOrdinaryNativePage({records,plan,parser}){
 for(const record of records){
  const f=record.normalized;
  const js=record.raw.ownTerminalContract!==undefined?ownTerminalFields(plan,record.raw,f.typeMappingHash):record.raw.automaticTerminalContract!==undefined?terminalFields(plan,record.raw,f.typeMappingHash):record.raw.automaticFreeContract===AUTOMATIC_FREE_CONTRACT?automaticFreeFields(plan,record.raw,f.typeMappingHash):record.raw.balanceContract===BALANCE_CONTRACT?heldBalanceFields(plan,record.raw,f.typeMappingHash):captureCollector('nextgen').prepareNextgenRound(record.raw,{buy:f.buy,bonus:f.bonus,typeMappingHash:f.typeMappingHash});
  assert(stable(js)===stable(f),'SG_BUSINESS_NATIVE_JS_FIELDS');
 }
 const verified=await parser.verifyPage(plan,[...records].sort((a,b)=>a.sequence-b.sequence));
 assert(verified?.verified===true&&verified.count===records.length,'SG_AG_BUSINESS_INDEPENDENT_FULL_PAGE');
 return verified;
}
export async function deliverOrdinaryBusiness({client,ObjectId,parser,binding:b,plan,nativeState,nativeReceipt,expectedProof,expectedOriginalCount,owner,guard,currentRtp,assertWorkers,evidence,evidenceMode='private-full-ack',nativePageVerification}){
 assert(plan.adapter==='native-nextgen-v1'&&String(plan.gameId)===String(b.gameId)&&b.queueId===expectedProof.queueId,'SG_BUSINESS_ADAPTER_REVIEW_REQUIRED');
 assert(Number.isSafeInteger(expectedOriginalCount)&&expectedOriginalCount>=0&&typeof owner==='string','SG_AG_BUSINESS_OWN_ADMISSION_REQUIRED');
 assert(['private-full-ack','existing-immutable-audit'].includes(evidenceMode),'SG_AG_BUSINESS_EVIDENCE_MODE');
 if(evidenceMode==='private-full-ack')assert(typeof evidence?.writeAndReadback==='function'&&typeof evidence?.appendAndReadback==='function','SG_AG_BUSINESS_OWN_ADMISSION_REQUIRED');
 await guard('business-admission');await currentRtp(b);await assertWorkers();
 const proof=assertCompleteBinding(nativeState,nativeReceipt,b);
 assert(stable(proof)===stable(expectedProof),'SG_BUSINESS_PROOF_CHANGED');
 const staging=client.db('sg_capture_staging_v1'),audit=staging.collection('business_delivery_v1'),source=staging.collection('official_rounds'),pool=client.db(b.database).collection('simulate');
 const jsonDoc=d=>({...d,_id:String(d._id)}),dbDoc=d=>({...d,_id:new ObjectId(d._id)}),campaignId=`sg_${b.gameId}-${b.queueId}`,claimId='game:'+b.gameId+':'+digest(proof);
 const baselineQuery={'data.captureCampaignId':{$ne:campaignId}};
 const seal=immutableBusinessAudit({audit,owner,guard});
 assert(await mongoOnce(()=>source.countDocuments({trialId:b.trialId},{maxTimeMS:15000}))===300000,'SG_BUSINESS_SOURCE_COUNT');
 assert(await mongoOnce(()=>pool.countDocuments({'data.captureCampaignId':campaignId},{maxTimeMS:15000}))===0,'SG_AG_BUSINESS_EXISTING_TARGET_NO_REPLAY');
 assert(await mongoOnce(()=>pool.countDocuments(baselineQuery,{maxTimeMS:15000}))===expectedOriginalCount,'SG_AG_BUSINESS_ORIGINAL_COUNT_CHANGED');
 await seal(claimId,{status:'validating',proofHash:digest(proof),at:new Date().toISOString()});
 const beforeHash=createHash('sha256'),baseHash=createHash('sha256');let baseline=0,tagChanges=[],page=[];
 async function baselinePage(rows){
  await guard('original-full-backup');await verifyLegacyPage({documents:rows,plan,binding:b,parser});
  await seal(claimId+':backup:'+baseline,{documents:rows,documentsHash:digest(rows)});
  for(const d of rows){beforeHash.update(stable(d)+'\n');baseHash.update(stable({...d,rtp:b.rtp})+'\n');if(stable(d.rtp)!==stable(b.rtp))tagChanges.push(d);}
 }
 const originals=await mongoOnce(()=>pool.find(baselineQuery,{sort:{_id:1},batchSize:100,maxTimeMS:30000}).limit(expectedOriginalCount+1).toArray());
 assert(originals.length===expectedOriginalCount,'SG_AG_BUSINESS_ORIGINAL_COUNT_CHANGED');
 for(const row of originals){assert(row._id instanceof ObjectId,'SG_BUSINESS_LEGACY_ID');page.push(jsonDoc(row));baseline++;if(page.length===100){await baselinePage(page);page=[];}}
 if(page.length)await baselinePage(page);
 const originalBeforeHash=beforeHash.digest('hex'),baselineHash=baseHash.digest('hex');
 await guard('indexed-source-inventory');const inventory=await mongoOnce(()=>businessInventory(source,b));
 const pageVerification=nativePageVerification??createNativePageVerificationCache({verify:(plan,records)=>verifyOrdinaryNativePage({records,plan,parser})});
 assert(typeof pageVerification.verify==='function','SG_NATIVE_VERIFICATION_CACHE');
 const eachNativePage=visit=>mongoOnce(()=>readBusinessNativePages({source,binding:b,inventory,verify:async records=>{await guard('source-full-independent-validation');return pageVerification.verify(plan,records);},visit}));
 const verified=await eachNativePage(async()=>{});assert(verified.recordsHash===proof.recordsHash,'SG_BUSINESS_FULL_SOURCE_HASH');
 await seal(claimId+':validated',{baselineCount:baseline,baselineHash,originalBeforeHash,sourceCount:verified.count,sourceHash:verified.recordsHash,originalDataFullyValidated:true});
 await currentRtp(b);await assertWorkers();
 for(const d of tagChanges){
  await guard('original-rtp-cas');const actual=jsonDoc(await mongoOnce(()=>pool.findOne({_id:new ObjectId(d._id)})));
  assert(stable(actual)===stable(d),'SG_BUSINESS_BASELINE_CHANGED');
  await seal(claimId+':rtp-intent:'+d._id,{before:d,afterRtp:b.rtp});
  const res=await mongoOnce(()=>pool.updateOne({_id:new ObjectId(d._id),rtp:d.rtp},{$set:{rtp:b.rtp}}));
  assert(res.matchedCount===1&&res.modifiedCount===1,'SG_BUSINESS_RTP_CAS');
  const saved=jsonDoc(await mongoOnce(()=>pool.findOne({_id:new ObjectId(d._id)})));
  assert(stable(saved)===stable({...d,rtp:b.rtp}),'SG_BUSINESS_RTP_READBACK');
  await seal(claimId+':rtp-complete:'+d._id,{readbackHash:digest(saved)});
 }
 const sink={plan,read:async hex=>{await guard('business-target-read');return (await mongoOnce(()=>pool.find({_id:{$in:hex.map(x=>new ObjectId(x))}},{maxTimeMS:15000}).toArray())).map(jsonDoc);},insert:async docs=>{await guard('business-single-insert');await mongoOnce(()=>pool.insertMany(docs.map(dbDoc),{ordered:true}));}};
 const batchAudit={begin:(id,value)=>seal(claimId+':intent:'+id,value),end:(id,value)=>seal(claimId+':ack:'+id,value)};let inserted=0;
 const written=await eachNativePage(async(records,worker,n)=>{const result=await deliverPage({records,binding:b,campaignId,parser,sink,audit:batchAudit,batchId:worker+':'+n});inserted+=result.inserted;
  const full={owner,claimId,phase:'delivered-page',worker,end:n,source:records,target:result.documents};
  if(evidenceMode==='private-full-ack'){const ack=await evidence.appendAndReadback(full);assert(ack?.fullReadback&&ack.durable&&ack.privateOnly&&ack.valueHash===digest(full),'SG_AG_BUSINESS_PAGE_PRIVATE_FULL_ACK');}
 });
 assert(written.recordsHash===proof.recordsHash,'SG_BUSINESS_FULL_SOURCE_HASH');
 let targetCount=0;const targetHash=createHash('sha256');
 const readback=await eachNativePage(async records=>{
  const expected=records.map(r=>businessDocument(r,b,campaignId)),saved=await sink.read(expected.map(d=>d._id));assert(missingDocuments(expected,saved).length===0,'SG_AG_BUSINESS_TARGET_MISSING');
  const by=new Map(saved.map(d=>[d._id,d])),ordered=expected.map(d=>by.get(d._id));verifyBusinessPage(records,ordered,b,campaignId);
  for(const d of ordered)targetHash.update(stable(d)+'\n');targetCount+=ordered.length;
 });
 assert(readback.recordsHash===proof.recordsHash,'SG_BUSINESS_FULL_SOURCE_HASH');
 const afterHash=createHash('sha256'),after=await mongoOnce(()=>pool.find(baselineQuery,{sort:{_id:1},batchSize:100,maxTimeMS:30000}).limit(expectedOriginalCount+1).toArray());
 for(const d of after)afterHash.update(stable(jsonDoc(d))+'\n');
 assert(after.length===baseline&&afterHash.digest('hex')===baselineHash&&targetCount===300000,'SG_BUSINESS_BASELINE_FULL_READBACK');
 await guard('final-business-count-and-source-receipt');await assertWorkers();await currentRtp(b);
 assert(await mongoOnce(()=>pool.countDocuments({'data.captureCampaignId':campaignId},{maxTimeMS:15000}))===300000&&await mongoOnce(()=>pool.countDocuments({},{maxTimeMS:15000}))===300000+baseline,'SG_BUSINESS_FINAL_COUNT');
 assert(stable(await mongoOnce(()=>staging.collection('capture_journal_v2').findOne({_id:nativeReceipt._id})))===stable(nativeReceipt),'SG_BUSINESS_IMMUTABLE_SOURCE_CHANGED');
 const done={schema:'sg-ag-final-business-complete-v1',gameId:String(b.gameId),queueId:b.queueId,database:b.database,businessCount:300000+baseline,campaignCount:300000,originalCount:baseline,captureBaseline:0,retagged:tagChanges.length,inserted,sourceProofHash:digest(proof),sourceRecordsHash:proof.recordsHash,businessRecordsHash:targetHash.digest('hex'),originalBeforeHash,baselineHash,fullReadback:true,independentlyVerified:true,originalUnchanged:true,sourceRequests:0};
 await seal(claimId+':complete',{value:done});
 if(evidenceMode==='private-full-ack'){
  const ack=await evidence.writeAndReadback({owner,claimId,complete:done,originalsBefore:originals.map(jsonDoc),originalsAfter:after.map(jsonDoc),sourceReceipt:nativeReceipt,inventory});
  assert(ack?.fullReadback===true&&ack.durable===true&&ack.privateOnly===true&&ack.valueHash===digest(done),'SG_AG_BUSINESS_PRIVATE_EVIDENCE_ACK');
 }
 return done;
}
