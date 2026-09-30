import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,finish} from './demon-zero-test-fixture.mjs';
import {FreshStart} from './fresh-start.mjs';
import {PendingFirst} from './pending-first.mjs';
import {STAGE_KEY} from './demon-zero-stage.mjs';
import {receiptKey} from './durable-queue.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';

test('fresh workflow uses one20-worker job without resuming old owners',()=>{
 const workflow=fs.readFileSync('.github/workflows/trial-300k.yml','utf8');
 const job=workflow.split('  fresh-capture:')[1].split('  trial:')[0];
 assert(job.includes("inputs.role == 'fresh-short'"));assert(job.includes('SG_PENDING_FIRST_STAGE: fresh'));
 assert(job.includes('max-parallel: 20'));assert(!job.includes('needs: pending-resume'));
 const needs=workflow.split('  verify:')[1].match(/needs: \[([^\]]+)\]/)[1].split(',').map(x=>x.trim());
 assert.deepEqual(needs,['trial','pending-resume','pending-capture','fresh-capture','formal-capture']);
});
test('applied zero profile stays frozen and rejects the new nested runtime',()=>{
 const p=JSON.parse(fs.readFileSync('config/demon-zero-20260929.json','utf8'));
 assert.equal(hash(p),'0f5cd88157a487984f9deb5d736b5f7acae3aa02394af606738b3e071fc8e12f');
 assert.equal(p.pending,1);assert.deepEqual(p.freshStart,{originalPending:0,captureWorkers:20,perWorker:10,totalNew:200});
 const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
 assert.notDeepEqual(actual,p.adapterFiles);assert.notEqual(hash(actual),p.adapterHash);
 assert.equal(hash(JSON.parse(fs.readFileSync('config/demon-one-20260929.json','utf8'))),'7624f15c9bc09064b8a3b233f982115f44013f1f5b00c26c958f14151a75e64a');
});

test('last1706 recovery preserves246 and creates a distinct zero-original permission',async()=>{
 const f=await fixture(),r=await f.operator.recover();assert.equal(r.count,246);assert.equal(r.originalPendingPreserved,0);
 assert(f.snapshot().batches.every(x=>!x.value.pending));assert(f.docs.has('journal/fresh-start:'+r.proofHash));
 assert(!f.docs.has('journal/pending-first:'+r.proofHash));await assert.rejects(f.operator.recover());
});
test('446 with all five independent replacements and bonus2 permits formal',async()=>{
 const f=await fixture();await f.operator.recover();await finish(f);const r=await f.operator.validate();
 assert.equal(r.replacementAttemptsSettled,5);assert.equal(r.originalPendingSettled,0);await f.operator.formal();
});
test('missing natural bonus2 never promotes a finite short run',async()=>{
 const f=await fixture();await f.operator.recover();await finish(f,{feature:false});await assert.rejects(f.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);await assert.rejects(f.operator.formal());
});
for(const seq of [806,434,117,902,1706])test('reject old attempt replay '+seq,async()=>{
 const f=await fixture();await f.operator.recover();await finish(f);
 const a=[...f.docs.entries()].find(([k,v])=>k.includes(':abandoned:')&&v.value.pending?.sequence===seq)[1].value;
 const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,seq)).value;r.attempt=a.pending.attempt;f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate(),/REPLAYED/);
});
test('actual controller admission router requires fresh stage and complete immutable recovery',async()=>{
 const f=await fixture();await f.operator.recover();const runKey='capture-run:999:1';f.get('campaign').protocolValidation.runKey=runKey;
 const id={commitSha:f.operator.commit,shardId:7,sessionHash:f.get('pool:'+f.plan.trialId).workers[7].sessionHash};
 const args={store:f.operator.store,plan:f.plan,runKey,now:()=>f.now};
 for(const stage of [undefined,'capture','resume'])await assert.rejects(new PendingFirst({...args,stage}).admit(id,7),/FRESH_RUN_NOT_AUTHORIZED/);
 const gate=new PendingFirst({...args,stage:'fresh'});assert.deepEqual(await gate.admit(id,7),{stage:'fresh',limit:10});
 f.docs.delete('journal/'+STAGE_KEY+':complete');await assert.rejects(gate.admit(id,7),/FRESH_RECOVERY_NOT_COMPLETE/);
});
test('fresh admission binds identity, run and remaining ten-round quota',async()=>{
 const f=await fixture();await f.operator.recover();const runKey='capture-run:999:1';f.get('campaign').protocolValidation.runKey=runKey;
 const id={commitSha:f.operator.commit,shardId:7,sessionHash:f.get('pool:'+f.plan.trialId).workers[7].sessionHash};
 const gate=new FreshStart({store:f.operator.store,plan:f.plan,runKey,stage:'fresh',now:()=>f.now});
 await assert.rejects(gate.admit({...id,sessionHash:'changed'},7),/FRESH_POOL_CHANGED/);
 gate.runKey='capture-run:999:2';await assert.rejects(gate.admit(id,7),/FRESH_RUN_NOT_AUTHORIZED/);gate.runKey=runKey;
 const b=f.get('batch:'+f.plan.trialId+':18');b.journaled+=3;assert.equal((await gate.admit(id,7)).limit,7);
 b.journaled+=8;await assert.rejects(gate.admit(id,7),/FRESH_QUOTA_CHANGED/);
});
