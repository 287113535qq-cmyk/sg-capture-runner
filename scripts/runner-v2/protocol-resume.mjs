import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stable} from './mongo-writer.mjs';
import {protocolPolicy} from './protocol-policy.mjs';
import {reviewBeaverResume} from './beaver-resume.mjs';

export const protocolHash=value=>createHash('sha256').update(stable(value)).digest('hex');

// A grant is issued only by the offline-reviewed GitHub maintenance operator.
// Expired leases alone, or an awaiting source response, never allow resumption.
export function reviewProtocolResume({plan,batch,grant,worker,sessionHash,commit,now=Date.now()}) {
  if(plan.gameId===32820)return reviewBeaverResume({plan,batch,grant,worker,sessionHash,commit,now});
  const marker=batch.protocolResume,p=batch.pending;
  assert(marker && grant?.schema==='sg-protocol-resume-v1','PENDING_REQUIRES_REVIEW');
  const policy=protocolPolicy(plan.gameId);
  assert(worker>=policy.offset && worker<policy.offset+20,'RESUME_WORKER_GROUP_CHANGED');
  assert(grant.gameId===plan.gameId && grant.trialId===plan.trialId
    && grant.planHash===protocolHash(plan),'RESUME_PLAN_CHANGED');
  assert(/^[a-f0-9]{64}$/.test(marker.proofHash) && grant.proofHash===marker.proofHash,'RESUME_PROOF_CHANGED');
  assert(/^[a-f0-9]{40}$/.test(grant.commit) && grant.commit===commit,'RESUME_CODE_CHANGED');
  assert(now>=grant.createdAt && now<grant.expiresAt && grant.expiresAt-grant.createdAt<=2*60*60000,'RESUME_PROOF_STALE');
  assert(p && p.awaiting===null && p.raw.steps.length>0 && !batch.bootstrapAwaiting
    && !batch.pendingOriginal && !batch.failure,'UNKNOWN_SOURCE_OUTCOME');
  const bound=grant.batches.find(x=>x.id===batch.id);
  assert(bound && bound.worker===worker && batch.worker===worker && bound.sessionHash===sessionHash
    && batch.sessionHash===sessionHash,'RESUME_SESSION_CHANGED');
  assert(p.sequence===batch.journaled+1 && p.sequence<=batch.end
    && bound.pendingHash===protocolHash(p) && marker.pendingHash===bound.pendingHash,'RESUME_PENDING_CHANGED');
  return structuredClone(p);
}
