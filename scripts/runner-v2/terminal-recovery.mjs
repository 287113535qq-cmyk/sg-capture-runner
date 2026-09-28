// Exact already-received Foam END reconciliation. This module has no SG client.
import assert from 'node:assert/strict';
import {SessionRecovery} from './session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';

export function terminalPolicy(gameId){
  const p={
    32739:{id:'demon-after-foam-end-36495948701',group:'primary',beforeCount:164,checkpoint:164,count:164,pending:4,terminalBatch:null,
      previousProof:'922baf840c37342a2fb0125712cd727fe59be519b283a1066ab1b726959954bb',runKey:null},
    32836:{id:'foam-end-36495948701',group:'secondary',beforeCount:72,checkpoint:62,count:73,pending:1,terminalBatch:1,
      previousProof:'ab5e7634aa159e0df2aef22ad9ac535a11a488de9601bcbba717ce3e2a1ee5e8',runKey:'capture-run:36495948701:1'}
  }[gameId];assert(p,'WRONG_TERMINAL_INCIDENT');return p;
}

export function reviewTerminalIncident({plan,profile,s,now=Date.now()}){
  const policy=terminalPolicy(plan.gameId),c=s.campaign.value,p=s.pool.value;
  assert(profile.schema==='sg-terminal-incident-v1' && profile.id===policy.id && profile.group===policy.group
    && profile.complete===policy.count && profile.gameId===plan.gameId,'WRONG_TERMINAL_INCIDENT');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(hash(plan)===profile.planHash && plan.phase===1 && plan.buy===0,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash,'INCIDENT_STATE_CHANGED');
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===plan.gameId && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.proofHash===policy.previousProof
    && c.protocolValidation.commit===profile.previousCommit && c.protocolValidation.runKey===policy.runKey,'SHORT_STATE_CHANGED');
  assert(c.games.find(g=>g.game_id===plan.gameId)?.status==='active' && !c.games.some(g=>g.status==='ready'),'CAMPAIGN_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===policy.previousProof,'POOL_CHANGED');
  assert(Object.values(p.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===Object.keys(p.workers).length,'SHARED_SESSION');
  assert(s.batches.length===profile.batches.length && s.batches.length===p.nextBatchId-1,'BATCHES_CHANGED');
  let end=0,complete=0,checkpoint=0,pending=0;
  for(const [i,{value:b}] of s.batches.entries()){
    const expected=profile.batches[i],terminal=b.id===policy.terminalBatch;
    assert(b.id===i+1 && expected.id===b.id && hash(b)===expected.hash,'BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    const offset=policy.group==='primary'?0:20;
    assert(b.worker>=offset && b.worker<offset+20 && p.workers[b.worker]?.sessionHash===b.sessionHash,'SESSION_CHANGED');
    assert(b.leaseUntil<=now && !b.bootstrapAwaiting && !b.pendingOriginal,'UNKNOWN_SOURCE_OUTCOME');
    assert(b.failure===(terminal?'RESPONSE_VALIDATION_REQUIRES_REVIEW':null),'OTHER_BATCH_FAILURE');
    assert(b.start-1<=b.checkpoint && b.checkpoint<=b.journaled && b.journaled<=b.end,'CHECKPOINT_CHANGED');
    complete+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(!b.pending){assert(!b.protocolResume,'RESUME_WITHOUT_PENDING');continue;}
    const q=b.pending;pending++;
    assert(q.awaiting===null && q.sequence===b.journaled+1 && hash(q)===expected.pendingHash
      && q.raw.steps.length>0 && q.raw.steps.every(x=>!x.sourceRejected),'PENDING_CHANGED');
    if(terminal){
      assert(b.worker===23 && q.sequence===20 && !b.protocolResume
        && q.raw.steps.map(x=>x.msgId).join(',')==='BET,FEATURE_START,FEATURE_PICK,FEATURE_END','TERMINAL_CHANGED');
      assert(hash(q.raw)===profile.terminalRawHash,'TERMINAL_CHANGED');
    }else assert(b.protocolResume?.proofHash===policy.previousProof && b.protocolResume.pendingHash===hash(q),'ORIGINAL_PENDING_CHANGED');
  }
  assert(end+1===p.nextSequence && complete===policy.beforeCount && checkpoint===policy.checkpoint
    && pending===policy.pending+(policy.terminalBatch===null?0:1),'COUNTS_CHANGED');
  return {complete,checkpoint,pending};
}

export class TerminalRecovery extends SessionRecovery{
  constructor(args){
    super(args);this.terminal=terminalPolicy(args.plan.gameId);this.prefix='terminal-incident:'+this.terminal.id;
    this.policy={...this.policy,pending:this.terminal.pending};this.session={...this.session,abandon:[]};
    this.normalize=args.normalize;
  }
  async boundary(){
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds');
    assert(holds.length===2,'HOLD_SCOPE_CHANGED');
    const a=holds.find(x=>x._id==='primary/global-hold'),b=holds.find(x=>x._id==='secondary/global-hold');
    assert(a?.value.active===false && b,'GLOBAL_HOLD');
    if(this.recovering && this.profile.group==='secondary'){
      assert(hash(a.value)===this.profile.primaryHoldHash && hash(b.value)===this.profile.secondaryHoldHash
        && b.value.active===true && b.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
        && b.value.details?.code==='FOAM_MISSING_END_COUNTERS' && b.value.details.batchId===1
        && b.value.details.trialId===this.plan.trialId && !b.value.details.cooldownUntil,'UNREVIEWED_HOLD');
    }else{
      assert(b.value.active===false,'GLOBAL_HOLD');
      if(this.recovering)assert(b.value.terminalRecoveryId===terminalPolicy(32836).id,'SECONDARY_REVIEW_REQUIRED');
    }
    return holds;
  }
  async recover(){
    this.recovering=true;
    try{
      const holds=await this.boundary(),s=await this.snapshots(),review=x=>reviewTerminalIncident({plan:this.plan,profile:this.profile,s:x,now:this.now()});
      assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');review(s);
      const priorGrant=(await this.store.get('journal','protocol-resume:'+this.terminal.previousProof))?.value;
      assert(priorGrant && hash(priorGrant)===this.profile.previousGrantHash,'PREVIOUS_GRANT_CHANGED');
      for(const {value:b} of s.batches)if(b.pending && b.id!==this.terminal.terminalBatch){
        const granted=priorGrant.batches.find(x=>x.id===b.id);
        assert(granted && granted.pendingHash===hash(b.pending) && granted.worker===b.worker
          && granted.sessionHash===b.sessionHash,'ORIGINAL_GRANT_CHANGED');
        assert(stable(await this.parser.call({op:'next',plan:this.plan,raw:b.pending.raw}))===stable(this.policy.next),'CONTINUATION_CHANGED');
      }
      let record=null;
      if(this.terminal.terminalBatch!==null){
        const b=s.batches.find(x=>x.value.id===this.terminal.terminalBatch).value,q=b.pending;
        assert(await this.parser.call({op:'next',plan:this.plan,raw:q.raw})===null,'TERMINAL_NOT_SETTLED');
        record=await this.parser.call({op:'record',plan:this.plan,raw:q.raw,normalized:await this.normalize(q.raw),
          sequence:q.sequence,attempt:q.attempt,sessionHash:b.sessionHash,worker:b.worker,batchId:b.id});
        assert(record.bonus===2 && record.normalized.money.betRaw===25 && record.normalized.money.totalWinRaw===350,'TERMINAL_MONEY_CHANGED');
        assert(!(await this.store.get('journal',receiptKey(this.plan.trialId,q.sequence))),'TERMINAL_ALREADY_JOURNALED');
      }
      const old=await this.verifyRecords(s);assert(old.count===this.terminal.beforeCount && old.committed===this.terminal.checkpoint,'COUNTS_CHANGED');
      await this.boundary();const fresh=await this.snapshots();review(fresh);assert(hash(fresh)===hash(s),'STATE_CHANGED');
      const proof={schema:'sg-terminal-reconcile-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified:old,
        terminalRecordHash:record?hash(record):null,commit:this.commit,createdAt:this.now()},proofHash=hash(proof);
      await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
      await this.store.create('journal',this.prefix+':incident-before',{...s,holds,priorGrant},{immutable:true});
      assert(stable(await this.verifyRecords(s,{backup:true}))===stable(old),'BACKUP_CHANGED');
      if(record)await this.store.create('journal',this.prefix+':terminal-record',{record},{immutable:true});
      await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:old.recordsHash},{immutable:true});
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      for(const {value:b} of s.batches){
        const key=`batch:${this.plan.trialId}:${b.id}`,epoch=b.epoch+1;
        await this.store.update('state',key,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,owner:this.owner,epoch,leaseUntil:0};});
        const queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:key,owner:this.owner,epoch});
        if(b.id===this.terminal.terminalBatch){
          await queue.append(record);
          await this.store.update('state',key,v=>{
            assert(v.owner===this.owner && v.epoch===epoch && hash(v.pending)===hash(b.pending),'TERMINAL_CHANGED');
            return {...v,pending:null,journaled:record.sequence,failure:null,protocolResume:null};
          });
        }
        const writer=new MongoWriter({gate:this.gate,queue,permits:new WritePermits({store:this.store,group:this.profile.group,owner:this.owner,now:this.now}),sink:{
          read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
        while(true){const rows=await queue.outstanding();if(!rows.length)break;await this.boundary();const r=await writer.deliver(rows);if(r.paused)await this.sleep(1000);}
        await this.store.update('state',key,v=>{assert(v.owner===this.owner && v.epoch===epoch && v.journaled===v.checkpoint,'RECONCILE_CHANGED');return {...v,owner:null};});
      }
      const after=await this.snapshots(),full=await this.verifyRecords(after,{allCommitted:true});assert(full.count===this.terminal.count,'RECONCILE_COUNT_CHANGED');
      // Original 236 records were copied before any mutation. Compare those
      // copies, including records that only became committed during this run.
      for(const {value:b} of s.batches){
        const rows=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
        const current=rows.length?await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence))):[];
        assert(current.every((x,i)=>stable(x.value)===stable(rows[i])),'OLD_RECORDS_CHANGED');
      }
      await this.store.create('journal',this.prefix+':before',after,{immutable:true});
      const grant=protocolGrant({plan:this.plan,batches:after.batches,proofHash,commit:this.commit,now:this.now()});
      await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});
      for(const {value:b} of after.batches)await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{
        assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch:v.epoch+1,protocolRecovery:proofHash,
          protocolResume:v.pending?{proofHash,pendingHash:hash(v.pending)}:null};
      });
      const result={proofHash,...full,oldPreserved:old.count,terminalSettled:record?1:0,originalPendingPreserved:this.terminal.pending,
        grantExpiresAt:grant.expiresAt,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
      await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});
      await this.boundary();
      await this.store.update('state',this.poolKey,v=>{
        assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}
        return {...v,protocolRecovery:proofHash};
      });
      await this.store.update('state','campaign',v=>{assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');return {...v,
        protocolValidation:{phase:'short',gameId:this.plan.gameId,proofHash,commit:this.commit,runKey:null}};});
      await this.boundary();
      if(this.profile.group==='secondary')await this.store.update('state','global-hold',v=>{
        assert(hash(v)===this.profile.secondaryHoldHash,'HOLD_CHANGED');return {...v,active:false,reason:null,terminalRecoveryId:this.terminal.id,terminalRecoveryProof:proofHash};
      });
      return {...result,validationLimit:10};
    }finally{this.recovering=false;}
  }
  async validate(){
    if(this.profile.group==='secondary'){
      const record=(await this.store.get('journal',this.prefix+':terminal-record'))?.value.record;
      assert(record && stable((await this.store.get('journal',receiptKey(this.plan.trialId,20)))?.value)===stable(record),'TERMINAL_RECORD_CHANGED');
    }else{
      for(const id of [2,4]){
        const archived=(await this.store.get('journal',`session-incident:invalid-session-36492435648-20260929:abandoned:${id}`))?.value;
        assert(archived,'ABANDONED_BACKUP_MISSING');const old=archived.pending;
        const row=(await this.store.get('journal',receiptKey(this.plan.trialId,old.sequence)))?.value;
        const base=(await this.store.get('journal',this.prefix+':reconciled')).value;
        assert(row && row.attempt!==old.attempt && row.raw.steps[0].ts>new Date(base.at).toISOString(),'ABANDONED_ATTEMPT_REPLAYED');
      }
    }
    return super.validate();
  }
}
