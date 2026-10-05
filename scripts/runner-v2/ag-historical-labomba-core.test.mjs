import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {assertOwnHistoricalAdmission,assertOwnHistoricalSourceEvidence,readOwnHistoricalPages,deliverOwnHistoricalPage,verifyOwnHistoricalTargetPage} from './ag-rolling/sg-historical-labomba-core.mjs';
import {candidateDocument} from './ag-rolling/sg-historical-labomba-document.mjs';import {stable} from './mongo-writer.mjs';
const manifest=JSON.parse(fs.readFileSync('config/ag-historical-labomba-manifest.json'));
// Synthetic immutable metadata: no private native documents or sessions are in fixtures.
const state={_id:manifest.stateKey,value:{confirmed:299850,nextSequence:299851,failure:null,workers:Object.fromEntries(Array.from({length:20},(_,i)=>[i,{activeBatch:null,leaseUntil:0}]))}};
const receipt={_id:manifest.receiptKey,value:{trialId:manifest.trialId,planHash:manifest.planHash,recordsHash:manifest.recordsHash,fullReadback:299850}};
const hash=v=>createHash('sha256').update(stable(v)).digest('hex');
const proofManifest={...manifest,stateDocumentHash:hash(state),receiptDocumentHash:hash(receipt),receiptValueHash:hash(receipt.value)};
const own={states:[state],proofs:[receipt]};
function record(sequence=1,shardId=18,batchId=21){
 const f={sourceKey:manifest.plan.sourceKey,typeMappingHash:manifest.binding.typeMappingHash,roundFieldsVersion:'sg-round-fields-v1',bet:1.25,mul:2,buy:0,bonus:0,primaryBonusKind:'none',money:{startBalanceRaw:10000,endBalanceRaw:10125,betRaw:125,totalWinRaw:250}};
 return {_id:sequence.toString(16).padStart(24,'0')+'a'.repeat(40),contentHash:'b'.repeat(64),fixtureOnly:false,trialId:manifest.trialId,gameId:32723,runtimeGameId:33123,sequence,batchId,shardId,
 raw:{fixtureOnly:false,sourceKey:manifest.plan.sourceKey,steps:[{msgId:'BET',responseBalance:10125}]},normalized:f,...Object.fromEntries(['bet','mul','buy','bonus','roundFieldsVersion'].map(k=>[k,f[k]]))};
}
const convert=async rs=>rs.map(r=>candidateDocument(r,manifest.binding,manifest.plan));
function memorySink(){const rows=new Map(),calls=[];return {rows,calls,read:async ids=>{calls.push('read');return ids.filter(id=>rows.has(id)).map(id=>structuredClone(rows.get(id)));},insert:async docs=>{calls.push('insert');for(const d of docs)rows.set(d._id,structuredClone(d));}};}
function memoryAudit(){const entries=new Map(),calls=[];return {entries,calls,existing:async id=>entries.has(id),begin:async(id,v)=>{calls.push('intent');assert(!entries.has(id));entries.set(id,v);},end:async(id,v)=>{calls.push('ack');entries.set(id+':ack',v);}};}

test('only the own actual closed historical proof is admitted; the prepared proof grants no execution permission',()=>{
 assert.equal(assertOwnHistoricalAdmission(manifest),manifest);
 for(const change of [m=>m.gameId=32731,m=>m.nativeTarget=300000,m=>m.campaignId='rolling',m=>m.binding.queueId='rolling',m=>m.closedActualExitCode=null,m=>m.recordsHash='a'.repeat(64),m=>m.originalCount=100,m=>m.typeCounts.freeGame++,m=>m.actorImplemented=true]){
  const m=structuredClone(manifest);change(m);assert.throws(()=>assertOwnHistoricalAdmission(m));
 }
});

test('exact immutable pool and receipt are required before any source read or write',()=>{
 const options={state:own.states[0],receipt:own.proofs[0],manifest:proofManifest,now:Date.now()};
 assert.deepEqual(assertOwnHistoricalSourceEvidence(options),own.proofs[0].value);
 for(const mutate of [s=>s.value.confirmed--,s=>s.value.nextSequence++,s=>s.value.failure='failed',s=>Object.values(s.value.workers)[0].activeBatch=1]){
  const state=structuredClone(options.state);mutate(state);assert.throws(()=>assertOwnHistoricalSourceEvidence({...options,state}));
 }
 const receipt=structuredClone(options.receipt);receipt.value.recordsHash='a'.repeat(64);assert.throws(()=>assertOwnHistoricalSourceEvidence({...options,receipt}));
});

test('continuous source order retains irregular historical shards and batches across a page boundary',async()=>{
 const rows=Array.from({length:101},(_,i)=>record(i+1,i%3===0?18:2,i<77?21:25));
 const shards=Array(20).fill(0);for(const r of rows)shards[r.shardId]++;
 const h=createHash('sha256');for(const r of rows)h.update(stable([r._id,r.contentHash])+'\n');
 const m={...manifest,nativeTarget:101,recordsHash:h.digest('hex'),actualHistoricalShardCounts:shards,typeCounts:{none:101}};
 const reads=[],visits=[];const source={find(q,o){reads.push({q,o});return {limit(n){return {async toArray(){return rows.filter(r=>r.sequence>q.sequence.$gt).slice(0,n);}};}};}};
 const result=await readOwnHistoricalPages({source,manifest:m,verify:async p=>assert(p.every(r=>r.batchId===21||r.batchId===25)),visit:async(p,v)=>visits.push(v)});
 assert.equal(result.count,101);assert.deepEqual(visits,[{firstSequence:1,lastSequence:100},{firstSequence:101,lastSequence:101}]);
 assert.deepEqual(reads.map(x=>x.q.sequence.$gt),[0,100,101]);assert(reads.every(x=>x.o.sort.sequence===1));assert.deepEqual(result.actualHistoricalShardCounts,shards);
});

test('gaps, duplicate target IDs, incomplete pages and unknown reads stop without retry',async()=>{
 for(const rows of [[record(2)],[record(1),{...record(2),_id:record(1)._id}],[]]){
  let reads=0,visited=0;const source={find(){reads++;return {limit(){return {toArray:async()=>rows};}};}};
  await assert.rejects(readOwnHistoricalPages({source,manifest,verify:async()=>{},visit:async()=>visited++}));assert.equal(reads,1);assert.equal(visited,0);
 }
 let reads=0;const source={find(){reads++;throw Error('UNKNOWN_READ');}};
 await assert.rejects(readOwnHistoricalPages({source,manifest,verify:async()=>{}}),/UNKNOWN_READ/);assert.equal(reads,1);
});

test('own JS/Python mismatch and existing durable intent block insertion',async()=>{
 const records=[record()],sink=memorySink(),audit=memoryAudit();
 await assert.rejects(deliverOwnHistoricalPage({records,manifest,independentConvert:async()=>[],sink,audit,batchId:'own:1'}),/HISTORICAL_BUSINESS_JS_PY_MISMATCH/);
 assert.equal(sink.calls.length,0);assert.equal(audit.calls.length,0);
 audit.entries.set('own:1',{immutable:true});await assert.rejects(deliverOwnHistoricalPage({records,manifest,independentConvert:convert,sink,audit,batchId:'own:1'}),/HISTORICAL_EXISTING_INTENT_REVIEW_REQUIRED/);
 assert.equal(sink.calls.length,0);assert.equal(audit.calls.length,0);
});

test('intent precedes a single insertion and complete readback; no rolling identity is fabricated',async()=>{
 const records=[record()],sink=memorySink(),audit=memoryAudit(),order=[];
 const oldBegin=audit.begin,oldInsert=sink.insert;audit.begin=async(...a)=>{order.push('intent');await oldBegin(...a);};sink.insert=async(...a)=>{order.push('insert');await oldInsert(...a);};
 const r=await deliverOwnHistoricalPage({records,manifest,independentConvert:convert,sink,audit,batchId:'own:1'});
 assert.deepEqual(order,['intent','insert']);assert.equal(r.inserted,1);assert.deepEqual(audit.calls,['intent','ack']);
 const d=r.documents[0];assert.equal(d.data.captureSourceCampaignId,manifest.campaignId);assert.equal(d.data.captureNativeShardId,18);assert.equal(d.data.captureBatchId,21);
 assert(!Object.hasOwn(d.data,'captureCampaignId')&&!Object.hasOwn(d.data,'captureWorkerIndex'));
 assert.deepEqual(await verifyOwnHistoricalTargetPage({records,manifest,independentConvert:convert,read:sink.read}),r.documents);
 d.data.captureBatchId=22;sink.rows.set(d._id,d);await assert.rejects(verifyOwnHistoricalTargetPage({records,manifest,independentConvert:convert,read:sink.read}),/SG_BUSINESS_CONTENT_CONFLICT/);
});

test('unknown insert acknowledgement preserves the intent and prevents any replay',async()=>{
 const records=[record()],sink=memorySink(),audit=memoryAudit();let inserts=0;
 sink.insert=async()=>{inserts++;throw Error('UNKNOWN_WRITE_ACK');};
 const args={records,manifest,independentConvert:convert,sink,audit,batchId:'own:1'};
 await assert.rejects(deliverOwnHistoricalPage(args),/UNKNOWN_WRITE_ACK/);assert.equal(inserts,1);assert.deepEqual(audit.calls,['intent']);
 await assert.rejects(deliverOwnHistoricalPage(args),/HISTORICAL_EXISTING_INTENT_REVIEW_REQUIRED/);assert.equal(inserts,1);assert.equal(audit.entries.size,1);
});
