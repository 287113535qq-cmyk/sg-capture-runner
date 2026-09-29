// The original FID1 grant was not consumed: controller compared against legacy CFG2.
// Rebind only this observed no-source claim failure after preserving all380 records.
import assert from 'node:assert/strict';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash,reviewProtocolResume} from './protocol-resume.mjs';
import {stable} from './mongo-writer.mjs';
import {quarterbackNextRequest} from '../trial/quarterback-protocol.mjs';
export const PICK_CLAIM={id:'pick-claim-36505910982',proof:'9484c5ba3f7e6411e91b23ee120f866101537f4f0a5b18bac6222765ca712136',
 commit:'8f60217767018a79f1fb02f94130ff7c4304b46b',runKey:'capture-run:36505910982:1'};
export function reviewPickClaim({s,plan,profile,old,grant,now=Date.now()}){
 const c=s.campaign.value,p=s.pool.value,k=PICK_CLAIM,q=s.batches.find(x=>x.value.id===11)?.value;
 assert(profile.schema==='sg-pick-claim-rebind-v1' && profile.id===k.id && profile.group==='secondary' && profile.gameId===32836
  && profile.complete===380 && profile.checkpoint===380 && profile.pending===1,'WRONG_CLAIM_SCENE');
 assert(now>=profile.createdAt && now-profile.createdAt<7200000 && plan.gameId===32836 && plan.buy===0 && plan.phase===1,'STALE_OR_WRONG_PLAN');
 assert(hash(plan)===profile.planHash && hash(c)===profile.campaignHash && hash(p)===profile.poolHash,'STATE_CHANGED');
 assert(c.enabled && !c.reason && !c.audit && c.activeGame===32836 && c.validationLimit===10
  && c.protocolValidation?.phase==='short' && c.protocolValidation.proofHash===k.proof && c.protocolValidation.commit===k.commit
  && c.protocolValidation.runKey===k.runKey && c.games.find(g=>g.game_id===32836)?.status==='active'
  && !c.games.some(g=>g.status==='ready'),'SHORT_CHANGED');
 assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===k.proof,'POOL_CHANGED');
 assert(Object.values(p.workers).every(w=>w.leaseUntil<=now) && new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===20,'WORKERS_ACTIVE_OR_CHANGED');
 assert(old?.proofHash===k.proof && old.count===190 && old.committed===190 && hash(grant)===profile.previousGrantHash,'PRIOR_RECOVERY_CHANGED');
 assert(s.batches.length===20 && p.nextBatchId===21 && profile.batches.length===20,'BATCH_COUNT_CHANGED');
 let count=0,end=0,pending=0;
 for(const [i,{value:b}] of s.batches.entries()){
  assert(b.id===i+1 && profile.batches[i].id===b.id && hash(b)===profile.batches[i].hash,'BATCH_CHANGED');
  const w=p.workers[b.worker];assert(b.worker>=20 && b.worker<40 && w?.sessionHash===b.sessionHash && w.activeBatch?.id===b.id,'SESSION_CHANGED');
  assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
  assert(b.start-1<=b.journaled && b.journaled<b.end && b.journaled===b.checkpoint && b.leaseUntil<=now
   && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'BATCH_REQUIRES_REVIEW');count+=b.journaled-b.start+1;
  if(!b.pending){assert(!b.protocolResume,'EXTRA_GRANT');continue;}pending++;
  assert(b.id===11 && b.worker===38 && b.pending.sequence===1008 && b.pending.awaiting===null && b.pending.raw.steps.length===1
   && b.pending.raw.steps[0].msgId==='BET' && !b.pending.raw.steps[0].sourceRejected
   && hash(b.pending)===profile.pendingHash && b.protocolResume?.proofHash===k.proof,'ORIGINAL_PENDING_CHANGED');
  reviewProtocolResume({plan,batch:b,grant,worker:38,sessionHash:b.sessionHash,commit:k.commit,now});
 }
 assert(end+1===p.nextSequence && count===380 && pending===1 && q,'COUNT_CHANGED');
}
export class PickClaimRecovery extends ProtocolRecovery{
 constructor(args){super({...args,profile:{...args.profile,id:'quarterback-32836-20260929'}});this.profile=args.profile;this.prefix='pick-claim:'+PICK_CLAIM.id;
  this.policy={...this.policy,complete:380,pending:1,specialBatch:11,specialSequence:1008,specialBonus:3,next:{MSGID:'FEATURE_START',CFG:'1'}};}
 async reviewRecovery(s,holds){
  const old=(await this.store.get('journal','pick-bonus:pick-bonus-36502517559:reconciled'))?.value;
  const grant=(await this.store.get('journal','protocol-resume:'+PICK_CLAIM.proof))?.value;
  const review=x=>reviewPickClaim({s:x,plan:this.plan,profile:this.profile,old,grant,now:this.now()});review(s);
  const raw=s.batches.find(x=>x.value.id===11).value.pending.raw;
  assert(stable(await this.parser.call({op:'next',plan:this.plan,raw}))===stable(this.policy.next)
   && stable(quarterbackNextRequest(raw))===stable(this.policy.next),'CONTINUATION_NOT_VERIFIED');
  return {review,parked:{previousShort:PICK_CLAIM.runKey,previousRecovery:old,unconsumedGrant:grant,holds}};
 }
}
