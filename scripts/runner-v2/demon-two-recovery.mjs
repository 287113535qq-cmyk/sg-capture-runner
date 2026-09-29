// Exact 36524060044 incident; no source client or session-lifetime assumption.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {DurableQueue,WritePermits,receiptKey} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {pendingFirstPlan,PendingFirst} from './pending-first.mjs';
import {demonNextRequest,demonMapping} from '../trial/demon-protocol.mjs';
const {XMLParser}=createRequire(import.meta.url)('../../collector/node_modules/fast-xml-parser');
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false});
export const DEMON_TWO={id:'demon-two-36524060044',group:'primary',gameId:32739,
  previousProof:'2709a417f24b410b245c4df510c98fdf096977008c1b63a9fa11c01ac35d0936',
  previousCommit:'5369ad3f6e434130221fc3dd1d57e8b6b88dcf19',runKey:'capture-run:36524060044:1',
  oldPrefix:'demon-three:demon-three-36522161320',pending:{2:{worker:1,sequence:117,frames:1},10:{worker:2,sequence:902,frames:1},18:{worker:7,sequence:1706,frames:1}}};

const historicalArchives=[
  {batch:9,worker:13,sequence:806,prefix:'demon-pending-session:demon-pending-session-36518623937',proof:'94370c1435a945301895c81de627c0990763c79a858c3e1144c4d54487fe3635'},
  {batch:5,worker:0,sequence:434,prefix:'demon-three:demon-three-36522161320',proof:DEMON_TWO.previousProof}
];
function sameContinuationRequest(bet,free){
  const a=[...new URLSearchParams(bet)],b=[...new URLSearchParams(free)];
  if(new Set(a.map(x=>x[0])).size!==a.length || new Set(b.map(x=>x[0])).size!==b.length)return false;
  const original=Object.fromEntries(a),next=Object.fromEntries(b);
  return original.MSGID==='BET' && next.MSGID==='FREE_GAME' && stable({...original,MSGID:'FREE_GAME'})===stable(next);
}

export function reviewDemonTwo({plan,profile,s,prior,now=Date.now()}){
  const k=DEMON_TWO,c=s.campaign.value,p=s.pool.value;
  assert(profile.schema==='sg-demon-two-v1' && profile.id===k.id && profile.group==='primary'
    && profile.gameId===32739 && profile.complete===246 && profile.checkpoint===246 && profile.pending===3,'WRONG_DEMON_TWO');
  assert(now>=profile.createdAt && now-profile.createdAt<7200000,'INCIDENT_PROOF_STALE');
  assert(plan.gameId===32739 && plan.phase===1 && plan.buy===0 && hash(plan)===profile.planHash,'PLAN_CHANGED');
  assert(hash(c)===profile.campaignHash && hash(p)===profile.poolHash && hash(prior)===profile.priorHash,'INCIDENT_STATE_CHANGED');
  assert(c.enabled && !c.reason && !c.audit && c.activeGame===32739 && c.validationLimit===10
    && c.protocolValidation?.phase==='short' && c.protocolValidation.pendingFirst===profile.previousStageHash
    && c.protocolValidation.proofHash===k.previousProof && c.protocolValidation.commit===k.previousCommit
    && c.protocolValidation.runKey===k.runKey && c.games.find(g=>g.game_id===32739)?.status==='active'
    && !c.games.some(g=>g.status==='ready'),'SHORT_STATE_CHANGED');
  assert(p.enabled && !p.failure && p.planHash===profile.planHash && p.protocolRecovery===k.previousProof,'POOL_CHANGED');
  const workers=Object.entries(p.workers);
  assert(workers.length===20 && workers.every(([id,w])=>Number(id)>=0 && Number(id)<20 && w.leaseUntil<=now)
    && new Set(workers.map(([,w])=>w.sessionHash)).size===20,'WORKERS_ACTIVE_OR_CHANGED');
  assert(s.batches.length===19 && profile.batches.length===19 && p.nextBatchId===20,'BATCHES_CHANGED');
  let count=0,checkpoint=0,end=0,pending=0;
  for(const [i,{value:b}] of s.batches.entries()){
    const expected=profile.batches[i],target=k.pending[b.id];
    assert(b.id===i+1 && expected.id===b.id && hash(b)===expected.hash,'BATCH_CHANGED');
    assert(b.start===end+1 && b.end>=b.start && b.end-b.start<100 && b.end<=plan.target,'RANGE_CHANGED');end=b.end;
    assert(b.worker>=0 && b.worker<20 && p.workers[b.worker]?.sessionHash===b.sessionHash
      && p.workers[b.worker].activeBatch?.id===b.id,'SESSION_CHANGED');
    assert(b.leaseUntil<=now && !b.failure && !b.bootstrapAwaiting && !b.pendingOriginal,'BATCH_REQUIRES_REVIEW');
    assert(b.start-1<=b.checkpoint && b.checkpoint<=b.journaled && b.journaled<b.end,'COUNTS_CHANGED');
    count+=b.journaled-b.start+1;checkpoint+=b.checkpoint-b.start+1;
    if(!target){assert(!b.pending && !b.protocolResume && expected.pendingHash===null,'UNREVIEWED_PENDING');continue;}
    pending++;const q=b.pending;
    assert(q && b.worker===target.worker && q.sequence===target.sequence && q.sequence===b.journaled+1
      && q.awaiting===null && hash(q)===expected.pendingHash,'ORIGINAL_PENDING_CHANGED');
    const old=prior.batches.find(x=>x.value.id===b.id)?.value,original=old?.pending;
    assert(original && ['id','worker','start','end','sessionHash'].every(key=>b[key]===old[key])
      && q.attempt===original.attempt && q.raw.startBalanceRaw===original.raw.startBalanceRaw
      && original.raw.steps.length===target.frames
      && stable(q.raw.steps.slice(0,target.frames))===stable(original.raw.steps),'OLD_PENDING_PREFIX_CHANGED');
    assert(stable(demonNextRequest(original.raw))===stable({MSGID:'FREE_GAME'}),'CONTINUATION_CHANGED');
    if(b.id===2){
      const tail=q.raw.steps.at(-1);
      assert(!b.protocolResume && q.raw.steps.length===2 && tail.msgId==='FREE_GAME' && tail.sourceRejected===true
        && sameContinuationRequest(original.raw.steps[0].requestPayload,tail.requestPayload)
        && tail.responsePayload==='&MSGID=ERROR&EID=ERROR_INVALID_SESSION&','NOT_REVIEWED_INVALID_SESSION');
      assert(typeof tail.responseXml==='string' && tail.responseXml.length<=262144 && !/<!DOCTYPE|<!ENTITY/i.test(tail.responseXml),'REJECTION_XML_INVALID');
      const root=xml.parse(tail.responseXml).GDMRESPONSE;
      assert(root && String(root.SUCCESS).toLowerCase()==='true' && root.PAYLOAD===tail.responsePayload,'REJECTION_XML_MISMATCH');
    }else assert(stable(q)===stable(original) && b.protocolResume?.proofHash===k.previousProof
      && b.protocolResume.pendingHash===hash(q),'UNCONSUMED_PENDING_CHANGED');
  }
  assert(end+1===p.nextSequence && count===246 && checkpoint===246 && pending===3,'COUNTS_CHANGED');
  return {count,checkpoint,pending,abandon:1,preserve:2};
}

export class DemonTwoRecovery extends ProtocolRecovery{
  constructor(args){super({...args,profile:{...args.profile,id:'demon-32739-20260929'}});
    this.profile=args.profile;this.prefix='demon-two:'+DEMON_TWO.id;this.recovering=false;}
  async boundary(){
    await this.githubIdle();await this.store.writable();
    assert(this.gate.status().metrics.diskFreeBytes>=30*1024**3,'DISK_RESERVE_REQUIRED');
    const holds=await this.transport.request('global_holds'),a=holds.find(x=>x._id==='primary/global-hold'),b=holds.find(x=>x._id==='secondary/global-hold');
    assert(holds.length===2 && a && b?.value.active===false,'GLOBAL_HOLD');
    if(this.recovering)assert(hash(a.value)===this.profile.primaryHoldHash && hash(b.value)===this.profile.secondaryHoldHash
      && a.value.active===true && a.value.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
      && a.value.details?.code==='SOURCE_REJECTED' && a.value.details.batchId===2
      && a.value.details.trialId===this.plan.trialId && !a.value.details.cooldownUntil,'UNREVIEWED_HOLD');
    else assert(a.value.active===false,'GLOBAL_HOLD');
    return holds;
  }
  async oldEvidence(s){
    const prefix=DEMON_TWO.oldPrefix,records=[];
    for(let id=1;id<=19;id++){
      const rows=(await this.store.get('journal',`${prefix}:records:${id}`))?.value.records;
      assert(Array.isArray(rows),'OLD_BACKUP_MISSING');records.push(...rows);
      if(rows.length){const got=await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(got.every((x,i)=>x && stable(x.value)===stable(rows[i])),'OLD_RECORDS_CHANGED');}
    }
    assert(records.length===246 && hash(records)===this.profile.recordsHash,'OLD_RECORD_COUNT_CHANGED');
    const stage=(await this.store.get('journal','pending-first:'+DEMON_TWO.previousProof))?.value;
    assert(stage && hash(stage)===this.profile.previousStageHash && stage.proofHash===DEMON_TWO.previousProof
      && stage.commit===DEMON_TWO.previousCommit,'PREVIOUS_STAGE_CHANGED');
    for(const e of historicalArchives){
      const archive=(await this.store.get('journal',e.prefix+':abandoned:'+e.batch))?.value;
      const reconciled=(await this.store.get('journal',e.prefix+':reconciled'))?.value;
      const expected=this.profile.archives[e.sequence],batch=s.batches.find(x=>x.value.id===e.batch)?.value;
      assert(expected && hash(archive)===expected.archiveHash && hash(reconciled)===expected.reconciledHash
        && archive.proofHash===e.proof && reconciled.proofHash===e.proof
        && archive.disposition==='source-invalid-session/abandon_without_replay'
        && archive.pending.sequence===e.sequence && archive.worker===e.worker,'OLD_ARCHIVE_CHANGED');
      assert(batch && !batch.pending && batch.journaled===e.sequence-1 && batch.checkpoint===e.sequence-1
        && batch.abandonedAttemptProof===e.proof && !(await this.store.get('journal',receiptKey(this.plan.trialId,e.sequence))),'OLD_ARCHIVE_REUSED');
    }
  }

  async recover(){
    this.recovering=true;
    try{
      const holds=await this.boundary(),s=await this.snapshots(),k=DEMON_TWO;
      assert(!(await this.store.get('journal',this.prefix+':proof')),'RECOVERY_ALREADY_STARTED');
      const prior=(await this.store.get('journal',k.oldPrefix+':before'))?.value;
      assert(prior && (await this.store.get('journal',k.oldPrefix+':proof'))?.value.proofHash===k.previousProof,'PRIOR_PROOF_CHANGED');
      reviewDemonTwo({plan:this.plan,profile:this.profile,s,prior,now:this.now()});
      for(const {value:b} of s.batches)if(b.pending){
        const raw=b.id===2?prior.batches.find(x=>x.value.id===2).value.pending.raw:b.pending.raw;
        assert(stable(await this.parser.call({op:'next',plan:this.plan,raw}))===stable(demonNextRequest(raw)),'CONTINUATION_CHANGED');
      }
      await this.oldEvidence(s);const full=await this.verifyRecords(s);
      assert(full.count===246 && full.committed===246,'COUNTS_CHANGED');
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      const proof={schema:'sg-demon-two-proof-v1',profileHash:hash(this.profile),snapshotHash:hash(s),verified:full,commit:this.commit,createdAt:this.now()},proofHash=hash(proof);
      await this.store.create('journal',this.prefix+':proof',{proof,proofHash,profile:this.profile},{immutable:true});
      await this.store.create('journal',this.prefix+':before',{...s,holds,prior},{immutable:true});
      assert(stable(await this.verifyRecords(s,{backup:true}))===stable(full),'BACKUP_CHANGED');
      const rejected=s.batches.find(x=>x.value.id===2).value;
      await this.store.create('journal',this.prefix+':abandoned:2',{proofHash,worker:1,sessionHash:rejected.sessionHash,
        disposition:'source-invalid-session/abandon_without_replay',pending:rejected.pending},{immutable:true});
      await this.store.create('journal',this.prefix+':backup-complete',{proofHash,snapshotHash:hash(s),recordsHash:full.recordsHash},{immutable:true});
      await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
      for(const {value:b} of s.batches){
        const key=`batch:${this.plan.trialId}:${b.id}`,epoch=b.epoch+1;
        await this.store.update('state',key,v=>{assert(hash(v)===hash(b),'BATCH_CHANGED');return {...v,epoch,owner:this.owner,leaseUntil:0};});
        const queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:key,owner:this.owner,epoch});
        const writer=new MongoWriter({gate:this.gate,queue,permits:new WritePermits({store:this.store,group:'primary',owner:this.owner,now:this.now}),sink:{
          read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
        while(true){const rows=await queue.outstanding();if(!rows.length)break;await this.boundary();const result=await writer.deliver(rows);if(result.paused)await this.sleep(1000);}
        await this.store.update('state',key,v=>{assert(v.owner===this.owner && v.epoch===epoch && v.journaled===v.checkpoint
          && hash(v.pending)===hash(b.pending),'RECONCILE_CHANGED');return {...v,owner:null};});
      }
      const after=await this.snapshots(),verified=await this.verifyRecords(after,{allCommitted:true});
      assert(verified.count===246 && verified.recordsHash===full.recordsHash,'VALID_RECORDS_CHANGED');await this.oldEvidence(after);
      await this.boundary();
      const grant=protocolGrant({plan:this.plan,batches:after.batches.filter(x=>x.value.id!==2),proofHash,commit:this.commit,now:this.now()});
      await this.store.create('journal','protocol-resume:'+proofHash,grant,{immutable:true});
      const pendingBatches=after.batches.map(x=>({value:{...x.value,pending:x.value.id===2?null:x.value.pending}}));
      const barrier=pendingFirstPlan({plan:this.plan,batches:pendingBatches,proofHash,commit:this.commit,createdAt:grant.createdAt,expiresAt:grant.expiresAt});
      assert(stable(barrier.entries.map(e=>e.worker).sort((a,b)=>a-b))===stable([2,7]),'STAGED_OWNERS_CHANGED');
      await this.store.create('journal','pending-first:'+proofHash,barrier,{immutable:true});
      for(const {value:b} of after.batches)await this.store.update('state',`batch:${this.plan.trialId}:${b.id}`,v=>{
        assert(hash(v)===hash(b),'BATCH_CHANGED');const pending=b.id===2?null:v.pending;
        return {...v,epoch:v.epoch+1,pending,protocolRecovery:proofHash,protocolResume:pending?{proofHash,pendingHash:hash(pending)}:null,
          ...(b.id===2?{abandonedAttemptProof:proofHash}:{})};
      });
      const result={proofHash,...verified,oldPreserved:246,flushed:0,abandonedAttempts:1,originalPendingPreserved:2,oldRejectedPendingSettled:0,
        grantExpiresAt:grant.expiresAt,at:this.now(),sourceRequests:0,replayedBets:0,validRecordsDeleted:0};
      await this.store.create('journal',this.prefix+':reconciled',result,{immutable:true});await this.boundary();
      await this.store.update('state',this.poolKey,v=>{assert(hash(v)===hash(s.pool.value),'POOL_CHANGED');
        for(const w of Object.values(v.workers)){w.owner=null;w.leaseUntil=0;w.resumeSafe=true;}return {...v,protocolRecovery:proofHash};});
      await this.store.update('state','campaign',v=>{assert(hash(v)===hash(s.campaign.value),'CAMPAIGN_CHANGED');return {...v,
        protocolValidation:{phase:'short',gameId:32739,proofHash,commit:this.commit,runKey:null,pendingFirst:hash(barrier)}};});
      await this.boundary();
      await this.store.update('state','global-hold',v=>{assert(hash(v)===this.profile.primaryHoldHash,'HOLD_CHANGED');
        return {...v,active:false,reason:null,demonTwoRecovery:proofHash};});return {...result,validationLimit:10};
    }finally{this.recovering=false;}
  }
  async liveFeature(s,before){
    // A new independently settled ordinary round must demonstrate the extension.
    // The rejected old 432 can never serve as this evidence.
    for(const {value:b} of s.batches){
      const prior=before.batches.find(x=>x.value.id===b.id)?.value;
      const start=prior?prior.journaled+1:b.start;
      const keys=Array.from({length:Math.max(0,b.journaled-start+1)},(_,i)=>receiptKey(this.plan.trialId,start+i));
      const rows=keys.length?await this.store.getMany('journal',keys):[];
      for(const {value:r} of rows){
        if(r.bonus!==2)continue;
        assert(r.fixtureOnly===false && r.buy===0 && r.raw.steps.filter(x=>x.msgId==='BET').length===1,'DEMON_EVIDENCE_INVALID');
        await this.parser.call({op:'verify',plan:this.plan,raw:r.raw,record:r});
        assert(demonNextRequest(r.raw)===null && demonMapping(r.raw,'base','demon').bonus===2,'DEMON_EVIDENCE_INVALID');
        const saved=await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:[r._id]});
        assert(saved.length===1 && stable(saved[0])===stable(r),'DEMON_EVIDENCE_MONGO_CHANGED');
        return {sequence:r.sequence,attemptHash:hash(r.attempt),rawHash:hash(r.raw),recordHash:hash(r)};
      }
    }
    throw Error('LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED');
  }
  async validate(){
    const {s,base}=await this.reviewedShort();assert(!(await this.store.get('journal',this.prefix+':validation')),'VALIDATION_ALREADY_APPLIED');
    const staged=new PendingFirst({store:this.store,transport:this.transport,analyzer:this.parser,plan:this.plan,stage:'capture',runKey:s.campaign.value.protocolValidation.runKey,now:this.now});
    const spec=await staged.load({commitSha:this.commit});assert(spec && spec.proofHash===base.proofHash,'STAGED_PROOF_CHANGED');
    for(const entry of spec.entries)await staged.settled(entry);
    const full=await this.verifyRecords(s,{allCommitted:true});
    assert(full.count===446 && Object.keys(full.workerCounts).length===20,'SHORT_COUNT_CHANGED');
    for(let w=0;w<20;w++)assert(full.workerCounts[w]-(base.workerCounts[w]||0)===10,'SHORT_WORKER_COUNT_CHANGED');
    const before=(await this.store.get('journal',this.prefix+':before')).value;let resumed=0,replaced=0;
    for(const {value:b} of before.batches){
      const after=s.batches.find(x=>x.value.id===b.id)?.value;
      assert(after && after.epoch>b.epoch && ['id','worker','start','end','sessionHash'].every(k=>after[k]===b[k]),'ORIGINAL_BATCH_CHANGED');
      const rows=(await this.store.get('journal',`${this.prefix}:records:${b.id}`)).value.records;
      if(rows.length){const got=await this.store.getMany('journal',rows.map(r=>receiptKey(this.plan.trialId,r.sequence)));
        assert(got.every((x,i)=>x && stable(x.value)===stable(rows[i])),'OLD_RECORDS_CHANGED');}
      if(!b.pending)continue;
      const r=(await this.store.get('journal',receiptKey(this.plan.trialId,b.pending.sequence)))?.value;
      assert(r && r.batchId===b.id && r.shardId===b.worker && r.sourceSessionHash===b.sessionHash
        && r.raw.steps.filter(x=>x.msgId==='BET').length===1,'REPLACEMENT_IDENTITY_CHANGED');
      if(b.id===2){
        const archive=(await this.store.get('journal',this.prefix+':abandoned:2'))?.value;
        assert(archive?.proofHash===base.proofHash && stable(archive.pending)===stable(b.pending)
          && archive.disposition==='source-invalid-session/abandon_without_replay' && r.attempt!==b.pending.attempt
          && r.raw.steps[0].ts>new Date(base.at).toISOString(),'ABANDONED_ATTEMPT_REPLAYED');replaced++;
      }else{
        assert(r.attempt===b.pending.attempt && r.raw.startBalanceRaw===b.pending.raw.startBalanceRaw
          && r.raw.steps.length>b.pending.raw.steps.length && stable(r.raw.steps.slice(0,b.pending.raw.steps.length))===stable(b.pending.raw.steps),'PENDING_PREFIX_CHANGED');resumed++;
      }
    }
    for(const e of historicalArchives){
      const archive=(await this.store.get('journal',e.prefix+':abandoned:'+e.batch))?.value;
      const reconciled=(await this.store.get('journal',e.prefix+':reconciled'))?.value;
      const r=(await this.store.get('journal',receiptKey(this.plan.trialId,e.sequence)))?.value,expected=this.profile.archives[e.sequence];
      assert(hash(archive)===expected.archiveHash && hash(reconciled)===expected.reconciledHash
        && r && r.batchId===e.batch && r.shardId===e.worker && r.sourceSessionHash===archive.sessionHash
        && r.attempt!==archive.pending.attempt && r.raw.steps.filter(x=>x.msgId==='BET').length===1
        && r.raw.steps[0].ts>new Date(reconciled.at).toISOString(),'OLD_ARCHIVE_REPLAYED');
      replaced++;
    }
    assert(resumed===2 && replaced===3,'ORIGINAL_PENDING_NOT_SETTLED');
    const evidence=await this.liveFeature(s,before);await this.boundary();assert(hash(await this.snapshots())===hash(s),'STATE_CHANGED');
    const result={proofHash:base.proofHash,fullReadback:446,oldPreserved:246,newComplete:200,pending:0,originalPendingSettled:2,
      replacementAttemptsSettled:3,abandonedOldPending:3,oldRejectedPendingSettled:0,liveDemonFeature:evidence,
      poolHash:hash(s.pool.value),campaignHash:hash(s.campaign.value),at:this.now()};
    await this.store.create('journal',this.prefix+':validation',result,{immutable:true});return result;
  }
  async formal(){
    const {s,base}=await this.reviewedShort(),v=(await this.store.get('journal',this.prefix+':validation'))?.value;
    assert(v?.proofHash===base.proofHash && v.fullReadback===446 && v.oldRejectedPendingSettled===0 && v.abandonedOldPending===3
      && v.originalPendingSettled===2 && v.replacementAttemptsSettled===3 && v.liveDemonFeature
      && v.poolHash===hash(s.pool.value) && v.campaignHash===hash(s.campaign.value)
      && this.now()>=v.at && this.now()-v.at<900000,'VALIDATION_STALE_OR_CHANGED');
    const before=(await this.store.get('journal',this.prefix+':before')).value;
    assert(stable(await this.liveFeature(s,before))===stable(v.liveDemonFeature),'DEMON_EVIDENCE_CHANGED');
    await this.store.create('journal',this.prefix+':formal',{validation:v,commit:this.commit,at:this.now()},{immutable:true});
    await this.store.update('state','campaign',c=>{assert(hash(c)===v.campaignHash,'CAMPAIGN_CHANGED');return {...c,validationLimit:0,protocolValidation:null};});
    return {proofHash:base.proofHash,validationLimit:0,sourceRequests:0};
  }
}
