// Exact successful BET held during a short run. No session reset or discarded attempt.
import assert from 'node:assert/strict';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
export const PICK_BONUS={id:'pick-bonus-36502517559',count:190,checkpoint:178,
  previousProof:'e7f27d5d32f136ee5b53c982d5ea0b887b9b15415f4dc286b4e54e36d32db7f6',
  previousCommit:'e2db5812406de1d962fc495d7c9de066213df290',runKey:'capture-run:36502517559:1'};
export function reviewPickBonus({plan,profile,s,now=Date.now()}){
  const c=s.campaign.value,p=s.pool.value,k=PICK_BONUS;
  assert(profile.schema==='sg-pick-bonus-resume-v1' && profile.id===k.id && profile.group==='secondary'
    && profile.gameId===32836 && plan.gameId===32836 && profile.complete===190 && profile.checkpoint===178 && profile.pending===1,'WRONG_PICK_BONUS_SCENE');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(plan.phase===1 && plan.buy===0 && hash(plan)===profile.planHash,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash,'INCIDENT_STATE_CHANGED');
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===32836 && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.proofHash===k.previousProof
    && c.protocolValidation.commit===k.previousCommit && c.protocolValidation.runKey===k.runKey
    && c.games.find(g=>g.game_id===32836)?.status==='active' && !c.games.some(g=>g.status==='ready'),'SHORT_STATE_CHANGED');
  assert(!p.enabled && p.failure==='PROTOCOL_VALIDATION_FAILED' && p.planHash===profile.planHash
    && p.protocolRecovery===k.previousProof,'POOL_CHANGED');
  assert(Object.values(p.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===Object.keys(p.workers).length,'SHARED_SESSION');
  assert(s.batches.length===18 && s.batches.length===p.nextBatchId-1 && profile.batches.length===18,'BATCHES_CHANGED');
  let count=0,checkpoint=0,end=0,pending=0;
  for(const [i,{value:b}] of s.batches.entries()){
    assert(b.id===i+1 && profile.batches[i].id===b.id && profile.batches[i].hash===hash(b),'BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    const w=p.workers[b.worker];
    assert(b.worker>=20 && b.worker<40 && w?.sessionHash===b.sessionHash && w.activeBatch?.id===b.id
      && w.activeBatch.worker===b.worker && w.activeBatch.start===b.start && w.activeBatch.end===b.end,'BATCH_OWNER_CHANGED');
    assert(b.leaseUntil<=now && !b.bootstrapAwaiting && !b.pendingOriginal && !b.protocolResume,'BATCH_REQUIRES_REVIEW');
    assert(b.start-1<=b.checkpoint && b.checkpoint<=b.journaled && b.journaled<b.end,'CHECKPOINT_CHANGED');
    count+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(!b.pending){assert(!b.failure,'FAILURE_WITHOUT_PENDING');continue;}
    const q=b.pending;pending++;
    assert(b.id===11 && b.worker===38 && b.failure==='PROTOCOL_VALIDATION_FAILED' && q.sequence===1008
      && q.sequence===b.journaled+1 && q.awaiting===null && q.raw.steps.length===1
      && q.raw.steps[0].msgId==='BET' && !q.raw.steps[0].sourceRejected && hash(q)===profile.pendingHash,'UNREVIEWED_PENDING');
  }
  assert(end+1===p.nextSequence && count===190 && checkpoint===178 && pending===1,'COUNTS_CHANGED');
}
export class PickBonusRecovery extends ProtocolRecovery{
  constructor(args){
    super({...args,profile:{...args.profile,id:'quarterback-32836-20260929'}});
    this.profile=args.profile;this.prefix='pick-bonus:'+PICK_BONUS.id;
    this.policy={...this.policy,complete:190,pending:1,specialBatch:11,specialSequence:1008,specialBonus:3,next:{MSGID:'FEATURE_START',CFG:'1'}};
  }
  async reviewRecovery(s,holds){
    const old=(await this.store.get('journal','foam-session:foam-session-36499471583:reconciled'))?.value;
    assert(old?.proofHash===PICK_BONUS.previousProof && old.count===118 && old.committed===118,'PRIOR_RECOVERY_CHANGED');
    const review=x=>reviewPickBonus({plan:this.plan,profile:this.profile,s:x,now:this.now()});review(s);
    const q=s.batches.find(x=>x.value.id===11).value.pending;
    assert(stable(await this.parser.call({op:'next',plan:this.plan,raw:q.raw}))===stable(this.policy.next),'CONTINUATION_NOT_VERIFIED');
    // A new complete private before snapshot replaces reliance on old parked evidence.
    // The inherited operator backs up every receipt before any write and never clears q.
    return {review,parked:{previousShort:PICK_BONUS.runKey,previousRecovery:old,holds}};
  }
}
