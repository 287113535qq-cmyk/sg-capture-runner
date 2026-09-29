// One reviewed FEATURE_START rejection. No source client and no generic reset.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
const {XMLParser}=createRequire(import.meta.url)('../../collector/node_modules/fast-xml-parser');
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
export const FOAM_SESSION={id:'foam-session-36499471583',group:'secondary',gameId:32836,count:118,checkpoint:103,
  previousProof:'4b60c3a4e187ac1e5dedd0465404416a6a52a19f1fb54768f37482b43abcbece',
  previousCommit:'9b637908d7a5ef00f146d435b41e42ace9b7c447',runKey:'capture-run:36499471583:1'};

export function reviewFoamSession({plan,profile,s,prior,now=Date.now()}){
  const c=s.campaign.value,p=s.pool.value,k=FOAM_SESSION;
  assert(profile.schema==='sg-foam-session-incident-v1' && profile.id===k.id && profile.group===k.group
    && profile.gameId===k.gameId && plan.gameId===k.gameId && profile.complete===k.count,'WRONG_FOAM_SESSION_INCIDENT');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(plan.buy===0 && plan.phase===1 && hash(plan)===profile.planHash,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash,'INCIDENT_STATE_CHANGED');
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===32836 && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.proofHash===k.previousProof
    && c.protocolValidation.commit===k.previousCommit && c.protocolValidation.runKey===k.runKey
    && c.games.find(g=>g.game_id===32836)?.status==='active' && !c.games.some(g=>g.status==='ready'),'SHORT_STATE_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===k.previousProof,'POOL_CHANGED');
  assert(Object.values(p.workers).every(w=>w.leaseUntil<=now),'WORKERS_ACTIVE');
  assert(new Set(Object.values(p.workers).map(w=>w.sessionHash)).size===Object.keys(p.workers).length,'SHARED_SESSION');
  assert(s.batches.length===profile.batches.length && s.batches.length===p.nextBatchId-1 && s.batches.length===16,'BATCHES_CHANGED');
  let count=0,checkpoint=0,end=0,pending=0;
  for(const [i,{value:b}] of s.batches.entries()){
    assert(b.id===i+1 && profile.batches[i].id===b.id && hash(b)===profile.batches[i].hash,'BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    assert(b.worker>=20 && b.worker<40 && p.workers[b.worker]?.sessionHash===b.sessionHash,'SESSION_CHANGED');
    assert(b.leaseUntil<=now && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'BATCH_REQUIRES_REVIEW');
    assert(b.start-1<=b.checkpoint && b.checkpoint<=b.journaled && b.journaled<b.end,'CHECKPOINT_CHANGED');
    count+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(!b.pending){assert(!b.protocolResume,'RESUME_WITHOUT_PENDING');continue;}
    pending++;const q=b.pending;
    assert(b.id===2 && b.worker===21 && q.sequence===113 && q.sequence===b.journaled+1 && q.awaiting===null
      && !b.protocolResume && q.raw.steps.length===2 && hash(q)===profile.pendingHash,'UNREVIEWED_PENDING');
    const original=prior.batches.find(x=>x.value.id===2)?.value;
    assert(original && original.worker===b.worker && original.sessionHash===b.sessionHash && original.pending
      && q.attempt===original.pending.attempt && q.raw.startBalanceRaw===original.pending.raw.startBalanceRaw
      && stable(q.raw.steps.slice(0,1))===stable(original.pending.raw.steps),'ORIGINAL_PREFIX_CHANGED');
    const tail=q.raw.steps[1];
    assert(q.raw.steps[0].msgId==='BET' && !q.raw.steps[0].sourceRejected && tail.msgId==='FEATURE_START'
      && tail.sourceRejected===true && tail.responsePayload==='&MSGID=ERROR&EID=ERROR_INVALID_SESSION&','NOT_REVIEWED_INVALID_SESSION');
    assert(typeof tail.responseXml==='string' && tail.responseXml.length<=262144 && !/<!DOCTYPE|<!ENTITY/i.test(tail.responseXml),'REJECTION_XML_INVALID');
    const root=xml.parse(tail.responseXml).GDMRESPONSE;
    assert(root && String(root.SUCCESS).toLowerCase()==='true' && root.PAYLOAD===tail.responsePayload,'REJECTION_XML_MISMATCH');
  }
  assert(end+1===p.nextSequence && count===k.count && checkpoint===k.checkpoint && pending===1,'COUNTS_CHANGED');
  return {count,checkpoint,pending};
}

export class FoamSessionRecovery extends ProtocolRecovery{
  constructor(args){
    super({...args,profile:{...args.profile,id:'quarterback-32836-20260929'}});
    this.profile=args.profile;this.prefix='foam-session:'+FOAM_SESSION.id;this.recovering=false;
    this.oldPrefix='terminal-incident:foam-end-36495948701';
  }
  async boundary(){
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds'),a=holds.find(x=>x._id==='primary/global-hold'),b=holds.find(x=>x._id==='secondary/global-hold');
    assert(holds.length===2 && a?.value.active===false && b,'GLOBAL_HOLD');
    if(this.recovering)assert(hash(a.value)===this.profile.primaryHoldHash && hash(b.value)===this.profile.secondaryHoldHash
      && b.value.active===true && b.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
      && b.value.details?.code==='SOURCE_REJECTED' && b.value.details.batchId===2
      && b.value.details.trialId===this.plan.trialId && !b.value.details.cooldownUntil,'UNREVIEWED_HOLD');
    else assert(b.value.active===false,'GLOBAL_HOLD');
    return holds;
  }
  async foamEvidence(){
    const backup=(await this.store.get('journal',this.oldPrefix+':terminal-record'))?.value.record;
    const r=(await this.store.get('journal',receiptKey(this.plan.trialId,20)))?.value;
    assert(r && backup && stable(r)===stable(backup) && hash(r)===this.profile.foamRecordHash,'FOAM_EVIDENCE_CHANGED');
    assert(r.bonus===2 && r.normalized.money.betRaw===25 && r.normalized.money.totalWinRaw===350
      && r.raw.steps.map(x=>x.msgId).join(',')==='BET,FEATURE_START,FEATURE_PICK,FEATURE_END','FOAM_SETTLEMENT_MISSING');
    await this.parser.call({op:'verify',plan:this.plan,raw:r.raw,record:r});
    const rows=await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:[r._id]});
    assert(rows.length===1 && stable(rows[0])===stable(r),'FOAM_FULL_MONGO_MISMATCH');return hash(r);
  }
  async recover(){
    this.recovering=true;
    try{
      const holds=await this.boundary(),s=await this.snapshots();
      assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');
      const prior=(await this.store.get('journal',this.oldPrefix+':before'))?.value;
      const oldProof=(await this.store.get('journal',this.oldPrefix+':proof'))?.value;
      assert(prior && hash(prior)===this.profile.priorHash && oldProof?.proofHash===FOAM_SESSION.previousProof,'PRIOR_PROOF_CHANGED');
      const review=x=>reviewFoamSession({plan:this.plan,profile:this.profile,s:x,prior,now:this.now()});review(s);
      const foamHash=await this.foamEvidence(),full=await this.verifyRecords(s);
      assert(full.count===118 && full.committed===103,'COUNTS_CHANGED');
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      const proof={schema:'sg-foam-session-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified:full,foamHash,commit:this.commit,createdAt:this.now()},proofHash=hash(proof);
      await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
      await this.store.create('journal',this.prefix+':before',{...s,holds,prior},{immutable:true});
      assert(stable(await this.verifyRecords(s,{backup:true}))===stable(full),'BACKUP_CHANGED');
      const rejected=s.batches.find(x=>x.value.id===2).value;
      await this.store.create('journal',this.prefix+':abandoned:2',{proofHash,worker:21,sessionHash:rejected.sessionHash,
        disposition:'source-invalid-session/abandon_without_replay',pending:rejected.pending},{immutable:true});
      await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      // Flush all already complete records before archiving the rejected pending.
      for(const {value:b} of s.batches){
        const key=`batch:${this.plan.trialId}:${b.id}`,epoch=b.epoch+1;
        await this.store.update('state',key,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch,owner:this.owner,leaseUntil:0};});
        const queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:key,owner:this.owner,epoch});
        const writer=new MongoWriter({gate:this.gate,queue,permits:new WritePermits({store:this.store,group:'secondary',owner:this.owner,now:this.now}),sink:{
          read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
        while(true){const rows=await queue.outstanding();if(!rows.length)break;await this.boundary();const r=await writer.deliver(rows);if(r.paused)await this.sleep(1000);}
        await this.store.update('state',key,v=>{assert(v.owner===this.owner && v.epoch===epoch && v.journaled===v.checkpoint
          && hash(v.pending)===hash(b.pending),'RECONCILE_CHANGED');return {...v,owner:null};});
      }
      const after=await this.snapshots(),verified=await this.verifyRecords(after,{allCommitted:true});
      assert(verified.count===118 && verified.recordsHash===full.recordsHash,'VALID_RECORDS_CHANGED');
      await this.foamEvidence();await this.boundary();
      for(const {value:b} of after.batches)await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{
        assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch:v.epoch+1,protocolRecovery:proofHash,protocolResume:null,
          ...(b.id===2?{pending:null,abandonedAttemptProof:proofHash}:{})};
      });
      const result={proofHash,...verified,oldPreserved:118,flushed:15,abandonedAttempts:1,oldPendingSettled:0,liveFoamEvidence:20,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
      await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});
      await this.boundary();
      await this.store.update('state',this.poolKey,v=>{assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');
        for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}return {...v,protocolRecovery:proofHash};});
      await this.store.update('state','campaign',v=>{assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');return {...v,
        protocolValidation:{phase:'short',gameId:32836,proofHash,commit:this.commit,runKey:null}};});
      await this.boundary();
      await this.store.update('state','global-hold',v=>{assert(hash(v)===this.profile.secondaryHoldHash,'HOLD_CHANGED');
        return {...v,active:false,reason:null,foamSessionRecovery:proofHash};});
      return {...result,validationLimit:10};
    }finally{this.recovering=false;}
  }
  async validate(){
    const {s,base}=await this.reviewedShort();
    assert(!(await this.store.get('journal',this.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
    const full=await this.verifyRecords(s,{allCommitted:true});
    assert(full.count===318 && Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
    for(let w=20;w<40;w++)assert(full.workerCounts[w]-(base.workerCounts[w]||0)===10,'SHORT_WORKER_COUNT_CHANGED');
    const before=(await this.store.get('journal',this.prefix+':before')).value;
    for(const {value:b} of before.batches){
      const after=s.batches.find(x=>x.value.id===b.id)?.value;
      assert(after && after.epoch>b.epoch && ['id','worker','start','end','sessionHash'].every(k=>after[k]===b[k]),'ORIGINAL_BATCH_CHANGED');
      const rows=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
      if(rows.length){const got=await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(got.every((x,i)=>x && stable(x.value)===stable(rows[i])),'OLD_RECORDS_CHANGED');}
    }
    const archived=(await this.store.get('journal',this.prefix+':abandoned:2'))?.value;
    const old=before.batches.find(x=>x.value.id===2).value,r=(await this.store.get('journal',receiptKey(this.plan.trialId,113)))?.value;
    assert(archived?.proofHash===base.proofHash && stable(archived.pending)===stable(old.pending)
      && archived.disposition==='source-invalid-session/abandon_without_replay','ARCHIVE_CHANGED');
    assert(r && r.attempt!==old.pending.attempt && r.shardId===21 && r.batchId===2 && r.sourceSessionHash===old.sessionHash
      && r.raw.steps.filter(x=>x.msgId==='BET').length===1 && r.raw.steps[0].ts>new Date(base.at).toISOString(),'ABANDONED_ATTEMPT_REPLAYED');
    await this.foamEvidence();await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
    const result={proofHash:base.proofHash,fullReadback:318,oldPreserved:118,newComplete:200,pending:0,
      abandonedOldPending:1,oldPendingSettled:0,replacementAttemptsSettled:1,liveFoamSettlementVerified:true,liveFoamSequence:20,
      poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};
    await this.store.create('journal',this.prefix+':validation',result,{immutable:true});return result;
  }
  async formal(){
    const {s,base}=await this.reviewedShort(),v=(await this.store.get('journal',this.prefix+':validation'))?.value;
    assert(v?.proofHash===base.proofHash && v.fullReadback===318 && v.oldPendingSettled===0 && v.abandonedOldPending===1
      && v.replacementAttemptsSettled===1 && v.liveFoamSettlementVerified && v.liveFoamSequence===20
      && v.poolHash===hash(s.pool.value) && v.campaignHash===hash(s.campaign.value)
      && this.now()>=v.at && this.now()-v.at<900000,'VALIDATION_STALE_OR_CHANGED');
    await this.foamEvidence();
    await this.store.create('journal',this.prefix+':formal',{validation:v,commit:this.commit,at:this.now()},{immutable:true});
    await this.store.update('state','campaign',c=>{assert(hash(c)===v.campaignHash,'CAMPAIGN_CHANGED');return {...c,validationLimit:0,protocolValidation:null};});
    return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
  }
}
