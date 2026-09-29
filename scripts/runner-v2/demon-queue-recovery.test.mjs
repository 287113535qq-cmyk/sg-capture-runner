import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,finish} from './demon-queue-test-fixture.mjs';
import {DemonQueueRecovery} from './demon-queue-recovery.mjs';
import {RECEIPT_KEY,NEW_PREFIX} from './supersession-receipt.mjs';
import {original} from './expired-run-review.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied queue profile stays frozen and binds its reviewed adapters',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-queue-20260929.json','utf8'));
  assert.equal(hash(p),'933af2a4689c4ea4be7aeabcee62ce0e5842896be12c98118c99c6c6a1b28689');
  const old=JSON.parse(fs.readFileSync('config/demon-two-20260929.json','utf8'));
  assert.equal(hash(old),original.profileHash);
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.equal(hash(actual),p.adapterHash);assert.deepEqual(actual,p.adapterFiles);
  for(const key of ['batches','recordsHash','archives','previousStageHash','pendingFirst','featureValidation'])assert.deepEqual(p[key],old[key]);
});
async function setup(){
  const f=await fixture();const now=original.expiresAt+600000;
  f.profile.createdAt=now;
  let oldStarted=false,leaseActive=false;
  f.operator=new DemonQueueRecovery({...f.operator,now:()=>now,run:'999999:1',
    githubIdle:async()=>assert(!oldStarted,'OLD_JOB_EXISTS'),
    checkLeases:async()=>assert(!leaseActive,'LEASE_ACTIVE')});
  return {...f,now,startOld:()=>{oldStarted=true;},occupyLease:()=>{leaseActive=true;}};
}
test('actual incident recovery writes receipt first, distinct backup, preserves246 and two originals',async()=>{
  const f=await setup(),before=structuredClone(f.snapshot());
  const create=f.operator.store.create.bind(f.operator.store),writes=[];
  f.operator.store.create=async(c,k,...a)=>{writes.push(k);return create(c,k,...a);};
  const result=await f.operator.recover();
  assert.equal(writes[0],RECEIPT_KEY);assert.equal(writes.at(-1),RECEIPT_KEY+':complete');
  assert.equal(result.count,246);assert.equal(f.rounds.size,246);
  assert(f.docs.has('journal/'+NEW_PREFIX+':abandoned:2'));
  assert(!f.docs.has('journal/demon-two:demon-two-36524060044:proof'));
  for(const {value:b} of before.batches)
    assert.deepEqual(f.get(`batch:${f.plan.trialId}:${b.id}`).pending,b.id===2?null:b.pending);
  await f.operator.supersession.boundary();
  await assert.rejects(f.operator.recover(),/SUPERSESSION_ALREADY_STARTED/);
});
test('new live lease blocks before supersession receipt and any incident writes',async()=>{
  const f=await setup();f.occupyLease();
  await assert.rejects(f.operator.recover(),/LEASE_ACTIVE/);
  assert(!f.docs.has('journal/'+RECEIPT_KEY));assert.equal(f.events.length,0);
});
test('old job appears immediately after receipt: reject before backup and preserve pending',async()=>{
  const f=await setup(),before=structuredClone(f.snapshot());
  const create=f.operator.store.create.bind(f.operator.store);
  f.operator.store.create=async(c,k,...a)=>{const r=await create(c,k,...a);if(k===RECEIPT_KEY)f.startOld();return r;};
  await assert.rejects(f.operator.recover(),/OLD_JOB_EXISTS/);
  assert.deepEqual(f.snapshot(),before);assert(!f.docs.has('journal/'+NEW_PREFIX+':proof'));
  await assert.rejects(f.operator.recover(),/SUPERSESSION_ALREADY_STARTED/);
});
test('interrupted backup is not silently replayed and cannot authorize later phases',async()=>{
  const f=await setup(),before=structuredClone(f.snapshot());
  const create=f.operator.store.create.bind(f.operator.store);
  f.operator.store.create=async(c,k,...a)=>{if(k===NEW_PREFIX+':records:10')throw Error('INTERRUPTED');return create(c,k,...a);};
  await assert.rejects(f.operator.recover(),/INTERRUPTED/);assert.deepEqual(f.snapshot(),before);
  await assert.rejects(f.operator.supersession.boundary(),/SUPERSESSION_NOT_COMPLETE/);
  await assert.rejects(f.operator.recover(),/SUPERSESSION_ALREADY_STARTED/);
});
test('receipt cannot be reused with another run while recovering or a different profile after completion',async()=>{
  const f=await setup();await f.operator.recover();
  f.operator.supersession.run='1000000:1';
  await assert.rejects(f.operator.supersession.boundary({recovering:true}),/SUPERSESSION_OWNER_CHANGED/);
  await f.operator.supersession.boundary();
  f.profile.pending=4;
  await assert.rejects(f.operator.supersession.boundary(),/SUPERSESSION_BINDING_CHANGED/);
});
test('legacy partial evidence cannot be hidden by a successful new receipt',async()=>{
  const f=await setup();await f.operator.recover();
  f.docs.set('journal/demon-two:demon-two-36524060044:records:1',{_id:'primary/demon-two:demon-two-36524060044:records:1',version:0,value:{}});
  await assert.rejects(f.operator.supersession.boundary(),/OLD_RECOVERY_HAS_WRITES/);
});
test('new receipt joins full446 validation and formal; no live bonus2 still blocks',async()=>{
  const f=await setup();await f.operator.recover();await finish(f);
  const validated=await f.operator.validate();assert.equal(validated.fullReadback,446);
  assert.equal(validated.replacementAttemptsSettled,3);assert.equal(validated.originalPendingSettled,2);
  assert.equal((await f.operator.formal()).validationLimit,0);
  const missing=await setup();await missing.operator.recover();await finish(missing,{feature:false});
  await assert.rejects(missing.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);
  await assert.rejects(missing.operator.formal());
});
