import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
export const digest=value=>createHash('sha256').update(stable(value)).digest('hex');

// Exact operator profile only. Expired ownership alone never permits replay.
export function reviewIncident({profile,plan,campaign,pool,hold,batches,now=Date.now()}){
  assert(profile.group==='secondary' && profile.id==='panda-network-36472693926-20260929','WRONG_INCIDENT');
  assert(now>=profile.createdAt && now-profile.createdAt<2*60*60000,'INCIDENT_PROOF_STALE');
  assert(digest(plan)===profile.planHash && plan.buy===0 && plan.phase===1,'PLAN_CHANGED');
  for(const [key,doc] of Object.entries({campaign,pool,hold}))
    assert(digest(doc)===profile.snapshots[key],'INCIDENT_STATE_CHANGED');
  assert(campaign.value.activeGame===plan.gameId && campaign.value.enabled && campaign.value.validationLimit===0,'CAMPAIGN_CHANGED');
  assert(hold.value.active && hold.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW','UNREVIEWED_HOLD');
  assert(pool.value.enabled && !pool.value.failure && pool.value.planHash===profile.planHash,'POOL_CHANGED');
  assert(Object.values(pool.value.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(batches.length===pool.value.nextBatchId-1 && batches.length===profile.batches.length,'BATCHES_CHANGED');
  let complete=0,checkpoint=0,unknown=0;
  for(const [index,doc] of batches.entries()){
    const b=doc.value,expected=profile.batches[index];
    assert(b.id===expected.id && digest(doc)===expected.hash,'BATCH_CHANGED');
    assert(b.leaseUntil<=now && !b.failure && !b.pendingOriginal && !b.bootstrapAwaiting,'BATCH_REQUIRES_REVIEW');
    assert(b.start<=b.checkpoint+1 && b.checkpoint<=b.journaled && b.journaled<=b.end,'INVALID_PROGRESS');
    assert(pool.value.workers[String(b.worker)]?.sessionHash===b.sessionHash,'SESSION_CHANGED');
    complete+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(b.pending){
      const p=b.pending,e=profile.abandon;
      assert(b.id===e.batch && b.worker===e.worker && p.sequence===e.sequence && digest(p)===e.pendingHash,'UNEXPECTED_PENDING');
      assert(p.sequence===b.journaled+1 && p.raw.steps.length===0 && typeof p.awaiting==='string'
        && new URLSearchParams(p.awaiting).get('MSGID')==='BET','NOT_UNKNOWN_INITIAL_BET');
      assert(pool.value.workers[String(b.worker)].activeBatch?.id===b.id,'PENDING_OWNER_CHANGED');
      unknown++;
    }
  }
  assert(complete===profile.complete && checkpoint===profile.checkpoint && unknown===1,'COUNTS_CHANGED');
  return {complete,checkpoint,unknown};
}

export function releaseReviewedPool(pool,proofHash){
  const next=structuredClone(pool);
  for(const worker of Object.values(next.workers)){worker.owner=null;worker.leaseUntil=0;worker.resumeSafe=true;}
  next.incidentRecovery=proofHash;
  // confirmed accounts only completed batches; partial readback is not added.
  return next;
}

// A successful partial-batch release is persisted on its owning pool worker.
// Old batch timestamps are not renewed/cleared by that release. This check is
// only for a completed short run after githubIdle(), never unknown recovery.
export function reviewReleasedBatches(pool,batches,now=Date.now()){
  assert(Object.values(pool.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  for(const {value:b} of batches){
    assert(!b.pending && !b.bootstrapAwaiting && !b.failure && b.journaled===b.checkpoint,'UNSETTLED_BATCH');
    const w=pool.workers[String(b.worker)];assert(w?.sessionHash===b.sessionHash,'SESSION_CHANGED');
    if(b.leaseUntil<=now)continue;
    if(w.activeBatch?.id===b.id){
      assert(w.resumeSafe===true && w.leaseUntil===0 && w.owner===b.owner && w.epoch<=b.epoch,'BATCH_NOT_RELEASED');
    }else assert(b.journaled===b.end,'UNOWNED_PARTIAL_BATCH');
  }
}
