import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,finish} from './demon-one-test-fixture.mjs';
import {receiptKey} from './durable-queue.mjs';
import {STAGE_KEY,stageBoundary} from './demon-one-stage.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewQueueAncestor,ANCESTOR} from './demon-one-ancestor.mjs';

test('new902 profile binds runtime and preserves every applied queue profile',()=>{
 const p=JSON.parse(fs.readFileSync('config/demon-one-20260929.json','utf8'));
 assert.equal(p.schema,'sg-demon-one-v1');assert.equal(p.pending,2);
 assert.deepEqual(p.pendingFirst,{resumeWorkers:[7],captureWorkers:20,newBetsBeforeOriginalSettlement:false});
 const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
 assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
 assert.equal(hash(JSON.parse(fs.readFileSync('config/demon-queue-20260929.json','utf8'))),ANCESTOR.profileHash);
 assert.equal(hash(JSON.parse(fs.readFileSync('config/demon-two-20260929.json','utf8'))),'78a54d7aca62c78de8b02227664ceee1e7752b403de1cae078e109db8b70908e');
});

test('completed ancestor cannot hide changed history or old partial recovery',async()=>{
 for(const key of [ANCESTOR.receipt,ANCESTOR.receipt+':complete',ANCESTOR.prefix+':proof']){
  const f=await fixture();f.docs.get('journal/'+key).value.corrupted=true;
  if(key.endsWith(':proof'))f.docs.get('journal/'+key).value.proof.commit='0'.repeat(40);
  await assert.rejects(reviewQueueAncestor(f.operator));
 }
 const f=await fixture();f.docs.set('journal/demon-two:demon-two-36524060044:records:1',{_id:'primary/demon-two:demon-two-36524060044:records:1',version:0,value:{partial:true}});
 await assert.rejects(reviewQueueAncestor(f.operator),/OLD_RECOVERY_HAS_WRITES/);
});
test('exact902 recovery backs up246, preserves1706 and grants one original owner',async()=>{
 const f=await fixture(),before=structuredClone(f.snapshot()),r=await f.operator.recover();
 assert.equal(r.count,246);assert.equal(r.originalPendingPreserved,1);assert.equal(r.sourceRequests,0);
 for(const {value:b} of before.batches)assert.deepEqual(f.get('batch:'+f.plan.trialId+':'+b.id).pending,b.id===10?null:b.pending);
 assert.deepEqual(f.docs.get('journal/pending-first:'+r.proofHash).value.entries.map(x=>x.worker),[7]);
 assert(f.docs.has('journal/'+STAGE_KEY+':complete'));await assert.rejects(f.operator.recover());
});
test('446 verified records with four independent replacements and real protocol feature gate permit formal',async()=>{
 const f=await fixture();await f.operator.recover();await finish(f);const v=await f.operator.validate();
 assert.equal(v.replacementAttemptsSettled,4);assert.equal(v.originalPendingSettled,1);await f.operator.formal();
});
test('446 without new natural bonus2 never permits formal',async()=>{
 const f=await fixture();await f.operator.recover();await finish(f,{feature:false});await assert.rejects(f.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);await assert.rejects(f.operator.formal());
});
for(const seq of [806,434,117,902])test('reject independent replacement replay '+seq,async()=>{
 const f=await fixture();await f.operator.recover();await finish(f);
 const archive=[...f.docs.entries()].find(([k,v])=>k.includes(':abandoned:')&&v.value.pending?.sequence===seq)[1].value;
 const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,seq)).value;r.attempt=archive.pending.attempt;f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate(),/REPLAYED/);
});
test('unknown902 and changed1706 cannot be archived as the known refusal',async()=>{
 for(const seq of [902,1706]){const f=await fixture();const b=f.snapshot().batches.find(x=>x.value.pending?.sequence===seq).value;b.pending.awaiting={msgId:'FREE_GAME'};await assert.rejects(f.operator.recover());assert(!f.docs.has('journal/'+STAGE_KEY));}
});
for(const kind of ['job','lease'])test(kind+' blocks before any new incident receipt',async()=>{
 const f=await fixture();kind==='job'?f.block():f.occupy();await assert.rejects(f.operator.recover());assert(!f.docs.has('journal/'+STAGE_KEY));
});
for(const point of ['stage','backup'])test('old job after '+point+' prevents batch mutation',async()=>{
 const f=await fixture(),before=structuredClone(f.snapshot()),create=f.operator.store.create.bind(f.operator.store);
 f.operator.store.create=async(c,k,...args)=>{const v=await create(c,k,...args);if(k===(point==='stage'?STAGE_KEY:f.operator.prefix+':backup-complete'))f.block();return v;};
 await assert.rejects(f.operator.recover(),/OLD_JOB_EXISTS/);assert.deepEqual(f.snapshot(),before);
});
test('receipt-only interruption does not authorize blind replay or another run',async()=>{
 const f=await fixture(),before=structuredClone(f.snapshot()),create=f.operator.store.create.bind(f.operator.store);
 f.operator.store.create=async(c,k,...args)=>{assert(k!==f.operator.prefix+':proof','INJECTED_FAILURE');return create(c,k,...args);};
 await assert.rejects(f.operator.recover(),/INJECTED_FAILURE/);assert.deepEqual(f.snapshot(),before);
 f.operator.store.create=create;await assert.rejects(f.operator.recover(),/STAGE_ALREADY_STARTED/);
 f.operator.recovering=true;f.operator.run='888888:1';await assert.rejects(stageBoundary(f.operator),/STAGE_OWNER_CHANGED/);
});
