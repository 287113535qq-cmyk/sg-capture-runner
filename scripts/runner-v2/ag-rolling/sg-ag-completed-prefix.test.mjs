import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {stable} from '../mongo-writer.mjs';
import {queueHash} from './sg-queue-profile.mjs';
import {auditCompletedNativePrefixes,completedNativeWorkerProof,COMPLETED_NATIVE_PROOF} from './sg-ag-completed-prefix.mjs';
import {stagingPrefix} from './sg-staging-store.mjs';
import {sourceJournalKey} from './sg-source-journal.mjs';
const game={gameId:'32547',campaignId:'sg_32547-queue',baseline:0},queueId='queue';
const record=(worker,n)=>({_id:String(worker*15000+n).padStart(64,'0'),trialId:'own-trial',gameId:32547,shardId:worker,
 sequence:n<=15000?worker*15000+n:300000+worker*7+n-15000,contentHash:'c'.repeat(64),fixtureOnly:false,buy:0});
function task(index,count=15000){const owner='ended-own:'+index;return {_id:'worker:'+index,status:'success',owner,queueId,campaignId:game.campaignId,
 proof:{queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:'worker:'+index,owner,count,recordsHash:'a'.repeat(64),fullReadback:true,independentlyVerified:true,pending:0,unknownRequests:0,activeLeases:0}};}
function workerFixture(){const selected=Array.from({length:15000},(_,i)=>record(0,i+2)),retained=[{ordinal:700,record:record(0,1)}];
 return {selected,retained,task:task(1,15001),game,queueId,index:1,complete:{count:300000,recordsHash:'b'.repeat(64)}};}
test('completed native proof uses independently read canonical bytes and never claims the deleted insertion order was rehashed',()=>{
 const f=workerFixture(),before=stable(f),p=completedNativeWorkerProof(f);
 assert.equal(p.proofKind,COMPLETED_NATIVE_PROOF);assert.equal(p.count,15001);assert.equal(p.retainedExcessCount,1);
 assert.equal(p.originalPrefixRecordsHash,f.task.proof.recordsHash);assert.equal(p.originalTaskProofHash,queueHash(f.task.proof));
 assert.equal(p.originalPrefixHashRecomputed,false);assert.notEqual(p.recordsHash,f.task.proof.recordsHash);
 assert.equal(p.recordsHash,completedNativeWorkerProof({...f,selected:[...f.selected].reverse()}).recordsHash);assert.equal(stable(f),before);
});
test('retained bytes can have a staging ordinal different from prepared sequence without guessing their order',()=>{
 const f=workerFixture();assert.notEqual(f.retained[0].ordinal,f.retained[0].record.sequence);assert.equal(completedNativeWorkerProof(f).count,15001);
});
test('missing retained excess, duplicate sequences and mutated surviving native bytes fail closed',()=>{
 const a=workerFixture();assert.throws(()=>completedNativeWorkerProof({...a,retained:[]}),/RETAINED_EXCESS_COUNT/);
 const b=workerFixture();b.selected[0]={...b.selected[0],sequence:b.selected[1].sequence};assert.throws(()=>completedNativeWorkerProof(b),/DUPLICATE_ORDINAL/);
 const c=workerFixture();c.retained.push({ordinal:5,record:{...c.selected[0],buy:1}});assert.throws(()=>completedNativeWorkerProof(c),/RETAINED_NATIVE_CHANGED/);
});
test('old task proof identity, count, unknown requests and success status remain mandatory',()=>{
 for(const mutation of [f=>f.task.proof.gameId='other',f=>f.task.proof.count=14999,f=>f.task.proof.unknownRequests=1,f=>f.task.status='failed',f=>f.task.proof.owner='foreign']){
  const f=workerFixture();mutation(f);assert.throws(()=>completedNativeWorkerProof(f),/ORIGINAL_TASK_PROOF/);
 }
});
function fullFixture(){
 const tasks=Array.from({length:20},(_,i)=>task(i+1)),rows=Array.from({length:300000},(_,i)=>record(Math.floor(i/15000),i%15000+1));
 const by=new Map(rows.map(r=>[r._id,r])),h=createHash('sha256');for(const r of rows)h.update(stable(r)+'\n');
 const complete={schema:'sg-ag-rolling-complete-v1',queueId,gameId:game.gameId,campaignId:game.campaignId,trialId:'own-trial',count:300000,baseline:0,selected:Array(20).fill(15000),excessPreserved:0,recordsHash:h.digest('hex'),fullReadback:true,independentlyVerified:true};
 const key='primary/rolling-merge:'+queueHash([queueId,game.gameId,game.campaignId]),counts={verified:0,scans:0,writes:0};
 const args={source:{find(query,options){return {toArray:async()=>options.projection?rows:query._id.$in.map(id=>by.get(id))};}},store:{getMany:async()=>assert.fail('unexpected source journal read')},
  transport:{request:async(op,fields)=>{assert.equal(op,'scan');assert.equal(fields.collection,'journal');assert(fields.after.startsWith('primary/'+fields.key));counts.scans++;return [];}},
  game,queueId,plan:{},binding:{gameId:game.gameId,trialId:'own-trial',queueId},tasks,state:{_id:key,value:{status:'complete',result:complete}},receipt:{_id:key+':complete',version:0,value:complete},guard:async()=>{},
  verifyRecords:async records=>{counts.verified+=records.length;return {verified:true,count:records.length};}};
 return {args,rows,by,counts,complete};
}
test('full completed-native audit reads every selected byte, preserves historical proofs and requires the original whole receipt hash',async()=>{
 const f=fullFixture(),before=stable(f.args.tasks),proofs=await auditCompletedNativePrefixes(f.args);
 assert.equal(proofs.length,20);assert.equal(f.counts.verified,300000);assert.equal(f.counts.scans,20);assert.equal(stable(f.args.tasks),before);
 assert(proofs.every(p=>p.nativeReceiptHash===queueHash(f.complete)&&p.nativeRecordsHash===f.complete.recordsHash&&p.originalPrefixHashRecomputed===false));
 const last=f.rows.at(-1);f.by.set(last._id,{...last,rawMutation:true});
 await assert.rejects(auditCompletedNativePrefixes(f.args),/FULL_NATIVE_HASH_CHANGED/);
});
test('a mutable completion receipt or independent parser rejection cannot return any completed-native proof',async()=>{
 const f=fullFixture();f.args.receipt.version=1;await assert.rejects(auditCompletedNativePrefixes(f.args),/IMMUTABLE_RECEIPT/);assert.equal(f.counts.verified,0);
 f.args.receipt.version=0;f.args.verifyRecords=async()=>{throw Error('INDEPENDENT_REJECTED');};await assert.rejects(auditCompletedNativePrefixes(f.args),/INDEPENDENT_REJECTED/);
});
function addRetained(f){
 f.args.tasks[0].proof.count=15001;f.complete.excessPreserved=1;
 const prefix=stagingPrefix(queueId,game,'worker',1),owner=f.args.tasks[0].owner,sessionHash='f'.repeat(64),requestNo=1;
 const step={rollingSource:{sessionHash,requestNo}},raw={steps:[step]},r={...record(0,15001),_id:'f'.repeat(64),sourceSessionHash:sessionHash,raw};
 const row={_id:'primary/'+prefix+'0000000700',value:{queueId,gameId:game.gameId,campaignId:game.campaignId,taskId:'worker:1',owner,ordinal:700,record:r}};
 const context={queueId,game,kind:'worker',index:1,owner,sessionHash,requestNo},intent={gameId:game.gameId,queueId,kind:'worker',index:1,owner,sessionHash,requestNo,msgId:'BET',requestPayload:'synthetic'};
 const docs=new Map(['intent','response'].map(type=>{const key=sourceJournalKey({...context,type});return [key,{_id:'primary/'+key,value:type==='intent'?intent:{...intent,step}}];}));
 f.args.store.getMany=async(c,keys)=>{assert.equal(c,'journal');return keys.map(k=>docs.get(k));};
 f.args.transport.request=async(op,fields)=>{assert.equal(op,'scan');f.counts.scans++;return fields.key===prefix&&fields.after<row._id?[row]:[];};
 return {row,docs};
}
test('scoped retained scan validates the real staging ordinal and exact intent/response pair before native proof',async()=>{
 const f=fullFixture(),{row}=addRetained(f),proofs=await auditCompletedNativePrefixes(f.args);
 assert.equal(row.value.ordinal,700);assert.equal(row.value.record.sequence,300001);assert.equal(proofs[0].retainedExcessCount,1);
 assert.equal(f.counts.verified,300001);assert.equal(proofs[0].count,15001);
});
test('foreign retained key and missing source journal fail closed before any native proof returns',async()=>{
 const f=fullFixture(),{row,docs}=addRetained(f),originalKey=row._id;row._id='primary/zzforeign:0000000700';
 await assert.rejects(auditCompletedNativePrefixes(f.args),/RETAINED_EXCESS_CHANGED/);
 row._id=originalKey;docs.clear();await assert.rejects(auditCompletedNativePrefixes(f.args),/SOURCE_MISSING/);
});
test('receipt excess count is checked against all original worker proofs before reading native pages',async()=>{
 const f=fullFixture();f.complete.excessPreserved=1;await assert.rejects(auditCompletedNativePrefixes(f.args),/EXCESS_RECEIPT_CHANGED/);assert.equal(f.counts.verified,0);
});
