// Exact recovery of the two reviewed short runs. Never a generic session reset.
import assert from 'node:assert/strict';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {protocolPolicy} from './protocol-policy.mjs';
import {receiptKey} from './durable-queue.mjs';
import {stable} from './mongo-writer.mjs';
import {createRequire} from 'node:module';
const {XMLParser}=createRequire(import.meta.url)('../../collector/node_modules/fast-xml-parser');
const xmlParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});

export function sessionPolicy(gameId) {
  const policy={
    32739:{id:'invalid-session-36492435648-20260929',runKey:'capture-run:36492435648:1',
      previousProof:'b5ba5397c644c4e611ce5aabea24f34986a1404e176f5c327b1c074b629159d3',abandon:[2,4]},
    32836:{id:'unstarted-36492439112-20260929',runKey:'capture-run:36492439112:1',
      previousProof:'9c82aee7541428ecc2b44d4b8158a0aa933ae6879cbf8e6609b4e377c08b4533',abandon:[]}
  }[gameId];
  assert(policy,'WRONG_SESSION_INCIDENT');return {...protocolPolicy(gameId),...policy};
}

export function reviewSessionIncident({profile,plan,snapshot,previous,now=Date.now()}) {
  const policy=sessionPolicy(plan.gameId),{campaign,pool,batches}=snapshot;
  assert(profile.schema==='sg-session-incident-v1' && profile.id===policy.id && profile.group===policy.group
    && profile.gameId===plan.gameId && stable(profile.abandon)===stable(policy.abandon),'WRONG_SESSION_INCIDENT');
  assert(now>=profile.createdAt && now-profile.createdAt<2*60*60000,'INCIDENT_PROOF_STALE');
  assert(hash(plan)===profile.planHash && plan.phase===1 && plan.buy===0,'PLAN_CHANGED');
  assert(hash(campaign.value)===profile.campaignHash && hash(pool.value)===profile.poolHash,'INCIDENT_STATE_CHANGED');
  const c=campaign.value,p=pool.value;
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===plan.gameId && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.runKey===policy.runKey
    && c.protocolValidation.proofHash===policy.previousProof && c.protocolValidation.commit===profile.previousCommit,'SHORT_STATE_CHANGED');
  assert(c.games.find(g=>g.game_id===plan.gameId)?.status==='active' && !c.games.some(g=>g.status==='ready'),'CAMPAIGN_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===policy.previousProof,'POOL_CHANGED');
  assert(Object.values(p.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===Object.keys(p.workers).length,'SHARED_SESSION');
  assert(batches.length===profile.batches.length && batches.length===p.nextBatchId-1
    && batches.length===previous.batches.length,'BATCHES_CHANGED');
  let complete=0,pending=0,abandoned=0,end=0;
  for(const [i,{value:b}] of batches.entries()) {
    const expected=profile.batches[i],old=previous.batches.find(x=>x.value.id===b.id)?.value;
    assert(b.id===i+1 && expected.id===b.id && hash(b)===expected.hash,'BATCH_CHANGED');
    assert(old && ['id','worker','start','end','sessionHash'].every(k=>old[k]===b[k]),'ORIGINAL_BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    assert(b.worker>=policy.offset && b.worker<policy.offset+20 && p.workers[b.worker]?.sessionHash===b.sessionHash
      && p.workers[b.worker]?.activeBatch?.id===b.id,'SESSION_CHANGED');
    assert(b.leaseUntil<=now && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'BATCH_REQUIRES_REVIEW');
    assert(b.checkpoint===b.journaled && b.journaled===old.journaled && b.start-1<=b.journaled && b.journaled<b.end,'COUNTS_CHANGED');
    complete+=b.journaled-b.start+1;
    if(!b.pending){assert(!old.pending && !b.protocolResume,'PENDING_REMOVED');continue;}
    const q=b.pending,prior=old.pending;pending++;
    assert(prior && q.awaiting===null && prior.awaiting===null && q.sequence===b.journaled+1
      && q.sequence===prior.sequence && q.attempt===prior.attempt && q.raw.startBalanceRaw===prior.raw.startBalanceRaw,'PENDING_CHANGED');
    assert(stable(q.raw.steps.slice(0,prior.raw.steps.length))===stable(prior.raw.steps),'PENDING_PREFIX_CHANGED');
    if(policy.abandon.includes(b.id)) {
      const tail=q.raw.steps.at(-1);
      assert(!b.protocolResume && q.raw.steps.length===prior.raw.steps.length+1 && tail.msgId==='FREE_GAME'
        && tail.sourceRejected===true && tail.responsePayload==='&MSGID=ERROR&EID=ERROR_INVALID_SESSION&'
        && hash(q)===expected.pendingHash,'NOT_REVIEWED_INVALID_SESSION');
      assert(typeof tail.responseXml==='string' && tail.responseXml.length<=262144
        && !/<!DOCTYPE|<!ENTITY/i.test(tail.responseXml),'REJECTION_XML_INVALID');
      const root=xmlParser.parse(tail.responseXml).GDMRESPONSE;
      assert(root && String(root.SUCCESS).toLowerCase()==='true' && root.PAYLOAD===tail.responsePayload,'REJECTION_XML_MISMATCH');
      abandoned++;
    } else {
      assert(stable(q)===stable(prior) && b.protocolResume?.proofHash===policy.previousProof
        && b.protocolResume.pendingHash===hash(q),'UNCONSUMED_PENDING_CHANGED');
    }
  }
  assert(end+1===p.nextSequence && complete===policy.complete && complete===profile.complete
    && pending===policy.pending && abandoned===policy.abandon.length,'COUNTS_CHANGED');
  return {complete,pending,abandoned,preserved:pending-abandoned};
}

export class SessionRecovery extends ProtocolRecovery {
  constructor(args) {
    const policy=protocolPolicy(args.plan.gameId);
    super({...args,profile:{...args.profile,id:policy.id}});
    this.profile=args.profile;this.session=sessionPolicy(args.plan.gameId);
    this.prefix='session-incident:'+this.session.id;
    this.originalPrefix='protocol:'+policy.id;
    this.recovering=false;
  }
  async boundary() {
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds');
    assert(holds.length===2 && new Set(holds.map(x=>x._id)).size===2,'HOLD_SCOPE_CHANGED');
    const primary=holds.find(x=>x._id==='primary/global-hold'),secondary=holds.find(x=>x._id==='secondary/global-hold');
    assert(primary && secondary && secondary.value.active===false,'GLOBAL_HOLD');
    if(this.recovering && this.profile.group==='primary') {
      assert(hash(primary.value)===this.profile.primaryHoldHash && hash(secondary.value)===this.profile.secondaryHoldHash
        && primary.value.active===true && primary.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
        && primary.value.details?.code==='SOURCE_REJECTED' && primary.value.details.trialId===this.plan.trialId
        && primary.value.details.batchId===4 && !primary.value.details.cooldownUntil,'UNREVIEWED_HOLD');
    } else {
      assert(primary.value.active===false,'GLOBAL_HOLD');
      if(this.recovering)assert(primary.value.sessionRecoveryId===sessionPolicy(32739).id
        && hash(secondary.value)===this.profile.secondaryHoldHash,'PRIMARY_REVIEW_REQUIRED');
    }
    return holds;
  }
  async recover() {
    this.recovering=true;
    try {
      const holds=await this.boundary(),s=await this.snapshots();
      assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');
      const oldProof=(await this.store.get('journal',this.originalPrefix+':proof'))?.value;
      const previous=(await this.store.get('journal',this.originalPrefix+':before'))?.value;
      assert(oldProof?.proofHash===this.session.previousProof && previous,'PREVIOUS_PROOF_CHANGED');
      assert(hash(previous)===this.profile.previousSnapshotHash,'PREVIOUS_BACKUP_CHANGED');
      const review=x=>reviewSessionIncident({profile:this.profile,plan:this.plan,snapshot:x,previous,now:this.now()});
      const reviewed=review(s);
      for(const {value:b} of s.batches)if(b.pending) {
        const raw=this.session.abandon.includes(b.id)?previous.batches.find(x=>x.value.id===b.id).value.pending.raw:b.pending.raw;
        assert(stable(await this.parser.call({op:'next',plan:this.plan,raw}))===stable(this.policy.next),'CONTINUATION_CHANGED');
      }
      const full=await this.verifyRecords(s,{allCommitted:true});assert(full.count===this.profile.complete,'COUNTS_CHANGED');
      // Every complete old record is still byte-for-byte the original recovery backup.
      for(const {value:b} of s.batches) {
        const old=(await this.store.get('journal',`${this.originalPrefix}:records:${b.id}`))?.value.records;
        assert(Array.isArray(old),'BACKUP_MISSING');
        if(old.length){const rows=await this.store.getMany('journal',old.map(r=>receiptKey(this.plan.trialId,r.sequence)));
          assert(rows.every((r,i)=>r && stable(r.value)===stable(old[i])),'OLD_RECORDS_CHANGED');}
      }
      await this.boundary();const fresh=await this.snapshots();review(fresh);assert(hash(fresh)===hash(s),'STATE_CHANGED');
      const proof={schema:'sg-invalid-session-recovery-v1',profileHash:hash(this.profile),snapshotHash:hash(s),
        verified:full,reviewed,commit:this.commit,createdAt:this.now()},proofHash=hash(proof);
      await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
      await this.store.create('journal',this.prefix+':before',{...s,holds,previous},{immutable:true});
      assert(stable(await this.verifyRecords(s,{allCommitted:true,backup:true}))===stable(full),'BACKUP_CHANGED');
      for(const {value:b} of s.batches)if(this.session.abandon.includes(b.id))
        await this.store.create('journal',`${this.prefix}:abandoned:${b.id}`,{proofHash,worker:b.worker,sessionHash:b.sessionHash,
          disposition:'source-invalid-session/abandon_without_replay',pending:b.pending},{immutable:true});
      await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      const kept=s.batches.filter(x=>!this.session.abandon.includes(x.value.id));
      const grant=protocolGrant({plan:this.plan,batches:kept,proofHash,commit:this.commit,now:this.now()});
      await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});
      for(const {value:b} of s.batches)await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{
        assert(hash(v)===hash(b),'BATCH_CHANGED');const pending=this.session.abandon.includes(b.id)?null:v.pending;
        return {...v,pending,owner:null,epoch:v.epoch+1,leaseUntil:0,protocolRecovery:proofHash,
          protocolResume:pending?{proofHash,pendingHash:hash(pending)}:null,
          ...(this.session.abandon.includes(b.id)?{abandonedAttemptProof:proofHash}:{})};
      });
      const after=await this.snapshots(),verified=await this.verifyRecords(after,{allCommitted:true});
      assert(stable(verified)===stable(full),'VALID_RECORDS_CHANGED');
      const result={proofHash,...full,originalPendingPreserved:reviewed.preserved,abandonedAttempts:reviewed.abandoned,
        grantExpiresAt:grant.expiresAt,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
      await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});
      await this.boundary();
      await this.store.update('state',this.poolKey,v=>{
        assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');
        for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}
        return {...v,protocolRecovery:proofHash};
      });
      await this.store.update('state','campaign',v=>{
        assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');
        return {...v,protocolValidation:{phase:'short',gameId:this.plan.gameId,proofHash,commit:this.commit,runKey:null}};
      });
      await this.boundary();
      if(this.profile.group==='primary')await this.store.update('state','global-hold',v=>{
        assert(hash(v)===this.profile.primaryHoldHash,'HOLD_CHANGED');
        return {...v,active:false,reason:null,sessionRecoveryId:this.session.id,sessionRecoveryProof:proofHash};
      });
      return {...result,validationLimit:10};
    } finally {this.recovering=false;}
  }
  async validate() {
    const {s,base}=await this.reviewedShort();
    assert(!(await this.store.get('journal',this.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
    const full=await this.verifyRecords(s,{allCommitted:true});
    assert(full.count===this.profile.complete+200 && Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
    for(let w=this.policy.offset;w<this.policy.offset+20;w++)assert(full.workerCounts[w]-(base.workerCounts[w]||0)===10,'SHORT_WORKER_COUNT_CHANGED');
    const before=(await this.store.get('journal',this.prefix+':before')).value;
    let resumed=0,replaced=0,special=false;
    for(const {value:b} of before.batches) {
      const after=s.batches.find(x=>x.value.id===b.id)?.value;
      assert(after && ['id','worker','start','end','sessionHash'].every(k=>after[k]===b[k]) && after.epoch>b.epoch,'ORIGINAL_BATCH_CHANGED');
      const old=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
      if(old.length){const rows=await this.store.getMany('journal',old.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(rows.every((r,i)=>r && stable(r.value)===stable(old[i])),'OLD_RECORDS_CHANGED');}
      if(!b.pending)continue;
      const r=(await this.store.get('journal',receiptKey(this.plan.trialId,b.pending.sequence)))?.value;
      assert(r && r.shardId===b.worker && r.batchId===b.id && r.sourceSessionHash===b.sessionHash
        && r.raw.steps.filter(x=>x.msgId==='BET').length===1,'RESUMED_IDENTITY_CHANGED');
      if(this.session.abandon.includes(b.id)) {
        const archived=(await this.store.get('journal',`${this.prefix}:abandoned:${b.id}`))?.value;
        assert(archived?.proofHash===base.proofHash && stable(archived.pending)===stable(b.pending)
          && r.attempt!==b.pending.attempt && r.raw.steps[0].ts>new Date(base.at).toISOString(),'ABANDONED_ATTEMPT_REPLAYED');
        replaced++;continue;
      }
      assert(r.attempt===b.pending.attempt && r.raw.startBalanceRaw===b.pending.raw.startBalanceRaw
        && r.raw.steps.length>b.pending.raw.steps.length && stable(r.raw.steps.slice(0,b.pending.raw.steps.length))===stable(b.pending.raw.steps),'PENDING_PREFIX_CHANGED');
      if(b.id===this.policy.specialBatch && b.pending.sequence===this.policy.specialSequence) {
        assert(r.bonus===2,'NATURAL_FEATURE_SETTLEMENT_MISSING');
        if(this.plan.gameId===32836)assert(r.raw.steps.map(x=>x.msgId).join(',')==='BET,FEATURE_START,FEATURE_PICK,FEATURE_END','FOAM_SETTLEMENT_MISSING');
        special=true;
      }
      resumed++;
    }
    assert(resumed===this.policy.pending-this.session.abandon.length && replaced===this.session.abandon.length && special,'ORIGINAL_PENDING_NOT_SETTLED');
    await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
    const result={proofHash:base.proofHash,fullReadback:full.count,oldPreserved:this.profile.complete,newComplete:200,
      originalPendingSettled:resumed,replacementAttemptsSettled:replaced,liveNaturalFeatureSettlementVerified:true,
      pending:0,poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};
    await this.store.create('journal',this.prefix+':validation',result,{immutable:true});return result;
  }
  async formal() {
    const {s,base}=await this.reviewedShort(),v=(await this.store.get('journal',this.prefix+':validation'))?.value;
    assert(v?.proofHash===base.proofHash && v.fullReadback===this.profile.complete+200 && v.liveNaturalFeatureSettlementVerified
      && v.originalPendingSettled===this.policy.pending-this.session.abandon.length && v.replacementAttemptsSettled===this.session.abandon.length
      && v.poolHash===hash(s.pool.value) && v.campaignHash===hash(s.campaign.value)
      && this.now()>=v.at && this.now()-v.at<15*60000,'VALIDATION_STALE_OR_CHANGED');
    await this.store.create('journal',this.prefix+':formal',{validation:v,at:this.now(),commit:this.commit},{immutable:true});
    await this.store.update('state','campaign',c=>{assert(hash(c)===v.campaignHash,'CAMPAIGN_CHANGED');return {...c,validationLimit:0,protocolValidation:null};});
    return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
  }
}
