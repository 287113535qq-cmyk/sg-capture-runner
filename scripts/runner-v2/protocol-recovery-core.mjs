import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolPolicy} from './protocol-policy.mjs';

export function reviewParkedProtocol({profile,plan,campaign,pool,batches,parked,holds,now=Date.now()}) {
  const policy=protocolPolicy(plan.gameId);
  assert(profile.schema==='sg-parked-protocol-profile-v1' && profile.id===policy.id
    && profile.group===policy.group && profile.gameId===plan.gameId,'WRONG_PROTOCOL_RECOVERY');
  assert(hash(plan)===profile.planHash && plan.phase===1 && plan.buy===0,'PLAN_CHANGED');
  assert(campaign.enabled && !campaign.reason && campaign.activeGame===null && !campaign.audit
    && campaign.validationLimit===0 && !campaign.protocolValidation,'CAMPAIGN_NOT_IDLE');
  assert(!campaign.games.some(g=>g.status==='ready'),'READY_GAMES_TAKE_PRIORITY');
  const game=campaign.games.find(g=>g.game_id===plan.gameId);
  assert(game?.status==='parked-protocol' && game.baseline+plan.target===300000,'PARKED_GAME_CHANGED');
  assert(holds.length===2 && new Set(holds.map(x=>x._id)).size===2
    && ['primary/global-hold','secondary/global-hold'].every(id=>holds.some(x=>x._id===id && x.value.active===false)),'GLOBAL_HOLD');
  assert(!pool.enabled && pool.failure==='PROTOCOL_VALIDATION_FAILED' && pool.planHash===profile.planHash
    && hash(pool)===profile.poolHash && hash(parked.pool)===hash(pool),'PARKED_POOL_CHANGED');
  assert(Object.values(pool.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(batches.length===pool.nextBatchId-1 && batches.length===profile.batches.length && batches.length<=100,'BATCHES_CHANGED');
  let complete=0,checkpoint=0,pending=0,next=1;
  const sessions=new Set();
  for(const [id,w] of Object.entries(pool.workers)){
    assert(Number(id)>=policy.offset && Number(id)<policy.offset+20 && /^[a-f0-9]{64}$/.test(w.sessionHash) && !sessions.has(w.sessionHash),'WORKER_CHANGED');
    sessions.add(w.sessionHash);
  }
  for(const [i,doc] of batches.entries()){
    const b=doc.value,e=profile.batches[i],w=pool.workers[String(b.worker)];
    assert(b.id===i+1 && b.id===e.id && hash(b)===e.hash,'BATCH_CHANGED');
    assert(b.start===next && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');next=b.end+1;
    assert(b.leaseUntil<=now && !b.bootstrapAwaiting && !b.pendingOriginal && !b.protocolResume
      && (b.failure===null || b.failure==='PROTOCOL_VALIDATION_FAILED'),'BATCH_REQUIRES_REVIEW');
    assert(w?.sessionHash===b.sessionHash && w.activeBatch?.id===b.id
      && w.activeBatch.worker===b.worker && w.activeBatch.start===b.start && w.activeBatch.end===b.end,'BATCH_OWNER_CHANGED');
    assert(b.start-1<=b.checkpoint && b.checkpoint<=b.journaled && b.journaled<b.end,'INVALID_PROGRESS');
    assert(parked.evidence.some(x=>x.key===`parked:${plan.trialId}:${b.id}` && x.hash===hash(b)),'PARKED_BACKUP_CHANGED');
    complete+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(b.pending){
      assert(b.pending.awaiting===null && b.pending.raw.steps.length>0 && b.pending.sequence===b.journaled+1,'UNKNOWN_SOURCE_OUTCOME');
      assert(e.pendingHash===hash(b.pending),'PENDING_CHANGED');pending++;
    }else assert(!b.failure && e.pendingHash===null,'FAILURE_WITHOUT_PENDING');
  }
  assert(next===pool.nextSequence && complete===profile.complete && checkpoint===profile.checkpoint
    && pending===profile.pending && complete===policy.complete && pending===policy.pending,'COUNTS_CHANGED');
  return {complete,checkpoint,pending};
}

export function protocolGrant({plan,batches,proofHash,commit,now=Date.now()}) {
  return {schema:'sg-protocol-resume-v1',gameId:plan.gameId,trialId:plan.trialId,planHash:hash(plan),proofHash,
    commit,createdAt:now,expiresAt:now+2*60*60000,batches:batches.filter(d=>d.value.pending).map(({value:b})=>
      ({id:b.id,worker:b.worker,sessionHash:b.sessionHash,pendingHash:hash(b.pending)}))};
}

export function requireShortRun(campaign,runKey,commit) {
  const p=campaign.protocolValidation;if(!p)return false;
  if(p.demoFresh){
    assert(p.phase==='short'&&p.gameId===campaign.activeGame&&campaign.validationLimit===5&&/^[a-f0-9]{64}$/.test(p.demoFresh)&&/^[a-f0-9]{64}$/.test(p.generation)&&!p.beaverPending&&!p.pendingFirst&&!p.freshStart&&!p.nestedShort,'DEMO_FRESH_SCOPE_CHANGED');
    assert(p.commit===commit&&/^[a-f0-9]{40}$/.test(commit)&&/^capture-run:\d+:1$/.test(runKey),'DEMO_FRESH_RUNTIME_CHANGED');
    assert(p.runKey===null||p.runKey===runKey,'PROTOCOL_SHORT_REVIEW_REQUIRED');if(p.runKey===runKey)return false;p.runKey=runKey;return true;
  }
  const beaver=p.gameId===32820&&/^[a-f0-9]{64}$/.test(p.beaverPending||'')&&!p.pendingFirst&&!p.freshStart&&!p.nestedShort;
  assert(p.phase==='short' && p.gameId===campaign.activeGame && (beaver?campaign.validationLimit===1:!p.beaverPending&&campaign.validationLimit===10),'PROTOCOL_SHORT_CHANGED');
  assert(/^[a-f0-9]{40}$/.test(p.commit) && p.commit===commit,'RESUME_CODE_CHANGED');
  assert(p.runKey===null || p.runKey===runKey,'PROTOCOL_SHORT_REVIEW_REQUIRED');
  if(p.runKey===runKey)return false;
  p.runKey=runKey;return true;
}
