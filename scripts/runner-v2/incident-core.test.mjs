import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,reviewIncident,releaseReviewedPool,reviewReleasedBatches} from './incident-core.mjs';
function fixture(){
  const plan={gameId:32833,buy:0,phase:1};
  const pending={sequence:4,awaiting:'MSGID=BET&PID=fixture',raw:{steps:[]}};
  const pool={value:{enabled:true,failure:null,nextBatchId:2,planHash:digest(plan),confirmed:0,
    workers:{38:{sessionHash:'fixture',leaseUntil:100,owner:'old',activeBatch:{id:81},resumeSafe:false}}}};
  const campaign={value:{activeGame:32833,enabled:true,validationLimit:0}},hold={value:{active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW'}};
  const batches=[{value:{id:81,worker:38,start:1,end:100,journaled:3,checkpoint:1,leaseUntil:100,sessionHash:'fixture',pending}}];
  const profile={id:'panda-network-36472693926-20260929',group:'secondary',createdAt:100,planHash:digest(plan),
    snapshots:{pool:digest(pool),campaign:digest(campaign),hold:digest(hold)},batches:[{id:81,hash:digest(batches[0])}],
    complete:3,checkpoint:1,abandon:{batch:81,worker:38,sequence:4,pendingHash:digest(pending)}};
  return {profile,plan,pool,campaign,hold,batches,now:200};
}
function rebind(f){f.profile.snapshots={pool:digest(f.pool),campaign:digest(f.campaign),hold:digest(f.hold)};
  f.profile.batches[0].hash=digest(f.batches[0]);f.profile.abandon.pendingHash=digest(f.batches[0].value.pending);return f;}
test('exact unknown initial BET is eligible without replay or counting the pending sequence',()=>{
  assert.deepEqual(reviewIncident(fixture()),{complete:3,checkpoint:1,unknown:1});
});
test('a changed live document is rejected before cleanup',()=>{const f=fixture();f.batches[0].value.journaled=4;
  assert.throws(()=>reviewIncident(f),/BATCH_CHANGED/);});
test('expired evidence is rejected',()=>{const f=fixture();f.now=8_000_000;assert.throws(()=>reviewIncident(f),/STALE/);});
test('a known natural continuation may not be discarded',()=>{const f=fixture();f.batches[0].value.pending.awaiting=null;
  f.batches[0].value.pending.raw.steps=[{msgId:'BET'}];assert.throws(()=>reviewIncident(rebind(f)),/NOT_UNKNOWN_INITIAL_BET/);});
test('unknown FREE_GAME is outside this exact initial BET authorization',()=>{const f=fixture();f.batches[0].value.pending.awaiting='MSGID=FREE_GAME';
  assert.throws(()=>reviewIncident(rebind(f)),/NOT_UNKNOWN_INITIAL_BET/);});
test('active worker, bootstrap intent, changed session and another fault are rejected',()=>{
  for(const mutate of [f=>f.pool.value.workers[38].leaseUntil=300,f=>f.batches[0].value.bootstrapAwaiting={},
    f=>f.batches[0].value.sessionHash='other',f=>f.hold.value.reason='DISK_RESERVE_REQUIRES_REVIEW']){
    const f=fixture();mutate(f);assert.throws(()=>reviewIncident(rebind(f)));}
});
test('releasing ownership retains sessions, allocation, ranges and confirmed completed-batch count',()=>{
  const f=fixture(),original=structuredClone(f.pool.value);const after=releaseReviewedPool(original,'proof');
  assert.equal(after.confirmed,0);assert.deepEqual(after.workers[38].activeBatch,original.workers[38].activeBatch);
  assert.equal(after.workers[38].sessionHash,'fixture');assert.equal(after.workers[38].resumeSafe,true);
  assert.equal(after.workers[38].owner,null);assert.equal(after.workers[38].leaseUntil,0);
  assert.equal(original.workers[38].owner,'old');
});

test('completed short run can validate an explicit safe worker release with a stale batch timestamp',()=>{
  const pool={workers:{38:{leaseUntil:0,resumeSafe:true,owner:'short',epoch:3,sessionHash:'s',activeBatch:{id:81}}}};
  const batches=[{value:{id:81,worker:38,leaseUntil:10000,owner:'short',epoch:4,sessionHash:'s',journaled:13,checkpoint:13,end:100}}];
  reviewReleasedBatches(pool,batches,100);
  for(const patch of [{resumeSafe:false},{leaseUntil:200},{owner:'different'},{epoch:5}]){
    const changed=structuredClone(pool);Object.assign(changed.workers[38],patch);assert.throws(()=>reviewReleasedBatches(changed,batches,100));
  }
  const unsettled=structuredClone(batches);unsettled[0].value.pending={awaiting:null};assert.throws(()=>reviewReleasedBatches(pool,unsettled,100));
  const orphan=structuredClone(pool);orphan.workers[38].activeBatch=null;assert.throws(()=>reviewReleasedBatches(orphan,batches,100));
});
