import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';

// The existing collector's opt-in Free: demo reconnect path uses a fresh,
// client-chosen anonymous identifier. Keep one stable identifier per shard so
// retries never silently replace a session with an unresolved request.
export function gameForShard(base,shard,trialId='bookofsevens_300k_20260927',plan=null) {
  if(plan?.campaignId){assert.equal(plan.phase,1);assert.equal(base.id,plan.gameId);assert.equal(base.runtimeSlug,plan.runtimeSlug);}
  else {assert.equal(base.id,32471);assert.equal(base.runtimeSlug,'bookofsevens96');}
  assert.equal(base.serverAddress,'ogs-gdm-usnj.nyxop.net/nextgen');
  assert.equal(base.mode,'demo');
  assert(typeof base.sessionId==='string' && /^Free:/i.test(base.sessionId));
  assert(typeof base.operatorId==='string' && base.operatorId.length>0);
  assert(Number.isInteger(shard) && shard>=0 && shard<20);
  assert(/^(bookofsevens_[a-z0-9_]{1,70}|sg_r1_20260928_[0-9]{5})$/.test(trialId));
  const suffix=createHmac('sha256',base.sessionId+'@'+base.operatorId)
    .update(`sg-real-trial-v1:${trialId}:parallel-shard:${shard}`).digest('hex');
  const sessionId=base.sessionId.slice(0,5)+suffix.slice(0,32);
  assert.notEqual(sessionId,base.sessionId);
  return {...base,sessionId};
}
