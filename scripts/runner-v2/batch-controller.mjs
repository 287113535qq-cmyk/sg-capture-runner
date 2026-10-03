import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RunnerPool} from './state-store.mjs';
import {DurableQueue,WritePermits} from './durable-queue.mjs';
import {MongoWriter,stable} from './mongo-writer.mjs';
import {reviewProtocolResume} from './protocol-resume.mjs';
import {protocolPolicy} from './protocol-policy.mjs';
import {quarterbackNextRequest} from '../trial/quarterback-protocol.mjs';
import {beaverSequence} from '../trial/beaver-protocol.mjs';
import {PendingFirst} from './pending-first.mjs';
import {isAdapterGap,reviewedAdapterFailure} from './game-failure-policy.mjs';
import {faultCapsule} from './fault-capsule.mjs';
import {canaryWorkerRegistration} from './session-canary.mjs';
import {actionContract} from '../trial/pyramids-action-contracts.mjs';
import {claimActionCanaryWorker} from './action-canary-contract.mjs';
import {claimBudgetCanaryWorker} from './action-budget-canary.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
const hash=value=>createHash('sha256').update(stable(value)).digest('hex');
const fail=(code,category='storage')=>Object.assign(new Error(code),{code,category});

// Local implementation of the capture worker's RPC interface. Every business
// decision below runs in its GitHub process; transport only performs Mongo I/O.
export class BatchController {
  constructor({store,transport,gate,analyzer,spool,evidence,control,plan,group,pendingFirstStage,runKey,now=Date.now,commit=process.env.GITHUB_SHA,random=Math.random,sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
    assert(spool && typeof spool.append==='function' && typeof spool.confirmed==='function');
    Object.assign(this,{store,transport,gate,analyzer,spool,evidence,control,plan,group,now,sleep,runKey,random});
    this.pool=new RunnerPool({store,plan,group,now,commit});this.lease=null;this.batch=null;this.identity=null;
    this.pendingFirst=new PendingFirst({store,transport,analyzer,plan,stage:pendingFirstStage,runKey,now});
    this.storageStages={nestedWithinRpc:true,byStage:{}};
  }
  async status({workerId}={}){
    let pool;
    if(this.control.compact===true&&workerId!==undefined){
      assert(Number.isSafeInteger(workerId)&&workerId>=0&&workerId<160,'CONTROL_WORKER_SCOPE');
      const rows=await this.transport.request('control_read',{trialId:this.plan.trialId,workerId});
      pool=rows.find(row=>row._id===this.group+'/'+this.pool.key)?.value;
      if(pool)assert(Number.isSafeInteger(pool.confirmed)&&pool.confirmed>=0&&pool.confirmed<=this.plan.target,'CONTROL_COUNT_REQUIRED');
    }else pool=(await this.store.get('state',this.pool.key))?.value;
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
    await this.owned(r,{heartbeat:false});
    if(this.actionCanaryProof&&this.actionCanaryBatchTaken){
      await this.pool.release(this.lease);return {done:true};
    }
    const poolSnapshot=await this.control.allowed({newRound:true,workerId:r.shardId});
    await this.pool.heartbeat(this.lease,{snapshot:poolSnapshot});
    if(this.pendingFirst.admission?.limit===0){await this.pool.release(this.lease,{resumeSafe:true});return {done:true};}
    this.batch=await this.pool.take(this.lease);
    if(!this.batch){await this.pool.release(this.lease);return {done:true};}
    if(this.actionCanaryProof){
      assert(this.actionCanaryClaim&&this.batch.end-this.batch.start+1<=100,'ACTION_CANARY_BATCH_LIMIT');
      this.actionCanaryBatchTaken=true;
    }
    this.pendingFirst.checkLease(this.batch);
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
      const expected=this.plan.gameId===32820?(beaverSequence(p.raw,this.plan).next==='FREE_GAME'?{MSGID:'FREE_GAME'}:null):this.plan.gameId===32836?quarterbackNextRequest(p.raw):protocolPolicy(this.plan.gameId).next;
      assert(stable(next)===stable(expected),'RESUME_PROTOCOL_CHANGED');
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
      onConfirmed:this.evidence?(records=>this.evidence.confirmed(this.plan,records)):undefined,
      permits:new WritePermits({store:this.store,group:this.group,owner:this.lease.owner,now:this.now}),
      sink:{read:ids=>this.transport.request('rounds_read',{trialId:this.plan.trialId,ids}),
        insert:records=>this.transport.request('rounds_insert',{trialId:this.plan.trialId,records})}});
    await this.flush();
    return {done:false,batchId:this.batch.id,epoch:this.batchEpoch,durable:saved.value.journaled,
      checkpoint:saved.value.checkpoint,sequenceBase:this.batch.start-1,sequenceTarget:this.batch.end,pendingRound:saved.value.pending,
      ...(this.plan.countAllocation?{countAllocation:this.plan.countAllocation}:{}),
      ...(this.pendingFirst.admission?{shortRunLimit:this.pendingFirst.admission.limit}:{})};
  }
  async storageTime(stage,action){
    const started=performance.now();
    try{return await action();}finally{
      const item=this.storageStages.byStage[stage]??={calls:0,totalMs:0};
      item.calls++;item.totalMs+=performance.now()-started;
    }
  }
  async flush(){
    let capacityAttempt=0;
    while(true){
      const rows=await this.storageTime('queue.read',()=>this.queue.outstanding());if(!rows.length)return;
      await this.storageTime('resource.guard',()=>this.store.writable());
      await this.storageTime('lease.heartbeat',()=>this.pool.heartbeat(this.lease));
      const result=await this.storageTime('writer.deliver',()=>this.writer.deliver(rows));
      if(result.paused){
        const busy=result.reason==='WRITE_CAPACITY_BUSY';
        if(!busy||result.confirmed>0)capacityAttempt=0;
        let delay=10000;
        if(busy){
          const jitter=this.random();assert(Number.isFinite(jitter)&&jitter>=0&&jitter<1,'WRITE_CAPACITY_JITTER');
          delay=Math.min(500,Math.round(Math.min(500,100*2**capacityAttempt)*(0.75+0.5*jitter)));
          capacityAttempt=Math.min(capacityAttempt+1,3);
        }
        // Every retry returns through fresh resource and lease checks. Only a
        // known busy permit is retried; unknown acknowledgements still throw.
        await this.storageTime(busy?'wait.capacity':'wait.resource',()=>this.sleep(delay));
      }
    }
  }
  async intent(r,begin=false){
    if(begin){this.pendingFirst.beforeNewRequest();this.pendingFirst.beforeBegin(r.sequence);}
    await this.owned(r,{heartbeat:false});
    const poolSnapshot=await this.control.allowed({newRound:begin,continuation:!begin,workerId:r.shardId});
    await this.pool.heartbeat(this.lease,{snapshot:poolSnapshot});
    let raw;
    if(begin){
      assert(Number.isSafeInteger(r.startBalanceRaw)&&r.startBalanceRaw>=this.plan.betRaw);
      assert(/^[0-9a-f-]{36}$/.test(r.attempt),'INVALID_ATTEMPT');
      raw={fixtureOnly:false,protocol:['pearl-wms-v1','rhino-wms-v1','veryfruity-wms-action-v1'].includes(this.plan.adapter)?'wms':'nextgen',sourceKey:this.plan.sourceKey,
        roundFieldsVersion:'sg-round-fields-v1',startBalanceRaw:r.startBalanceRaw,steps:[]};
      const contract=actionContract(this.plan);
      if(contract){raw.requestFlowVersion=contract.version;raw.actionContractHash=contract.hash;}
    }else{
      assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');
      const current=this.batchSnapshot.value;this.batchOwned(current);
      assert(current.pending && current.pending.sequence===r.sequence && current.pending.awaiting===null,'PENDING_INTENT_CONFLICT');
      raw=current.pending.raw;
    }
    // Stop before creating an intent or issuing another source request. A
    // response already received must still be persisted even if it is too big.
    assert(raw.steps.length<this.plan.maxSteps,'ROUND_STEP_LIMIT');
    if(this.plan.actionResourceBudget){
      const budget=this.plan.actionResourceBudget;
      assert(this.plan.gameId===32721&&actionContract(this.plan)!==null
        &&this.plan.maxSteps===1026&&Object.keys(budget).length===2
        &&budget.maxFrames===1026&&budget.maxRawBytes===4194304,'FLOW_RESOURCE_PROFILE');
      assert(Buffer.byteLength(JSON.stringify(raw),'utf8')<budget.maxRawBytes,'FLOW_RESOURCE_BYTES');
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
      p.raw.steps.push(r.step);p.awaiting=null;return value;
    });
    const pending=stored.value.pending;let next,record;
    this.spool.confirmed();
    if(r.step.sourceRejected)throw fail('SOURCE_REJECTED','source_protocol');
    try{
      assert(pending.raw.steps.length<=this.plan.maxSteps,'ROUND_STEP_LIMIT');
      if(this.plan.actionResourceBudget)assert(Buffer.byteLength(JSON.stringify(pending.raw),'utf8')
        <=this.plan.actionResourceBudget.maxRawBytes,'FLOW_RESOURCE_BYTES');
      next=await this.analyzer.call({op:'next',plan:this.plan,raw:pending.raw});
      if(!next)record=await this.analyzer.call({op:'record',plan:this.plan,raw:pending.raw,
        normalized:r.normalized,sequence:r.sequence,attempt:pending.attempt,
        sessionHash:this.identity.sessionHash,worker:this.lease.worker,batchId:this.batch.id});
    }catch(error){
      error.code=reviewedAdapterFailure(error.code,pending.raw);
      const unsupported=isAdapterGap(error.code);
      await this.update(value=>({...value,failure:unsupported?'PROTOCOL_VALIDATION_FAILED':'RESPONSE_VALIDATION_REQUIRES_REVIEW',
        ...(unsupported?{adapterFailureCode:error.code}:{})}));
      error.category='source_protocol';throw error;
    }
    if(record){
      await this.queue.append(record);
      await this.update(value=>{
        assert(value.pending?.attempt===pending.attempt && value.pending.awaiting===null,'ROUND_COMMIT_CONFLICT');
        value.pending=null;value.journaled=r.sequence;return value;
      });
      if(this.pendingFirst.admission?.stage==='resume' || r.sequence-stored.value.checkpoint>=100 || r.sequence===this.batch.end)await this.flush();
      if(this.pendingFirst.admission?.stage==='resume')this.pendingFirst.admission.limit=0;
    }
    // AG advances directly from the acknowledged response. The worker already
    // supplies its next request; accept it only through the same fresh control,
    // ownership, independent intent validation and durable CAS as a separate
    // RPC. Neither a suggested request nor a failed/unknown ACK permits a send.
    let followingIntentDurable=false,stopRequested=false;
    if(r.following){
      const following=r.following,begin=!!record;
      assert(following&&Object.keys(following).sort().join(',')===(begin?
        'attempt,requestPayload,sequence,startBalanceRaw':'requestPayload,sequence'),'FOLLOWING_REQUEST_SCOPE');
      assert(following.sequence===r.sequence+Number(begin),'FOLLOWING_SEQUENCE_MISMATCH');
      assert(typeof following.requestPayload==='string','FOLLOWING_REQUEST_REQUIRED');
      if(begin)assert(following.startBalanceRaw===record.normalized.money.endBalanceRaw,'FOLLOWING_BALANCE_MISMATCH');
      if(begin)assert(following.attempt!==pending.attempt,'FOLLOWING_ATTEMPT_REUSED');
      try{
        await this.intent({...r,...following},begin);
        followingIntentDurable=true;
      }catch(error){
        // A terminal record has already been preserved and, when required,
        // read back. A later stop must not turn it into an abandoned round.
        // Only explicit source controls are a graceful boundary; validation,
        // fences and unknown storage results still fail without retry.
        if(begin&&['GLOBAL_SOURCE_STOPPED','CAMPAIGN_PAUSED','GAME_NO_LONGER_ACTIVE','POOL_PAUSED',
          'DISK_RESERVE_REQUIRES_REVIEW'].includes(error.code))stopRequested=true;
        else throw error;
      }
    }
    return {complete:!!record,followingIntentDurable,stopRequested,
      checkpoint:this.batchSnapshot.value.checkpoint,
      ...(record?{endBalanceRaw:record.normalized.money.endBalanceRaw}:{})};
  }
  async bootstrap(r,frame=false){
    if(frame)this.spool.append(r.step);
    await this.owned(r,{heartbeat:false});
    if(!frame){
      this.pendingFirst.beforeNewRequest();
      const poolSnapshot=await this.control.allowed({newRound:true,workerId:r.shardId});
      await this.pool.heartbeat(this.lease,{snapshot:poolSnapshot});
      assert((['pearl-wms-v1','rhino-wms-v1','veryfruity-wms-action-v1'].includes(this.plan.adapter)?['Init']:['INIT','REELSTRIP']).includes(r.msgId),'BOOTSTRAP_METHOD');
      await this.update(v=>{assert(!v.pending && !v.bootstrapAwaiting,'BOOTSTRAP_PENDING');v.bootstrapAwaiting={msgId:r.msgId,payload:r.requestPayload};return v;});
      return {intentDurable:true};
    }
    assert(this.batchSnapshot,'BATCH_SNAPSHOT_REQUIRED');
    const before=this.batchSnapshot.value;this.batchOwned(before);
    assert(before.bootstrapAwaiting?.payload===r.step.requestPayload,'BOOTSTRAP_RESPONSE_MISMATCH');
    const key=`bootstrap:${this.plan.trialId}:${this.batch.id}:${hash(r.step)}`;
    await this.store.create('journal',key,{worker:this.lease.worker,step:r.step},{immutable:true});
    if(['pearl-wms-v1','rhino-wms-v1','veryfruity-wms-action-v1'].includes(this.plan.adapter))await this.analyzer.call({op:'bootstrap',plan:this.plan,raw:{},step:r.step});
    await this.update(v=>{assert(stable(v.bootstrapAwaiting)===stable(before.bootstrapAwaiting));v.bootstrapAwaiting=null;return v;});
    this.spool.confirmed();
    return {responseDurable:true};
  }
  async release(r){
    await this.owned(r);await this.flush();
    const b=(await this.store.get('state',this.batchKey)).value;this.batchOwned(b);
    assert(!b.pending && !b.pendingOriginal && !b.bootstrapAwaiting,'UNFINISHED_ROUND');
    assert(b.checkpoint===b.journaled,'UNCONFIRMED_QUEUE');
    const countSpec=await this.pool.countPermission();
    if(countSpec?.sessionRotation==='closed-batches-v1'){
      // Freeze the batch before closing its reservation. A failed write leaves
      // the worker fenced and cannot grant another session or count capacity.
      const frozen=(await this.update(v=>{assert(hash(v)===hash(b),'BATCH_VERSION_CHANGED');return {...v,leaseUntil:0};})).value;
      const key=`count-settlement:${this.plan.trialId}:${countSpec.activation}:${b.id}`;
      const evidence={schema:'sg-count-batch-settlement-v1',activation:countSpec.activation,
        trialId:this.plan.trialId,batch:frozen,fullReadback:true};
      await this.store.create('journal',key,evidence,{immutable:true});
      assert(hash((await this.store.get('journal',key))?.value)===hash(evidence),'COUNT_SETTLEMENT_READBACK');
      await this.pool.settle(this.lease,this.batch,evidence,key);
      return {status:'complete',checkpoint:b.checkpoint,discarded:b.end-b.checkpoint};
    }
    if(b.journaled===b.end){
      await this.pool.complete(this.lease,this.batch,{pending:null,confirmed:b.end-b.start+1,fullReadback:true});
      return {status:'complete',checkpoint:b.checkpoint};
    }
    // Storage is fully acknowledged. Drop the batch lease before releasing
    // the worker, so another owner cannot claim it between these two writes.
    // A failed CAS leaves worker ownership intact and cannot authorize resume.
    await this.update(v=>{assert(hash(v)===hash(b),'BATCH_VERSION_CHANGED');return {...v,leaseUntil:0};});
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
      await this.store.update('state',this.pool.key,v=>({...v,enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',drainingProtocol:true}));
      await this.store.update('state','campaign',v=>{
        if(v.activeGame===this.plan.gameId){
          const game=v.games.find(x=>x.game_id===this.plan.gameId);assert(game);game.status='parking-protocol';
          if(b?.failure==='PROTOCOL_VALIDATION_FAILED')game.pendingReview={batchId:this.batch.id,sequence:b.pending.sequence,rawHash:hash(b.pending.raw)};
        }
        return v;
      });
      // Finish storage before releasing ownership. The interrupted attempt is
      // private analysis only, never resumed or counted as a completed round.
      try{
        if(this.batchKey){
          await this.owned(r,{heartbeat:false});await this.flush();
          const current=(await this.store.get('state',this.batchKey)).value;this.batchOwned(current);
          assert(!current.bootstrapAwaiting && !current.pending?.awaiting,'UNKNOWN_SOURCE_OUTCOME');
          assert(current.checkpoint===current.journaled,'UNCONFIRMED_QUEUE');
          let abandoned=null,workLineFault=null;
          if(current.pending){
            const key=`abandoned-demo:${this.plan.trialId}:${current.id}:${hash(current.pending)}`;
            const evidence={schema:'sg-abandoned-demo-v1',trialId:this.plan.trialId,batchId:current.id,
              reason:current.adapterFailureCode || 'PROTOCOL_VALIDATION_FAILED',
              disposition:'interrupted-abandoned-without-replay',pending:current.pending,
              diagnostic:faultCapsule({plan:this.plan,raw:current.pending.raw,code:current.adapterFailureCode}),
              pendingOriginal:current.pendingOriginal??null,sourceRequests:0};
            await this.store.create('journal',key,evidence,{immutable:true});
            assert(hash((await this.store.get('journal',key))?.value)===hash(evidence),'ABANDON_READBACK_FAILED');
            const receipt=captureFaultReceipt({plan:this.plan,batch:current,archiveKey:key,archive:evidence,group:this.group});
            const faultKey=`capture-fault:${this.plan.trialId}:${current.id}:${hash(receipt)}`;
            await this.store.create('journal',faultKey,receipt,{immutable:true});
            assert(hash((await this.store.get('journal',faultKey))?.value)===hash(receipt),'CAPTURE_FAULT_READBACK_FAILED');
            if(this.evidence)try{this.evidence.fault({plan:this.plan,batch:current,receipt,archive:evidence});}
            catch{console.log(JSON.stringify({status:'fault-evidence-delivery-pending',sourceRequests:0}));}
            workLineFault=faultKey;
            abandoned=key;
          }
          // A lane can discover a sibling's protocol stop just after its own
          // batch settled. Do not decorate that immutable snapshot with nulls.
          if(current.pending||current.pendingOriginal||current.protocolResume||current.leaseUntil!==0||abandoned)await this.update(v=>{assert(hash(v)===hash(current),'BATCH_VERSION_CHANGED');
            return {...v,pending:null,pendingOriginal:null,protocolResume:null,leaseUntil:0,
              ...(abandoned?{abandonedDemo:abandoned,workLineFault}:{})};});
        }
        if(this.lease)await this.pool.release(this.lease);
      }catch(error){
        await this.control.halt('SOURCE_OR_STORAGE_REQUIRES_REVIEW',{trialId:this.plan.trialId,
          batchId:this.batch?.id??null,code:'PROTOCOL_PARK_STORAGE_FAILED'});throw error;
      }
    }else await this.control.halt('SOURCE_OR_STORAGE_REQUIRES_REVIEW',{
      trialId:this.plan.trialId,batchId:this.batch?.id ?? null,
      code:/^[A-Z_]{1,100}$/.test(r.code || '')?r.code:'UNCLASSIFIED_STOP',
      category:r.category || 'storage',cooldownUntil:r.cooldownUntil || 0});
    // No cleanup, replay or ownership transfer is performed here.
    return {status:'halted',reason:protocol?'PROTOCOL_VALIDATION_FAILED':'SOURCE_OR_STORAGE_REQUIRES_REVIEW'};
  }
  async rpc(op,r={}){
    if(op==='status')return this.status();
    if(op==='finish_run'){
      assert(this.plan.countAllocation&&this.lease,'COUNT_FINISH_SCOPE');
      await this.pool.countPermission();
      await this.store.update('state',this.pool.key,v=>{
        const w=v.workers[String(this.lease.worker)];
        assert(w&&w.owner===this.lease.owner&&w.epoch===this.lease.epoch&&!w.activeBatch,'COUNT_FINISH_UNSETTLED');
        w.leaseUntil=0;w.resumeSafe=false;return v;
      });return {released:true};
    }
    if(op==='register'){
      await this.control.allowed({newRound:true});assert(r.planHash===hash(this.plan),'PLAN_CHANGED');
      const spec=await this.pool.countPermission();
      if(spec?.runAdmission==='unique-github-run-v1'){
        assert(/^capture-run:[0-9]+:1$/.test(this.runKey??''),'COUNT_RUN_REQUIRED');
        const run=this.runKey.slice('capture-run:'.length);
        const permit=(await this.store.get('journal',`count-run:${this.plan.trialId}:${run}`))?.value;
        assert(permit?.schema==='sg-count-run-v1'&&permit.run===run&&permit.activation===spec.activation
          &&permit.profileHash===spec.profileHash&&permit.commit===this.pool.commit&&r.commitSha===this.pool.commit
          &&permit.createdAt<=this.now()&&this.now()<permit.expiresAt
          &&permit.expiresAt-permit.createdAt<=270*60000,'COUNT_RUN_NOT_ADMITTED');
        const old=(await this.store.get('state',this.pool.key))?.value.workers[String(r.shardId)];
        const delayed=this.canarySchedule&&canaryWorkerRegistration({schedule:this.canarySchedule,permit,
          plan:this.plan,commit:this.pool.commit,run,slot:r.shardId,now:this.now()});
        assert(this.now()-permit.createdAt<=15*60000||old?.owner?.startsWith(run+':')||delayed,'COUNT_INITIAL_WORKER_LATE');
      }
      await this.pendingFirst.admit(r,r.shardId);
      if(this.actionCanaryProof)this.actionCanaryClaim=await (['sg-formal-action-budget-profile-v1','sg-formal-direct-action-profile-v1','sg-formal-direct-action-profile-v2'].includes(this.actionCanaryProof.profile.schema)?claimBudgetCanaryWorker:claimActionCanaryWorker)({store:this.store,
        proof:this.actionCanaryProof,identity:r,now:this.now()});
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
