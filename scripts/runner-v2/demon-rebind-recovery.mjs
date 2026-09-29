// Preserve four unconsumed original Demon rounds; this operator has no SG client.
import assert from 'node:assert/strict';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {demonNextRequest} from '../trial/demon-protocol.mjs';
import {receiptKey} from './durable-queue.mjs';

export const DEMON_REBIND={id:'demon-unstarted-terminal-20260929',
  proof:'1aea9b7064eb4ac5d682c0d6aca5a2a74693b1ebba9a103bbd4ff13d1ed84bef',
  commit:'9b637908d7a5ef00f146d435b41e42ace9b7c447',
  prefix:'terminal-incident:demon-after-foam-end-36495948701',
  pending:{1:{worker:3,sequence:9,frames:4},5:{worker:0,sequence:432,frames:9},
    9:{worker:13,sequence:806,frames:3},10:{worker:2,sequence:902,frames:1}}};

export function reviewDemonRebind({s,plan,profile,old,grant,prior,now=Date.now()}){
  const c=s.campaign.value,p=s.pool.value,k=DEMON_REBIND;
  assert(profile.schema==='sg-demon-unstarted-rebind-v1' && profile.id===k.id && profile.group==='primary'
    && profile.gameId===32739 && profile.complete===164 && profile.checkpoint===164 && profile.pending===4,'WRONG_DEMON_REBIND');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(plan.gameId===32739 && plan.buy===0 && plan.phase===1 && hash(plan)===profile.planHash,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash,'STATE_CHANGED');
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===32739 && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.proofHash===k.proof
    && c.protocolValidation.commit===k.commit && c.protocolValidation.runKey===null
    && c.games.find(g=>g.game_id===32739)?.status==='active' && !c.games.some(g=>g.status==='ready'),'SHORT_ALREADY_STARTED_OR_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===k.proof,'POOL_CHANGED');
  const workers=Object.entries(p.workers);
  assert(workers.length===17 && workers.every(([id,w])=>Number(id)>=0 && Number(id)<20 && w.leaseUntil<=now)
    && new Set(workers.map(([,w])=>w.sessionHash)).size===17,'WORKERS_ACTIVE_OR_CHANGED');
  assert(old?.proofHash===k.proof && old.count===164 && old.committed===164 && old.originalPendingPreserved===4
    && old.sourceRequests===0 && old.validRecordsDeleted===0 && hash(old)===profile.previousResultHash,'PREVIOUS_RESULT_CHANGED');
  assert(prior && hash(prior)===profile.previousBeforeHash && hash(grant)===profile.previousGrantHash,'PREVIOUS_EVIDENCE_CHANGED');
  // Historical provenance only. This does not authorize use of an expired grant.
  // recover() will create a fresh proof and new commit-bound grant after backup.
  assert(grant.schema==='sg-protocol-resume-v1' && grant.gameId===32739 && grant.trialId===plan.trialId
    && grant.planHash===profile.planHash && grant.proofHash===k.proof && grant.commit===k.commit
    && grant.createdAt<=now && grant.expiresAt>grant.createdAt && grant.expiresAt-grant.createdAt<=7200000
    && grant.batches.length===4,'HISTORICAL_GRANT_CHANGED');
  assert(s.batches.length===15 && profile.batches.length===15 && p.nextBatchId===16,'BATCHES_CHANGED');
  let complete=0,pending=0,end=0;
  for(const [i,{value:b}] of s.batches.entries()){
    const expected=profile.batches[i],original=prior.batches.find(x=>x.value.id===b.id)?.value;
    assert(b.id===i+1 && expected.id===b.id && hash(b)===expected.hash,'BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    assert(b.worker>=0 && b.worker<20 && p.workers[b.worker]?.sessionHash===b.sessionHash
      && p.workers[b.worker].activeBatch?.id===b.id,'SESSION_CHANGED');
    assert(b.start-1<=b.journaled && b.journaled<b.end && b.checkpoint===b.journaled && b.leaseUntil<=now
      && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'UNKNOWN_SOURCE_OUTCOME');
    assert(original && original.worker===b.worker && original.sessionHash===b.sessionHash
      && stable(original.pending)===stable(b.pending),'ORIGINAL_PENDING_CHANGED');
    complete+=b.journaled-b.start+1;
    const target=k.pending[b.id];
    if(!target){assert(!b.pending && !b.protocolResume,'UNREVIEWED_PENDING');continue;}
    const q=b.pending,bound=grant.batches.find(x=>x.id===b.id);pending++;
    assert(q && q.awaiting===null && b.worker===target.worker && q.sequence===target.sequence
      && q.sequence===b.journaled+1 && q.raw.steps.length===target.frames
      && q.raw.steps[0].msgId==='BET' && q.raw.steps.filter(x=>x.msgId==='BET').length===1
      && q.raw.steps.every(x=>!x.sourceRejected) && expected.pendingHash===hash(q),'PENDING_CHANGED');
    assert(b.protocolResume?.proofHash===k.proof && b.protocolResume.pendingHash===hash(q)
      && bound?.worker===b.worker && bound.sessionHash===b.sessionHash && bound.pendingHash===hash(q),'PERMIT_CONSUMED_OR_CHANGED');
  }
  assert(end+1===p.nextSequence && complete===164 && pending===4,'COUNTS_CHANGED');
  return {complete,checkpoint:complete,pending,historicalGrantExpired:grant.expiresAt<=now};
}

export class DemonRebindRecovery extends ProtocolRecovery{
  constructor(args){
    super({...args,profile:{...args.profile,id:'demon-32739-20260929'}});
    this.profile=args.profile;this.prefix='demon-rebind:'+DEMON_REBIND.id;
    this.policy={...this.policy,complete:164,pending:4};
  }
  async reviewRecovery(s,holds){
    const k=DEMON_REBIND,old=(await this.store.get('journal',k.prefix+':reconciled'))?.value;
    const grant=(await this.store.get('journal','protocol-resume:'+k.proof))?.value;
    const prior=(await this.store.get('journal',k.prefix+':before'))?.value;
    const review=x=>reviewDemonRebind({s:x,plan:this.plan,profile:this.profile,old,grant,prior,now:this.now()});review(s);
    for(const {value:b} of s.batches){
      const saved=(await this.store.get('journal',`${k.prefix}:records:${b.id}`))?.value.records;
      assert(Array.isArray(saved) && hash(saved)===this.profile.batches[b.id-1].recordsHash,'PRIOR_RECORDS_CHANGED');
      assert(saved.length===b.journaled-b.start+1,'PRIOR_RECORD_COUNT_CHANGED');
      if(saved.length){
        const current=await this.store.getMany('journal',saved.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(current.every((r,i)=>r && stable(r.value)===stable(saved[i])),'ORIGINAL_RECORD_CHANGED');
      }
      if(b.pending)assert(stable(await this.parser.call({op:'next',plan:this.plan,raw:b.pending.raw}))===stable(this.policy.next)
        && stable(demonNextRequest(b.pending.raw))===stable(this.policy.next),'CONTINUATION_NOT_VERIFIED');
    }
    return {review,parked:{unstartedPreviousResult:old,unconsumedHistoricalGrant:grant,prior,holds}};
  }
}
