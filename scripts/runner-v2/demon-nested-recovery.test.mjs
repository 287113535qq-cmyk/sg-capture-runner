import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,finish} from './demon-nested-test-fixture.mjs';
import {PendingFirst} from './pending-first.mjs';
import {STAGE_KEY} from './demon-nested-stage.mjs';
import {receiptKey} from './durable-queue.mjs';

const gateFor=f=>{const c=f.docs.get('state/campaign').value;c.protocolValidation.runKey='capture-run:999999:1';return new PendingFirst({store:f.operator.store,transport:f.operator.transport,analyzer:f.operator.parser,plan:f.plan,stage:'capture',runKey:c.protocolValidation.runKey,now:f.operator.now});};
const identity=(f,w)=>({commitSha:f.operator.commit,shardId:w,sessionHash:f.get('state','pool:'+f.plan.trialId).value.workers[w].sessionHash});
for(const mutation of ['prefix','missing-mongo','bonus','over-quota'])test('validation rejects '+mutation,async()=>{
 const f=fixture();await f.operator.recover();await finish(f);const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,218)).value;
 if(mutation==='prefix'){r.raw.steps[0].elapsedMs++;f.rounds.set(r._id,structuredClone(r));}
 if(mutation==='missing-mongo')f.rounds.delete(r._id);
 if(mutation==='bonus'){r.bonus=1;f.rounds.set(r._id,structuredClone(r));}
 if(mutation==='over-quota')f.docs.get('state/batch:'+f.plan.trialId+':3').value.journaled++;
 await assert.rejects(f.operator.validate());await assert.rejects(f.operator.formal());
});
test('remaining quota is consumed once, completed worker admits zero',async()=>{
 const f=fixture();await f.operator.recover();await finish(f);const gate=gateFor(f);
 for(let w=0;w<20;w++)assert.equal((await gate.admit(identity(f,w),w)).limit,0);
 await assert.rejects(gate.admit({...identity(f,0),shardId:14},0),/IDENTITY_CHANGED/);
 await assert.rejects(gate.admit({...identity(f,0),sessionHash:'wrong'},0),/IDENTITY_CHANGED/);
 gate.runKey='capture-run:999999:2';await assert.rejects(gate.admit(identity(f,0),0),/RUN_CHANGED/);
});
for(const mutation of ['missing-stage','owner','commit','expiry'])test('permission rejects '+mutation,async()=>{
 const f=fixture();await f.operator.recover();const gate=gateFor(f),s=f.docs.get('journal/'+STAGE_KEY).value;
 if(mutation==='missing-stage')f.docs.delete('journal/'+STAGE_KEY+':complete');
 if(mutation==='owner')s.run='99999:1';
 if(mutation==='commit')s.commit='a'.repeat(40);
 if(mutation==='expiry')gate.now=()=>f.profile.createdAt+7200001;
 await assert.rejects(gate.admit(identity(f,0),0));
});
test('synthetic267 control fixture,11 flushed, both pending preserved and original179 quota retained',async()=>{
 const f=fixture();try{const before=await f.operator.snapshots(),r=await f.operator.recover(),after=await f.operator.snapshots();assert.equal(r.count,267);assert.equal(r.flushed,11);assert.equal(f.rounds.size,267);
  for(const {value:b} of before.batches)assert.deepEqual(after.batches.find(x=>x.value.id===b.id).value.pending,b.pending);
  const spec=f.get('journal','pending-first:'+r.proofHash).value;assert.equal(Object.values(spec.remaining).reduce((a,b)=>a+b),179);assert.equal(spec.remaining[13],0);assert.deepEqual(spec.entries.map(e=>e.worker).sort((a,b)=>a-b),[0,14]);
  assert.equal(f.writes[0],STAGE_KEY);assert.equal(f.writes.at(-1),STAGE_KEY+':complete');await assert.rejects(f.operator.recover());
 }finally{f.close();}
});
for(const point of ['stage','backup'])test('old job at '+point+' blocks all batch writes',async()=>{const f=fixture();try{const before=await f.operator.snapshots();f.hook(k=>{if(k===(point==='stage'?STAGE_KEY:f.operator.prefix+':backup-complete'))f.block();});await assert.rejects(f.operator.recover(),/OLD_JOB_EXISTS/);assert.deepEqual(await f.operator.snapshots(),before);}finally{f.close();}});
test('active leases block first new receipt',async()=>{const f=fixture();try{f.occupy();await assert.rejects(f.operator.recover(),/LEASE_ACTIVE/);assert.equal(f.writes.length,0);}finally{f.close();}});
test('interrupted backup cannot mutate batches or rerun',async()=>{const f=fixture();try{const before=await f.operator.snapshots();f.fail(f.operator.prefix+':records:19');await assert.rejects(f.operator.recover(),/INJECTED_FAILURE/);assert.deepEqual(await f.operator.snapshots(),before);f.fail(null);await assert.rejects(f.operator.recover());}finally{f.close();}});
test('original owners alone admitted, capture waits for both original receipts',async()=>{const f=fixture();try{await f.operator.recover();const c=f.docs.get('state/campaign').value;c.protocolValidation.runKey='capture-run:999999:1';const args={store:f.operator.store,transport:f.operator.transport,analyzer:f.operator.parser,plan:f.plan,runKey:c.protocolValidation.runKey,now:f.operator.now};
 for(const worker of [0,14]){const identity={commitSha:f.operator.commit,shardId:worker,sessionHash:f.get('state','pool:'+f.plan.trialId).value.workers[worker].sessionHash};const gate=new PendingFirst({...args,stage:'resume'});assert.equal((await gate.admit(identity,worker)).limit,1);await assert.rejects(new PendingFirst({...args,stage:'capture'}).admit(identity,worker),/PENDING_FIRST_UNSETTLED/);}
 const id={commitSha:f.operator.commit,shardId:13,sessionHash:f.get('state','pool:'+f.plan.trialId).value.workers[13].sessionHash};await assert.rejects(new PendingFirst({...args,stage:'resume'}).admit(id,13),/PENDING_FIRST_WRONG_WORKER/);
 }finally{f.close();}});

test('446 full validation preserves prior quota and admits formal only with nested terminal',async()=>{const f=fixture();await f.operator.recover();await finish(f);const r=await f.operator.validate();assert.equal(r.newComplete,179);assert.equal(r.originalPendingSettled,2);await f.operator.formal();});
for(const seq of [806,434,117,902,1706])test('all five independent replacements reject replay '+seq,async()=>{const f=fixture();await f.operator.recover();await finish(f);const e=f.profile.archives[seq],a=f.get('journal',e.prefix+':abandoned:'+e.batch).value;const r=[...f.docs.entries()].find(([k,x])=>k.startsWith('journal/record:')&&x.value.sequence===seq)?.[1].value || [...f.docs.values()].find(x=>x.value.sequence===seq&&x.value.raw).value;r.attempt=a.pending.attempt;f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate(),/REPLAYED|OLD_RECORDS_CHANGED/);});
