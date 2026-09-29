// Offline candidate only. Does not dispatch, mutate storage, or relax a live gate.
import assert from 'node:assert/strict';
import {protocolHash} from './protocol-resume.mjs';

export const original = Object.freeze({
  repository:'zyzuoyang/sg-capture-runner', id:36525403196, attempt:1,
  commit:'7296147c426188d2ca0bd4a7738471e062a8b2da',
  profileHash:'78a54d7aca62c78de8b02227664ceee1e7752b403de1cae078e109db8b70908e',
  createdAt:1790658796989, expiresAt:1790665996989,
  groupsHash:'9ecaaca6849559c493699b2cb66f63a5d45bfe94259d0e1b552e5f31b015759b',
});

export function reviewExpiredRun({run,jobs,profileBytes,snapshot,checkedAt,now}) {
  assert(Number.isSafeInteger(now) && Number.isSafeInteger(checkedAt)
    && checkedAt<=now && now-checkedAt<=30000,'GITHUB_EVIDENCE_STALE');
  assert(now>=original.expiresAt+300000,'OLD_PROFILE_NOT_EXPIRED');
  assert(run.id===original.id && run.run_attempt===original.attempt
    && run.head_sha===original.commit && run.repository.full_name===original.repository
    && run.path==='.github/workflows/trial-300k.yml'
    && run.event==='workflow_dispatch','OLD_RUN_IDENTITY_CHANGED');
  assert(run.status==='queued' && run.conclusion===null,'OLD_RUN_STATE_CHANGED');
  assert(jobs.total_count===0 && Array.isArray(jobs.jobs) && jobs.jobs.length===0,'OLD_JOB_EXISTS');
  const profile=JSON.parse(profileBytes);
  assert(protocolHash(profile)===original.profileHash,'OLD_PROFILE_CHANGED');
  assert(profile.createdAt===original.createdAt,'OLD_EXPIRY_CHANGED');
  assert(Number.isSafeInteger(snapshot.at) && snapshot.at*1000<=now
    && now-snapshot.at*1000<=30000,'MONGO_EVIDENCE_STALE');
  // Pin the entire reviewed baseline, including original raw/Mongo/pending/history/holds.
  assert(protocolHash(snapshot.groups)===original.groupsHash,'ORIGINAL_DATA_CHANGED');
  assert(!snapshot.groups.primary.journals.some(x=>x._id.startsWith('primary/demon-two:')),'OLD_RECOVERY_HAS_WRITES');
  return {schema:'expired-demon-two-review-v1',oldRun:original.id,oldCommit:original.commit,
    oldProfileHash:original.profileHash,baselineHash:original.groupsHash,checkedAt,
    expiresAt:checkedAt+30000,sourceRequests:0};
}

// Proposed pre-write gate. A review is never an unrestricted ignore-list entry.
// Real caller must separately verify all leases/resources and full round semantics.
export async function reviewedIdle({active,currentRun,readEvidence,now}) {
  assert(Number.isSafeInteger(currentRun) && currentRun!==original.id,'NEW_RUN_REQUIRED');
  assert(Array.isArray(active),'ACTIVE_LIST_REQUIRED');
  const seen=new Set(); let review=null;
  for(const item of active) {
    const key=item.repository+':'+item.id;
    assert(!seen.has(key),'DUPLICATE_ACTIVE_RUN');seen.add(key);
    if(item.repository===original.repository && item.id===currentRun)continue;
    assert(item.repository===original.repository && item.id===original.id,'OTHER_RUN_ACTIVE');
    review=reviewExpiredRun({...await readEvidence(),now:now()});
  }
  return review;
}
