// GitHub-only operator. The injected transport performs native Mongo I/O only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewParkedProtocol,protocolGrant} from './protocol-recovery-core.mjs';
import {reviewReleasedBatches} from './incident-core.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {protocolPolicy} from './protocol-policy.mjs';

export class ProtocolRecovery {
  constructor({store,transport,gate,parser,plan,profile,githubIdle,commit,owner,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
    Object.assign(this,{store,transport,gate,parser,plan,profile,githubIdle,commit,owner,now,sleep});
    this.prefix='protocol:'+profile.id;this.poolKey='pool:'+plan.trialId;
    this.policy=protocolPolicy(plan.gameId);
    assert(profile.group===this.policy.group && profile.id===this.policy.id && profile.gameId===plan.gameId,'WRONG_PROTOCOL_RECOVERY');
  }
  async boundary(){
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds');
    assert(holds.length===2 && ['primary/global-hold','secondary/global-hold'].every(id=>
      holds.some(x=>x?._id===id && x.value.active===false)),'GLOBAL_HOLD');
    return holds;
  }
  async snapshots(){
    const campaign=await this.store.get('state','campaign'),pool=await this.store.get('state',this.poolKey);
    assert(campaign && pool && pool.value.nextBatchId>0 && pool.value.nextBatchId<=101,'STATE_SCOPE_CHANGED');
    const keys=Array.from({length:pool.value.nextBatchId-1},(_,i)=>`batch:${this.plan.trialId}:${i+1}`);
    const batches=keys.length?await this.store.getMany('state',keys):[];assert(batches.every(Boolean),'BATCH_MISSING');
    return {campaign,pool,batches};
  }
  async verifyRecords(s,{allCommitted=false,backup=false}={}){
    let count=0,committed=0;const d=createHash('sha256'),workerCounts={};
    for(const {value:b} of s.batches){
      assert(b.journaled-b.start+1>=0 && b.journaled-b.start+1<=100,'RECORD_RANGE_CHANGED');
      const keys=Array.from({length:b.journaled-b.start+1},(_,i)=>receiptKey(this.plan.trialId,b.start+i));
      const rows=keys.length?await this.store.getMany('journal',keys):[];assert(rows.every(Boolean),'RECEIPT_MISSING');
      const records=rows.map(x=>x.value);
      const saved=records.length?await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:records.map(r=>r._id)}):[];
      const byId=new Map(saved.map(r=>[r._id,r]));assert(byId.size===saved.length,'READBACK_DUPLICATE');
      for(const [i,r] of records.entries()){
        assert(r.sequence===b.start+i && r.batchId===b.id && r.shardId===b.worker && r.fixtureOnly===false && r.buy===0,'RECORD_IDENTITY_CHANGED');
        assert(r.sourceSessionHash===b.sessionHash && s.pool.value.workers[String(b.worker)]?.sessionHash===b.sessionHash,'SESSION_CHANGED');
        await this.parser.call({op:'verify',plan:this.plan,raw:r.raw,record:r});
        if(byId.has(r._id)){assert(stable(byId.get(r._id))===stable(r),'FULL_MONGO_MISMATCH');committed++;}
        else assert(!allCommitted && r.sequence>b.checkpoint,'CHECKPOINT_WITHOUT_RECORD');
        d.update(stable([r._id,r.contentHash])+'\n');count++;workerCounts[b.worker]=(workerCounts[b.worker]||0)+1;
      }
      if(backup)await this.store.create('journal',`${this.prefix}:records:${b.id}`,{records},{immutable:true});
    }
    let after=0,seen=0;
    while(true){
      const rows=await this.transport.request('rounds_scan',{trialId:this.plan.trialId,after});if(!rows.length)break;
      for(const r of rows){assert(r.sequence>after,'UNORDERED_RECORDS');after=r.sequence;seen++;assert(seen<=count,'EXTRA_OFFICIAL_RECORDS');}
    }
    assert(seen===committed,'EXTRA_OFFICIAL_RECORDS');
    return {count,committed,recordsHash:d.digest('hex'),workerCounts};
  }
  async reviewRecovery(s,holds){
    const parked=(await this.store.get('journal','parked-pool:'+this.plan.trialId))?.value;assert(parked,'PARKED_BACKUP_MISSING');
    const review=x=>reviewParkedProtocol({profile:this.profile,plan:this.plan,campaign:x.campaign.value,pool:x.pool.value,
      batches:x.batches,parked,holds,now:this.now()});
    review(s);
    for(const {value:b} of s.batches){
      const old=(await this.store.get('journal',`parked:${this.plan.trialId}:${b.id}`))?.value;
      assert(old?.poolPlanHash===this.profile.planHash && hash(old.batch)===hash(b),'PARKED_BATCH_CHANGED');
      if(b.pending)assert(stable(await this.parser.call({op:'next',plan:this.plan,raw:b.pending.raw}))===stable(this.policy.next),'CONTINUATION_NOT_VERIFIED');
    }
    return {review,parked};
  }
  async recover(){
    const holds=await this.boundary(),s=await this.snapshots();
    assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');
    const {review,parked}=await this.reviewRecovery(s,holds);
    const verified=await this.verifyRecords(s);
    assert(verified.count===this.profile.complete && verified.committed===this.profile.checkpoint,'COUNTS_CHANGED');
    await this.boundary();const fresh=await this.snapshots();review(fresh);assert(hash(fresh)===hash(s),'STATE_CHANGED');
    const proof={schema:'sg-parked-protocol-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified,
      adapterHash:this.profile.adapterHash,createdAt:this.now(),commit:this.commit},proofHash=hash(proof);
    // Complete private backup first. A partial operator run cannot silently rerun.
    await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
    await this.store.create('journal',this.prefix+':before',{...s,holds,parked},{immutable:true});
    const backed=await this.verifyRecords(s,{backup:true});assert(stable(backed)===stable(verified),'BACKUP_CHANGED');
    await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:verified.recordsHash},{immutable:true});
    await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
    const grant=protocolGrant({plan:this.plan,batches:s.batches,proofHash,commit:this.commit,now:this.now()});
    for(const {value:b} of s.batches){
      const key=`batch:${this.plan.trialId}:${b.id}`,epoch=b.epoch+1;
      await this.store.update('state',key,v=>{
        assert(hash(v)===hash(b),'BATCH_CHANGED');
        return {...v,owner:this.owner,epoch,leaseUntil:0,failure:null,protocolRecovery:proofHash,
          protocolResume:b.pending?{proofHash,pendingHash:hash(b.pending)}:null};
      });
      const queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:key,owner:this.owner,epoch});
      const writer=new MongoWriter({gate:this.gate,queue,permits:new WritePermits({store:this.store,group:this.profile.group,owner:this.owner,now:this.now}),sink:{
        read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),
        insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
      while(true){const rows=await queue.outstanding();if(!rows.length)break;await this.boundary();const result=await writer.deliver(rows);if(result.paused)await this.sleep(1000);}
      await this.store.update('state',key,v=>{
        assert(v.owner===this.owner && v.epoch===epoch && v.journaled===v.checkpoint && hash(v.pending)===hash(b.pending),'RECONCILE_CHANGED');
        return {...v,owner:null};
      });
    }
    const after=await this.snapshots(),full=await this.verifyRecords(after,{allCommitted:true});
    assert(full.recordsHash===verified.recordsHash && full.count===verified.count,'VALID_RECORDS_CHANGED');
    await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});
    const result={proofHash,...full,oldPendingPreserved:this.profile.pending,grantExpiresAt:grant.expiresAt,at:this.now()};
    await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});
    await this.boundary();
    await this.store.update('state',this.poolKey,v=>{
      assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');
      for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}
      return {...v,enabled:true,failure:null,protocolRecovery:proofHash};
    });
    await this.store.update('state','campaign',v=>{
      assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');
      v.games.find(g=>g.game_id===this.plan.gameId).status='active';v.activeGame=this.plan.gameId;v.validationLimit=10;
      v.protocolValidation={phase:'short',gameId:this.plan.gameId,proofHash,commit:this.commit,runKey:null};return v;
    });
    return {...result,sourceRequests:0,deletedRounds:0,replayedBets:0,validationLimit:10};
  }
  async reviewedShort(){
    await this.boundary();const s=await this.snapshots(),base=(await this.store.get('journal',this.prefix+':reconciled'))?.value;
    assert(base && s.pool.value.protocolRecovery===base.proofHash,'RECOVERY_REQUIRED');
    const c=s.campaign.value,p=c.protocolValidation;
    assert(c.enabled && !c.reason && c.activeGame===this.plan.gameId && c.validationLimit===10 && p?.phase==='short'
      && p.proofHash===base.proofHash && p.commit===this.commit && /^capture-run:[0-9]+:[0-9]+$/.test(p.runKey),'SHORT_PHASE_REQUIRED');
    assert(s.pool.value.enabled && !s.pool.value.failure && s.pool.value.planHash===hash(this.plan),'POOL_HALTED');
    let end=0;const sessions=new Set();
    for(const [id,w] of Object.entries(s.pool.value.workers)){
      assert(Number(id)>=this.policy.offset && Number(id)<this.policy.offset+20 && !sessions.has(w.sessionHash),'WORKER_CHANGED');sessions.add(w.sessionHash);
    }
    for(const [i,{value:b}] of s.batches.entries()){
      assert(b.id===i+1 && b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=this.plan.target,'RANGE_CHANGED');end=b.end;
    }
    assert(s.pool.value.nextSequence===end+1,'ALLOCATION_CHANGED');
    reviewReleasedBatches(s.pool.value,s.batches,this.now());
    assert(s.batches.every(x=>!x.value.protocolResume && !x.value.pendingOriginal),'RESUME_GRANT_UNCONSUMED');
    return {s,base};
  }
  async validate(){
    const {s,base}=await this.reviewedShort();
    assert(!(await this.store.get('journal',this.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
    const full=await this.verifyRecords(s,{allCommitted:true});
    assert(full.count===this.profile.complete+200 && Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
    for(let w=this.policy.offset;w<this.policy.offset+20;w++)assert(full.workerCounts[w]-(base.workerCounts[w]||0)===10,'SHORT_WORKER_COUNT_CHANGED');
    const before=(await this.store.get('journal',this.prefix+':before')).value;
    for(const [w,old] of Object.entries(before.pool.value.workers))assert(s.pool.value.workers[w]?.sessionHash===old.sessionHash,'SESSION_CHANGED');
    let resumed=0,specialSettled=false;
    for(const {value:b} of before.batches){
      const after=s.batches.find(x=>x.value.id===b.id)?.value;
      assert(after && ['id','worker','start','end','sessionHash'].every(k=>after[k]===b[k]) && after.epoch>b.epoch,'ORIGINAL_BATCH_CHANGED');
      const originals=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
      assert(Array.isArray(originals),'PRIVATE_BACKUP_INVALID');
      if(originals.length){const current=await this.store.getMany('journal',originals.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(current.every((x,i)=>x && stable(x.value)===stable(originals[i])),'OLD_RECORDS_CHANGED');}
      if(!b.pending)continue;
      const r=(await this.store.get('journal',receiptKey(this.plan.trialId,b.pending.sequence)))?.value;
      assert(r && r.attempt===b.pending.attempt && r.shardId===b.worker && r.batchId===b.id && r.sourceSessionHash===b.sessionHash,'RESUMED_IDENTITY_CHANGED');
      assert(r.raw.startBalanceRaw===b.pending.raw.startBalanceRaw && r.raw.steps.length>b.pending.raw.steps.length
        && stable(r.raw.steps.slice(0,b.pending.raw.steps.length))===stable(b.pending.raw.steps),'PENDING_PREFIX_CHANGED');
      assert(r.raw.steps.filter(x=>x.msgId==='BET').length===1,'BET_REPLAYED');
      if(b.id===this.policy.specialBatch && b.pending.sequence===this.policy.specialSequence){
        assert(r.bonus===(this.policy.specialBonus||2),'NATURAL_FEATURE_SETTLEMENT_MISSING');
        if(this.plan.gameId===32836)assert(r.raw.steps.map(x=>x.msgId).join(',')==='BET,FEATURE_START,FEATURE_PICK,FEATURE_END','FOAM_SETTLEMENT_MISSING');
        specialSettled=true;
      }
      resumed++;
    }
    assert(resumed===this.policy.pending && specialSettled,'ORIGINAL_PENDING_NOT_SETTLED');
    await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
    const result={proofHash:base.proofHash,fullReadback:full.count,oldPreserved:this.profile.complete,newComplete:200,
      originalPendingSettled:resumed,liveNaturalFeatureSettlementVerified:true,
      ...(this.plan.gameId===32739?{liveFidOneSettlementVerified:true}:this.policy.specialBonus===3?{livePickABallSettlementVerified:true}:{liveFoamSettlementVerified:true}),
      pending:0,poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};
    await this.store.create('journal',this.prefix+':validation',result,{immutable:true});return result;
  }
  async formal(){
    const {s,base}=await this.reviewedShort(),p=(await this.store.get('journal',this.prefix+':validation'))?.value;
    assert(p?.proofHash===base.proofHash && p.fullReadback===this.profile.complete+200 && p.originalPendingSettled===this.policy.pending && p.liveNaturalFeatureSettlementVerified
      && p.poolHash===hash(s.pool.value) && p.campaignHash===hash(s.campaign.value) && this.now()>=p.at && this.now()-p.at<15*60000,'VALIDATION_STALE_OR_CHANGED');
    await this.store.create('journal',this.prefix+':formal',{proof:p,at:this.now(),commit:this.commit},{immutable:true});
    await this.store.update('state','campaign',v=>{assert(hash(v)===p.campaignHash,'CAMPAIGN_CHANGED');return {...v,validationLimit:0,protocolValidation:null};});
    return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
  }
}
