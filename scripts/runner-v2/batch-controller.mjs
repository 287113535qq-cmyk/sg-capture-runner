import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RunnerPool} from './state-store.mjs';
import {DurableQueue,WritePermits} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {reviewProtocolResume} from './protocol-resume.mjs';
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
const fail=(code,category='storage')=>Object.assign(new Error(code),{code,category});

// Local implementation of the capture worker's RPC interface. Every business
// decision below runs in its GitHub process; transport only performs Mongo I/O.
export class BatchController {
  constructor({store,transport,gate,analyzer,spool,control,plan,group,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
    assert(spool && typeof spool.append==='function' && typeof spool.confirmed==='function');
    Object.assign(this,{store,transport,gate,analyzer,spool,control,plan,group,now,sleep});
    this.pool=new RunnerPool({store,plan,group,now});this.lease=null;this.batch=null;this.identity=null;
  }
  async status(){
    const pool=(await this.store.get('state',this.pool.key))?.value;
    if(!pool)return {status:'halted',reason:'POOL_NOT_INITIALIZED'};
    return {status:pool.failure||!pool.enabled?'halted':pool.confirmed===this.plan.target?'complete':'pending',
      trialId:this.plan.trialId,confirmed:pool.confirmed,target:this.plan.target,reason:pool.failure};
  }
  async owned(r,{heartbeat=true}={}) {
    assert(this.lease && r.owner===this.lease.owner && r.workerEpoch===this.lease.epoch,'WORKER_OWNER_MISMATCH');
    assert(r.shardId===this.lease.worker,'WORKER_CHANGED');
    if(heartbeat)await this.pool.heartbeat(this.lease);
    if(r.batchId!==undefined)assert(this.batch && r.batchId===this.batch.id && r.epoch===this.batchEpoch,'BATCH_FENCE');
  }
  batchOwned(value){
    assert(value.owner===this.lease.owner && value.epoch===this.batchEpoch,'BATCH_LEASE_LOST');
    assert(value.sessionHash===this.identity.sessionHash,'SESSION_CHANGED');
  }
  async update(change){
    assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');
    const before=this.batchSnapshot;
    const value=structuredClone(before.value);this.batchOwned(value);
    const next=change(value);
    try{
      const after=await this.store.cas('state',this.batchKey,before,next);
      if(!after)throw fail('BATCH_VERSION_CHANGED');
      this.batchSnapshot=after;return after;
    }catch(error){this.batchSnapshot=null;throw error;}
  }
  async next(r){
    await this.owned(r);await this.control.allowed({newRound:true});
    this.batch=await this.pool.take(this.lease);
    if(!this.batch){await this.pool.release(this.lease);return {done:true};}
    this.batchKey=`batch:${this.plan.trialId}:${this.batch.id}`;
    const existing=await this.store.create('state',this.batchKey,{...this.batch,owner:null,epoch:0,sessionHash:this.identity.sessionHash,
      leaseUntil:0,journaled:this.batch.start-1,checkpoint:this.batch.start-1,pending:null,failure:null});
    const original=existing.value;
    let grant=null;
    if(original.pending){
      assert(original.protocolResume,'PENDING_REQUIRES_REVIEW');
      grant=(await this.store.get('journal','protocol-resume:'+original.protocolResume.proofHash))?.value;
      const p=reviewProtocolResume({plan:this.plan,batch:original,grant,worker:this.lease.worker,
        sessionHash:this.identity.sessionHash,commit:this.identity.commitSha,now:this.now()});
      const next=await this.analyzer.call({op:'next',plan:this.plan,raw:p.raw});
      assert(stable(next)===stable({MSGID:'FREE_GAME'}),'RESUME_PROTOCOL_CHANGED');
    }
    const saved=await this.store.update('state',this.batchKey,value=>{
      assert(value.sessionHash===this.identity.sessionHash,'SESSION_CHANGED');
      assert(!value.pendingOriginal && !value.failure,'BATCH_REVIEW_REQUIRED');
      assert(!value.pending?.awaiting && !value.bootstrapAwaiting,'UNKNOWN_SOURCE_OUTCOME');
      if(value.pending){
        reviewProtocolResume({plan:this.plan,batch:value,grant,worker:this.lease.worker,
          sessionHash:this.identity.sessionHash,commit:this.identity.commitSha,now:this.now()});
        assert(hash(value.pending)===hash(original.pending),'RESUME_PENDING_CHANGED');
        value.protocolResume=null; // One fenced claim; never reuse after a crash.
      }
      value.owner=this.lease.owner;value.epoch=Math.max(value.epoch+1,this.lease.epoch);
      value.leaseUntil=this.now()+600000;return value;
    });
    this.batchEpoch=saved.value.epoch;
    this.batchSnapshot=saved;
    this.queue=new DurableQueue({store:this.store,plan:this.plan,batchKey:this.batchKey,owner:this.lease.owner,epoch:this.batchEpoch,
      readBatch:async()=>{assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');return this.batchSnapshot;},
      updateBatch:change=>this.update(change)});
    this.writer=new MongoWriter({gate:this.gate,queue:this.queue,
      permits:new WritePermits({store:this.store,group:this.group,owner:this.lease.owner,now:this.now}),
      sink:{read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),
        insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
    await this.flush();
    return {done:false,batchId:this.batch.id,epoch:this.batchEpoch,durable:saved.value.journaled,
      checkpoint:saved.value.checkpoint,sequenceBase:this.batch.start-1,sequenceTarget:this.batch.end,pendingRound:saved.value.pending};
  }
  async flush(){
    while(true){
      const rows=await this.queue.outstanding();if(!rows.length)return;
      await this.store.writable();await this.pool.heartbeat(this.lease);
      const result=await this.writer.deliver(rows);
      if(result.paused)await this.sleep(result.reason==='WRITE_CAPACITY_BUSY'?1000:10000);
    }
  }
  async intent(r,begin=false){
    await this.owned(r,{heartbeat:false});
    const poolSnapshot=await this.control.allowed({newRound:begin});
    await this.pool.heartbeat(this.lease,{snapshot:poolSnapshot});
    let raw;
    if(begin){
      assert(Number.isSafeInteger(r.startBalanceRaw)&&r.startBalanceRaw>=this.plan.betRaw);
      assert(/^[0-9a-f-]{36}$/.test(r.attempt),'INVALID_ATTEMPT');
      raw={fixtureOnly:false,protocol:'nextgen',sourceKey:this.plan.sourceKey,
        roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:r.startBalanceRaw,steps:[]};
    }else{
      assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');
      const current=this.batchSnapshot.value;this.batchOwned(current);
      assert(current.pending && current.pending.sequence===r.sequence && current.pending.awaiting===null,'PENDING_INTENT_CONFLICT');
      raw=current.pending.raw;
    }
    await this.analyzer.call({op:'intent',plan:this.plan,raw,payload:r.requestPayload});
    await this.update(value=>{
      assert(!value.failure,'BATCH_HALTED');
      if(begin){
        assert(!value.pending && r.sequence===value.journaled+1 && r.sequence<=value.end,'ROUND_SEQUENCE_CONFLICT');
        assert(value.journaled-value.checkpoint<100,'DURABLE_QUEUE_FULL');
        value.pending={sequence:r.sequence,attempt:r.attempt,raw,awaiting:r.requestPayload};
      }else{
        assert(value.pending?.sequence===r.sequence && value.pending.awaiting===null,'PENDING_INTENT_CONFLICT');
        value.pending.awaiting=r.requestPayload;
      }
      return value;
    });
    return {intentDurable:true};
  }
  async exchange(r){
    this.spool.append(r.step);
    await this.owned(r,{heartbeat:false});
    // Persist the complete response BEFORE parsing, normalization, or allowing
    // any following request. Failure leaves the original evidence untouched.
    const stored=await this.update(value=>{
      const p=value.pending;
      assert(p && p.sequence===r.sequence && p.awaiting===r.step.requestPayload,'RESPONSE_WITHOUT_INTENT');
      assert(p.raw.steps.length<this.plan.maxSteps,'ROUND_STEP_LIMIT');
      p.raw.steps.push(r.step);p.awaiting=null;return value;
    });
    const pending=stored.value.pending;let next,record;
    this.spool.confirmed();
    if(r.step.sourceRejected)throw fail('SOURCE_REJECTED','source_protocol');
    try{
      next=await this.analyzer.call({op:'next',plan:this.plan,raw:pending.raw});
      if(!next)record=await this.analyzer.call({op:'record',plan:this.plan,raw:pending.raw,
        normalized:r.normalized,sequence:r.sequence,attempt:pending.attempt,
        sessionHash:this.identity.sessionHash,worker:this.lease.worker,batchId:this.batch.id});
    }catch(error){
      const unsupported=/^(UNKNOWN_TRIAL_FEATURE|UNKNOWN_JACKPOT_FEATURE|HUFF_FEATURE_NOT_ADAPTED)$/.test(error.code || '');
      await this.update(value=>({...value,failure:unsupported?'PROTOCOL_VALIDATION_FAILED':'RESPONSE_VALIDATION_REQUIRES_REVIEW'}));
      error.category='source_protocol';throw error;
    }
    if(record){
      await this.queue.append(record);
      await this.update(value=>{
        assert(value.pending?.attempt===pending.attempt && value.pending.awaiting===null,'ROUND_COMMIT_CONFLICT');
        value.pending=null;value.journaled=r.sequence;return value;
      });
      if(r.sequence-stored.value.checkpoint>=100 || r.sequence===this.batch.end)await this.flush();
    }
    // Following intents are intentionally created by the next loop iteration.
    // This avoids pre-reserving another BET when resources or source stop.
    return {complete:!!record,followingIntentDurable:false,
      checkpoint:this.batchSnapshot.value.checkpoint,
      ...(record?{endBalanceRaw:record.normalized.money.endBalanceRaw}:{})};
  }
  async bootstrap(r,frame=false){
    if(frame)this.spool.append(r.step);
    await this.owned(r,{heartbeat:false});
    if(!frame){
      const poolSnapshot=await this.control.allowed({newRound:true});
      await this.pool.heartbeat(this.lease,{snapshot:poolSnapshot});
      assert(['INIT','REELSTRIP'].includes(r.msgId),'BOOTSTRAP_METHOD');
      await this.update(v=>{assert(!v.pending && !v.bootstrapAwaiting,'BOOTSTRAP_PENDING');v.bootstrapAwaiting={msgId:r.msgId,payload:r.requestPayload};return v;});
      return {intentDurable:true};
    }
    assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');
    const before=this.batchSnapshot.value;this.batchOwned(before);
    assert(before.bootstrapAwaiting?.payload===r.step.requestPayload,'BOOTSTRAP_RESPONSE_MISMATCH');
    const key=`bootstrap:${this.plan.trialId}:${this.batch.id}:${hash(r.step)}`;
    await this.store.create('journal',key,{worker:this.lease.worker,step:r.step},{immutable:true});
    await this.update(v=>{assert(stable(v.bootstrapAwaiting)===stable(before.bootstrapAwaiting));v.bootstrapAwaiting=null;return v;});
    this.spool.confirmed();
    return {responseDurable:true};
  }
  async release(r){
    await this.owned(r);await this.flush();
    const b=(await this.store.get('state',this.batchKey)).value;this.batchOwned(b);
    assert(!b.pending && !b.bootstrapAwaiting,'UNFINISHED_ROUND');
    assert(b.checkpoint===b.journaled,'UNCONFIRMED_QUEUE');
    if(b.journaled===b.end){
      await this.pool.complete(this.lease,this.batch,{pending:null,confirmed:b.end-b.start+1,fullReadback:true});
      return {status:'complete',checkpoint:b.checkpoint};
    }
    await this.pool.release(this.lease,{resumeSafe:true});
    return {status:'pending',checkpoint:b.checkpoint};
  }
  async stop(r){
    const b=this.batchKey?(await this.store.get('state',this.batchKey))?.value:null;
    const p=(await this.store.get('state',this.pool.key))?.value;
    const peerStop=p?.failure==='PROTOCOL_VALIDATION_FAILED'
      && /^(GAME_NO_LONGER_ACTIVE|POOL_PAUSED|TRIAL_HALTED|CAMPAIGN_PAUSED)$/.test(r.code || '')
      && !b?.pending?.awaiting && !b?.bootstrapAwaiting;
    const protocol=b?.failure==='PROTOCOL_VALIDATION_FAILED' && b.pending?.awaiting===null || peerStop;
    if(protocol){
      await this.store.update('state',this.pool.key,v=>({...v,enabled:false,failure:'PROTOCOL_VALIDATION_FAILED'}));
      await this.store.update('state','campaign',v=>{
        if(v.activeGame===this.plan.gameId){
          const game=v.games.find(x=>x.game_id===this.plan.gameId);assert(game);game.status='parking-protocol';
          if(b?.failure==='PROTOCOL_VALIDATION_FAILED')game.pendingReview={batchId:this.batch.id,sequence:b.pending.sequence,rawHash:hash(b.pending.raw)};
        }
        return v;
      });
      // The campaign will wait until every old source owner has stopped and
      // back up all its pending states before assigning another game.
      if(this.lease)await this.pool.release(this.lease);
    }else await this.control.halt('SOURCE_OR_STORAGE_REQUIRES_REVIEW',{
      trialId:this.plan.trialId,batchId:this.batch?.id ?? null,
      code:/^[A-Z_]{1,100}$/.test(r.code || '')?r.code:'UNCLASSIFIED_STOP',
      category:r.category || 'storage',cooldownUntil:r.cooldownUntil || 0});
    // No cleanup, replay or ownership transfer is performed here.
    return {status:'halted',reason:protocol?'PROTOCOL_VALIDATION_FAILED':'SOURCE_OR_STORAGE_REQUIRES_REVIEW'};
  }
  async rpc(op,r={}){
    if(op==='status')return this.status();
    if(op==='register'){
      await this.control.allowed({newRound:true});assert(r.planHash===hash(this.plan),'PLAN_CHANGED');
      this.identity=r;this.lease=await this.pool.register(r.shardId,r);return {workerEpoch:this.lease.epoch};
    }
    if(op==='next')return this.next(r);
    if(op==='begin'||op==='intent')return this.intent(r,op==='begin');
    if(op==='exchange_journal')return this.exchange(r);
    if(op==='bootstrap_intent'||op==='bootstrap_frame')return this.bootstrap(r,op==='bootstrap_frame');
    if(op==='release')return this.release(r);
    if(op==='fail')return this.stop(r);
    if(op==='yield_protocol_stop')return {yielded:false};
    throw fail('GITHUB_OPERATION_NOT_SUPPORTED');
  }
}
