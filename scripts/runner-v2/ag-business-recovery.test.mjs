import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {validateBusinessInventory,businessInventory,readBusinessNativePages} from './ag-rolling/sg-business-native-reader.mjs';
import {verifyValidationEndedActor,requireValidationEndedActor,verifyValidationRecoveryReadback} from './ag-rolling/sg-business-validation-recovery.mjs';
import {digest} from './ag-rolling/sg-business-delivery.mjs';import {stable} from './mongo-writer.mjs';
const b={gameId:'32442',trialId:'synthetic-own-trial'};
const row=(w,n)=>({_id:(w*15000+n).toString(16).padStart(64,'0'),trialId:b.trialId,gameId:32442,shardId:w,sequence:w*15000+n,contentHash:'a'.repeat(64)});
const rows=()=>Array.from({length:300000},(_,i)=>row(Math.floor(i/15000),i%15000+1));
test('own game inventory uses existing game index and keeps all twenty selected quotas',async()=>{
 const all=rows();let reads=0;
 const source={find(query,options){reads++;assert.deepEqual(query,{gameId:32442,trialId:b.trialId});assert.equal(options.hint,'rolling_game_count');assert.equal(options.sort,undefined);return {toArray:async()=>all};}};
 const inv=await businessInventory(source,b);assert.equal(reads,1);assert.equal(inv.length,20);assert(inv.every(a=>a.length===15000));
});
test('changed game, ID, content, worker or selected count refuses inventory',()=>{
 const all=rows();for(const edit of [a=>a.pop(),a=>a[0].gameId=32443,a=>a[0].trialId='other',a=>a[0].shardId=20,a=>a[0].contentHash='bad',a=>a[0]._id=a[1]._id,a=>a[0].sequence=a[1].sequence]){const bad=all.map(r=>({...r}));edit(bad);assert.throws(()=>validateBusinessInventory(bad,b));}
});
test('AG selected overage retains its genuine sequence and remains bound to its own worker',()=>{
 const all=rows();all[0].sequence=300001;assert.equal(validateBusinessInventory(all,b)[0][0].sequence,300001);
 all[0].sequence=300008;assert.throws(()=>validateBusinessInventory(all,b),/INVENTORY_IDENTITY/);
});
test('shuffled primary-key replies preserve full original AG worker and sorted ID hash',async()=>{
 const inv=validateBusinessInventory(rows().reverse(),b),expected=createHash('sha256');for(const a of inv)for(const r of a)expected.update(stable(r)+'\n');
 const by=new Map(inv.flat().map(r=>[r._id,r]));let reads=0,verified=0,visited=0;
 const source={find(query,options){reads++;assert.equal(options.hint,'_id_');assert(query._id.$in.length<=100);assert.equal(query.gameId,32442);assert.equal(query.trialId,b.trialId);return {toArray:async()=>query._id.$in.map(id=>by.get(id)).reverse()};}};
 const result=await readBusinessNativePages({source,binding:b,inventory:inv,verify:async a=>verified+=a.length,visit:async a=>visited+=a.length});
 assert.equal(reads,3000);assert.equal(verified,300000);assert.equal(visited,300000);assert.equal(result.recordsHash,expected.digest('hex'));
});
test('unknown point read and changed native content stop before visit and never retry',async()=>{
 const inv=validateBusinessInventory(rows(),b);let calls=0,visits=0;
 await assert.rejects(readBusinessNativePages({source:{find(){calls++;return {toArray:async()=>{throw Error('READ_UNKNOWN');}};}},binding:b,inventory:inv,verify:async()=>{},visit:async()=>visits++}),/READ_UNKNOWN/);assert.equal(calls,1);assert.equal(visits,0);
 await assert.rejects(readBusinessNativePages({source:{find(q){return {toArray:async()=>q._id.$in.map(id=>({...inv[0].find(r=>r._id===id),contentHash:'b'.repeat(64)}))};}},binding:b,inventory:inv,verify:async()=>{},visit:async()=>visits++}),/INVENTORY_CHANGED/);assert.equal(visits,0);
});
function ended(){const spec={previousRun:123,previousCommit:'a'.repeat(40),previousJob:456};const run={id:123,run_attempt:1,head_sha:spec.previousCommit,head_branch:'sg-business-delivery-20261005',repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml',event:'workflow_dispatch',status:'completed',conclusion:'failure'};const jobs={total_count:44,jobs:Array.from({length:44},(_,i)=>({id:456+i,run_id:123,status:'completed',conclusion:i?'skipped':'failure',name:i?'skipped-placeholder':'ag-rolling-business-delivery'}))};return {spec,run,jobs};}
test('validation recovery requires the exact ended old actor and full closed job inventory',()=>{
 const f=ended();assert(verifyValidationEndedActor(f.run,f.jobs,f.spec).allJobsEnded);
 for(const edit of [x=>x.run.status='in_progress',x=>x.run.head_sha='b'.repeat(40),x=>x.jobs.jobs[1].status='in_progress',x=>x.jobs.total_count=43,x=>x.jobs.jobs[1].conclusion='success',x=>x.jobs.jobs[0].id=999]){const bad=structuredClone(f);edit(bad);assert.throws(()=>verifyValidationEndedActor(bad.run,bad.jobs,bad.spec));}
});
test('unknown old actor inventory stops after one request without granting recovery',async()=>{
 let n=0;await assert.rejects(requireValidationEndedActor(ended().spec,'synthetic',async()=>{n++;throw Error('UNKNOWN');}),/UNKNOWN/);assert.equal(n,1);
});
function recovery(){const claim={_id:'game:32442:'+'a'.repeat(64),status:'validating',owner:'123:1:business',proofHash:'a'.repeat(64),at:'synthetic'};const originals=[{_id:'b'.repeat(24),rtp:[0,100],data:{synthetic:true}}];const backup={_id:claim._id+':backup:1',owner:claim.owner,documents:structuredClone(originals),documentsHash:digest(originals),immutable:true};const spec={schema:'sg-business-validation-recovery-v1',gameId:'32442',previousRun:123,previousOwner:claim.owner,proofHash:claim.proofHash,claimId:claim._id,claimHash:digest(claim),backupKey:backup._id,originalCount:1,originalHash:digest(originals)};return {spec,claim,backup,auditKeys:[claim._id,backup._id],originals,campaignCount:0,proofHash:claim.proofHash};}
test('only unchanged original backup and zero campaign writes or intents allow a separate recovery claim',()=>{
 const f=recovery();assert.equal(verifyValidationRecoveryReadback(f).previousWriteIntents,0);
 for(const edit of [x=>x.auditKeys.push(x.claim._id+':intent:unknown'),x=>x.campaignCount=1,x=>x.originals[0].rtp=[0,200],x=>x.claim.owner='other',x=>x.claim.status='validated',x=>x.backup.documents[0].data.synthetic=false,x=>x.backup.documentsHash='b'.repeat(64),x=>x.proofHash='c'.repeat(64)]){const bad=structuredClone(f);edit(bad);assert.throws(()=>verifyValidationRecoveryReadback(bad));}
 assert.deepEqual(f,recovery());
});
