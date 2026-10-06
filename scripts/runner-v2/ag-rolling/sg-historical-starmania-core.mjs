import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {candidateDocument} from './sg-historical-starmania-document.mjs';
import {missingDocuments,digest} from './sg-business-delivery.mjs';

export const HISTORICAL_DELIVERY_VERSION='sg-historical-starmania-delivery-core-v1';
export function assertOwnHistoricalAdmission(m){
 assert(m.version===HISTORICAL_DELIVERY_VERSION&&m.gameId===32737&&m.runtimeGameId===33137
  &&m.trialId==='sg_r1_20260928_32737'&&m.database==='sg_starmania'&&m.nativeTarget===299850
  &&m.originalCount===150&&m.expectedTotalBusinessCount===300000&&m.campaignId==='sg_round_one_20260928'
  &&m.stateKey==='primary/pool:'+m.trialId&&m.receiptKey==='primary/game-audit:'+m.trialId
  &&!Object.hasOwn(m.binding,'queueId'),'HISTORICAL_OWN_ADMISSION_IDENTITY');
 assert(m.closedActualExitCode===0&&m.fullContentVerified===299850&&m.inMemoryConverted===299850
  &&m.recordsHash==='a2fba403c702f75d2b131bad911d8208c48309522eb5416cd5d55e0dd9a59c08'
  &&m.planHash==='07d271ee3180179cf4348bf6faeb37d3332fee7c0e55ca1b1abfeb9efb6d9921'
  &&digest(m.plan)===m.planHash&&m.originalRecordsHash==='7419af804b4eddfaf8b88c565c71dcfd25193bb28f63e67a7fac26267ba30870'
  &&m.fullSourceContentHash==='a9674d0713c07957a881e8a7976053e2cb437a08ae637f507c2c0fa07df4576d'
  &&m.candidateBusinessHash==='4713c0d3f8d7f9c37a3d769949f39c5c0236eddacd6b8649bb06864bd3b3679e'
  &&m.binding.typeMappingHash==='4dc566eed7cbb61ced4335f1a3be916506b9ea0957fd3ecdd65dd139647dd51d'
  &&m.rtpFileSha256==='9339f7fe9b36236d6f8d5271e67612497c48b3681e4b03050e7d61562cb8bc4b'
  &&stable(m.actualHistoricalShardCounts)===stable([28383,43743,5941,41081,4900,14952,5019,28332,14489,6448,37820,4565,4935,10976,12677,6633,12405,5100,5638,5813])
  &&m.actualHistoricalShardCounts.length===20&&m.actualHistoricalShardCounts.reduce((a,b)=>a+b,0)===299850
  &&m.typeCounts.none===296804&&m.typeCounts.freeGame===3046,'HISTORICAL_OWN_FULL_PROOF_REQUIRED');
 assert(['closedReviewSha256','actualExitProofSha256','fullProofSha256','stateDocumentHash','receiptDocumentHash','receiptValueHash','rtpFileSha256']
  .every(k=>/^[a-f0-9]{64}$/.test(m[k]))&&m.sourceAllowance===0&&m.newCaptureCredit===0
  &&m.productionScopeGranted===false&&m.ownLinuxPermissionGranted===false&&m.actorImplemented===false,'HISTORICAL_CORE_PREPARATION_ONLY');
 assert(m.binding.gameId===m.gameId&&m.binding.runtimeGameId===m.runtimeGameId&&m.binding.trialId===m.trialId
  &&m.binding.database===m.database&&m.binding.rtpFileSha256===m.rtpFileSha256,'HISTORICAL_OWN_BINDING');
 return m;
}

export function assertOwnHistoricalSourceEvidence({state,receipt,manifest:m,now}){
 assertOwnHistoricalAdmission(m);
 assert(Number.isSafeInteger(now)&&state?._id===m.stateKey&&receipt?._id===m.receiptKey
  &&digest(state)===m.stateDocumentHash&&digest(receipt)===m.receiptDocumentHash&&digest(receipt.value)===m.receiptValueHash,
  'HISTORICAL_IMMUTABLE_SOURCE_CHANGED');
 const v=state.value,p=receipt.value;
 assert(v.confirmed===m.nativeTarget&&v.nextSequence===m.nativeTarget+1&&v.failure===null
  &&Object.keys(v.workers).length===20&&Object.values(v.workers).every(x=>x.activeBatch===null&&x.leaseUntil<=now)
  &&p.trialId===m.trialId&&p.planHash===m.planHash&&p.recordsHash===m.recordsHash&&p.fullReadback===m.nativeTarget,
  'HISTORICAL_SOURCE_NOT_COMPLETE_AND_CLOSED');
 return structuredClone(p);
}

// Continuous historical sequence, not the rolling worker-ID selection order.
// This receives a read-only source interface and requires independent full-page verification.
export async function readOwnHistoricalPages({source,manifest:m,verify,visit=async()=>{},originalIds=[]}){
 assert(typeof verify==='function'&&typeof visit==='function','HISTORICAL_PAGE_VERIFIER_REQUIRED');
 const seen=new Set(),targets=new Set(originalIds),shards=Array(20).fill(0),types={};
 assert(targets.size===originalIds.length,'HISTORICAL_ORIGINAL_ID_COLLISION');
 const hash=createHash('sha256');let count=0;
 while(count<m.nativeTarget){
  const rows=await source.find({trialId:m.trialId,sequence:{$gt:count}},
   {sort:{sequence:1},batchSize:100,maxTimeMS:15000}).limit(Math.min(100,m.nativeTarget-count)).toArray();
  assert(rows.length>0&&rows.length<=100,'HISTORICAL_INCOMPLETE_SOURCE_PAGE');
  for(let i=0;i<rows.length;i++){
   const r=rows[i];assert(r.trialId===m.trialId&&r.gameId===m.gameId&&r.runtimeGameId===m.runtimeGameId
    &&r.sequence===count+i+1&&r.sequence<=m.nativeTarget&&/^[a-f0-9]{64}$/.test(r._id)&&/^[a-f0-9]{64}$/.test(r.contentHash)
    &&!seen.has(r._id)&&Number.isSafeInteger(r.shardId)&&r.shardId>=0&&r.shardId<20
    &&Number.isSafeInteger(r.batchId)&&r.batchId>0,'HISTORICAL_SEQUENCE_IDENTITY_OR_DUPLICATE');
   seen.add(r._id);const id=r._id.slice(0,24);assert(!targets.has(id),'HISTORICAL_TARGET_ID_COLLISION');targets.add(id);
  }
  await verify(rows); // Caller must execute actual JS fields plus independent Python verify/contentHash.
  for(const r of rows){hash.update(stable([r._id,r.contentHash])+'\n');shards[r.shardId]++;
   const kind=r.normalized.primaryBonusKind;assert(['none','freeGame'].includes(kind),'HISTORICAL_UNKNOWN_TYPE');types[kind]=(types[kind]??0)+1;}
  await visit(rows,{firstSequence:count+1,lastSequence:count+rows.length});count+=rows.length;
 }
 const extra=await source.find({trialId:m.trialId,sequence:{$gt:count}},{sort:{sequence:1},maxTimeMS:15000}).limit(1).toArray();
 assert(extra.length===0,'HISTORICAL_SOURCE_OVER_TARGET');
 const recordsHash=hash.digest('hex');
 assert(count===m.nativeTarget&&seen.size===count&&recordsHash===m.recordsHash
  &&stable(shards)===stable(m.actualHistoricalShardCounts)&&stable(types)===stable(m.typeCounts),'HISTORICAL_FULL_SOURCE_HASH_COUNTS');
 return {count,recordsHash,actualHistoricalShardCounts:shards,typeCounts:types};
}

export async function deliverOwnHistoricalPage({records,manifest:m,independentConvert,sink,audit,batchId}){
 assert(records.length>0&&records.length<=100&&typeof independentConvert==='function'
  &&typeof audit.existing==='function'&&typeof audit.begin==='function'&&typeof audit.end==='function','HISTORICAL_DURABLE_PAGE_CONFIGURATION');
 const expected=records.map(r=>candidateDocument(r,m.binding,m.plan));
 assert(new Set(expected.map(d=>d._id)).size===expected.length,'HISTORICAL_TARGET_ID_COLLISION');
 const py=await independentConvert(records);
 assert(stable(expected)===stable(py),'HISTORICAL_BUSINESS_JS_PY_MISMATCH');
 // A durable prior intent or ack blocks every replay, even when target rows happen to exist.
 assert(!await audit.existing(batchId),'HISTORICAL_EXISTING_INTENT_REVIEW_REQUIRED');
 const before=await sink.read(expected.map(d=>d._id)),missing=missingDocuments(expected,before);
 if(missing.length){
  await audit.begin(batchId,{documents:missing,hash:digest(missing),historicalCampaignId:m.campaignId,
   firstSequence:records[0].sequence,lastSequence:records.at(-1).sequence});
  await sink.insert(missing); // One attempt; unknown acknowledgements propagate, never retry.
 }
 const saved=await sink.read(expected.map(d=>d._id));
 assert(missingDocuments(expected,saved).length===0,'HISTORICAL_FULL_PAGE_READBACK_REQUIRED');
 if(missing.length)await audit.end(batchId,{hash:digest(missing),readbackVerified:true});
 return {count:expected.length,inserted:missing.length,documents:saved};
}

export async function verifyOwnHistoricalTargetPage({records,manifest:m,independentConvert,read}){
 const expected=records.map(r=>candidateDocument(r,m.binding,m.plan));
 assert(stable(expected)===stable(await independentConvert(records)),'HISTORICAL_BUSINESS_JS_PY_MISMATCH');
 const saved=await read(expected.map(d=>d._id));
 assert(missingDocuments(expected,saved).length===0,'HISTORICAL_FULL_TARGET_READBACK_REQUIRED');
 const by=new Map(saved.map(d=>[d._id,d]));return expected.map(d=>by.get(d._id));
}
