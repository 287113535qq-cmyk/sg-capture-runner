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
  const capacity=plan?.campaignId==='sg_round_one_20260928' ? 40 : 20;
  assert(Number.isInteger(shard) && shard>=0 && shard<capacity);
  const freshPiggies=trialId==='sg_r1_20260930_32636'&&plan?.trialId===trialId
    &&plan.gameId===32636&&plan.runtimeGameId===33085&&plan.campaignId==='sg_round_one_20260928'
    &&/^[a-f0-9]{64}$/.test(plan.demoGeneration??'');
  assert(/^(bookofsevens_[a-z0-9_]{1,70}|sg_r1_20260928_[0-9]{5})$/.test(trialId)||freshPiggies,'DEMO_TRIAL_SCOPE');
  // A generation is part of the reviewed plan, never a process-local random
  // retry token. Legacy plans retain their byte-for-byte identifier derivation.
  const generation=plan?.demoGeneration;
  if(generation!==undefined)assert(plan?.campaignId==='sg_round_one_20260928'
    && /^[a-f0-9]{64}$/.test(generation),'DEMO_GENERATION_SCOPE');
  const context=generation===undefined?`sg-real-trial-v1:${trialId}:parallel-shard:${shard}`
    :`sg-demo-generation-v1:${trialId}:${generation}:parallel-shard:${shard}`;
  const suffix=createHmac('sha256',base.sessionId+'@'+base.operatorId)
    .update(context).digest('hex');
  const sessionId=base.sessionId.slice(0,5)+suffix.slice(0,32);
  assert.notEqual(sessionId,base.sessionId);
  return {...base,sessionId};
}
