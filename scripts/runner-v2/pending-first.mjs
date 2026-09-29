import {FreshStart} from './fresh-start.mjs';
import {loadNestedShort} from './demon-nested-short.mjs';
import {hasNested,nestedNext,nestedMapping} from '../trial/demon-nested-protocol.mjs';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {stable} from './mongo-writer.mjs';
import {demonNextRequest,demonMapping} from '../trial/demon-protocol.mjs';

// Immutable, private evidence created by a new reviewed recovery operator.
// Merely setting a workflow environment variable never authorizes continuation.
export function pendingFirstPlan({plan,batches,proofHash,commit,createdAt,expiresAt}) {
  assert(plan.gameId===32739 && plan.buy===0 && plan.phase===1 && /^[a-f0-9]{64}$/.test(proofHash)
    && /^[a-f0-9]{40}$/.test(commit) && expiresAt>createdAt && expiresAt-createdAt<=7200000,'PENDING_FIRST_SCOPE_CHANGED');
  const entries=batches.filter(x=>x.value.pending).map(({value:b})=>({
    batchId:b.id,worker:b.worker,sessionHash:b.sessionHash,pending:structuredClone(b.pending)}));
  assert(entries.length>0 && entries.length<=20 && new Set(entries.map(x=>x.worker)).size===entries.length,'PENDING_FIRST_OWNERS_CHANGED');
  assert(entries.every(e=>Number.isInteger(e.worker) && e.worker>=0 && e.worker<20
    && e.pending.awaiting===null && e.pending.raw.steps.length>0),'PENDING_FIRST_UNKNOWN_OUTCOME');
  const baseline={};
  for(const {value:b} of batches)baseline[b.worker]=(baseline[b.worker]||0)+b.journaled-b.start+1;
  return {schema:'sg-pending-first-v1',gameId:plan.gameId,trialId:plan.trialId,planHash:hash(plan),proofHash,commit,
    createdAt,expiresAt,perWorker:10,baseline,entries};
}

export class PendingFirst {
  constructor({store,transport,analyzer,plan,stage,runKey,now=Date.now}) {
    Object.assign(this,{store,transport,analyzer,plan,stage,runKey,now});this.admission=null;this.fresh=new FreshStart({store,plan,stage,runKey,now});
  }
  async load(identity) {
    const c=(await this.store.get('state','campaign'))?.value,p=c?.protocolValidation;
    if(p?.nestedShort)return loadNestedShort(this,identity,c);
    if(p?.freshStart)return this.fresh.load(identity);
    if(!p?.pendingFirst){assert(!this.stage,'PENDING_FIRST_NOT_AUTHORIZED');return null;}
    assert(['resume','capture'].includes(this.stage),'PENDING_FIRST_STAGE_REQUIRED');
    assert(c.enabled && c.activeGame===this.plan.gameId && c.validationLimit===10 && p.phase==='short'
      && p.gameId===this.plan.gameId && p.commit===identity.commitSha
      && /^capture-run:[0-9]+:[0-9]+$/.test(this.runKey||'') && p.runKey===this.runKey,'PENDING_FIRST_RUN_CHANGED');
    const spec=(await this.store.get('journal','pending-first:'+p.proofHash))?.value;
    assert(spec && hash(spec)===p.pendingFirst && spec.schema==='sg-pending-first-v1'
      && spec.proofHash===p.proofHash && spec.commit===p.commit && spec.planHash===hash(this.plan)
      && spec.trialId===this.plan.trialId && spec.gameId===32739 && spec.perWorker===10,'PENDING_FIRST_PROOF_CHANGED');
    assert(this.now()>=spec.createdAt && this.now()<spec.expiresAt && spec.expiresAt-spec.createdAt<=7200000,'PENDING_FIRST_PROOF_STALE');
    assert(spec.entries.length>0 && spec.entries.length<=20 && new Set(spec.entries.map(x=>x.worker)).size===spec.entries.length,'PENDING_FIRST_OWNERS_CHANGED');
    return spec;
  }
  async settled(e) {
    const b=(await this.store.get('state',`batch:${this.plan.trialId}:${e.batchId}`))?.value;
    const r=(await this.store.get('journal',receiptKey(this.plan.trialId,e.pending.sequence)))?.value;
    assert(b && r && b.worker===e.worker && b.sessionHash===e.sessionHash && b.checkpoint>=e.pending.sequence
      && r.trialId===this.plan.trialId && r.batchId===e.batchId && r.shardId===e.worker && r.sourceSessionHash===e.sessionHash
      && r.attempt===e.pending.attempt && r.sequence===e.pending.sequence && r.fixtureOnly===false && r.buy===0
      && r.raw.startBalanceRaw===e.pending.raw.startBalanceRaw && r.raw.steps.length>e.pending.raw.steps.length
      && stable(r.raw.steps.slice(0,e.pending.raw.steps.length))===stable(e.pending.raw.steps),'PENDING_FIRST_UNSETTLED');
    await this.analyzer.call({op:'verify',plan:this.plan,raw:r.raw,record:r});
    assert((hasNested(r.raw)?nestedNext(r.raw):demonNextRequest(r.raw))===null
      && (hasNested(r.raw)?nestedMapping(r.raw,'a'.repeat(64)):demonMapping(r.raw,'base','extension')).bonus===r.bonus,'PENDING_FIRST_PROTOCOL_CHANGED');
    const got=await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:[r._id]});
    assert(got.length===1 && stable(got[0])===stable(r),'PENDING_FIRST_MONGO_CHANGED');
  }
  async admit(identity,worker) {
    const spec=await this.load(identity);if(!spec)return null;
    if(spec.schema==='sg-demon-zero-short-v1'){this.admission=await this.fresh.admit(identity,worker);return this.admission;}
    if(spec.schema==='sg-demon-nested-short-v1'){
      const pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value;
      assert(Number.isInteger(worker)&&worker>=0&&worker<20&&identity.shardId===worker
        &&pool?.enabled&&!pool.failure&&pool.protocolRecovery===spec.proofHash
        &&pool.workers[worker]?.sessionHash===identity.sessionHash,'NESTED_WORKER_IDENTITY_CHANGED');
    }
    const entry=spec.entries.find(x=>x.worker===worker);
    if(this.stage==='resume') {
      assert(entry && entry.sessionHash===identity.sessionHash,'PENDING_FIRST_WRONG_WORKER');
      const b=(await this.store.get('state',`batch:${this.plan.trialId}:${entry.batchId}`))?.value;
      assert(b && hash(b.pending)===hash(entry.pending) && b.protocolResume?.proofHash===spec.proofHash,'PENDING_FIRST_ORIGINAL_CHANGED');
      this.admission={stage:'resume',entry,limit:1};
    }else{
      // Hosted jobs depend on the finite continuation stage, so waiting workers
      // cannot exhaust runner capacity before the pending owners are scheduled.
      for(const e of spec.entries)await this.settled(e);
      const pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value;
      assert(pool && pool.nextBatchId<=101,'PENDING_FIRST_BATCH_BOUND');
      const batches=await this.store.getMany('state',Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${this.plan.trialId}:${i+1}`));
      assert(batches.every(Boolean),'PENDING_FIRST_BATCH_MISSING');
      const count=batches.filter(x=>x.value.worker===worker).reduce((n,x)=>n+x.value.journaled-x.value.start+1,0);
      const delta=count-(spec.baseline[worker]||0);
      assert(Number.isSafeInteger(delta) && delta>=0 && delta<=10,'PENDING_FIRST_QUOTA_CHANGED');
      this.admission={stage:'capture',limit:10-delta};
    }
    return this.admission;
  }
  checkLease(batch) {
    if(this.admission?.stage==='resume')assert(batch.id===this.admission.entry.batchId && batch.worker===this.admission.entry.worker,'PENDING_FIRST_BATCH_CHANGED');
  }
  beforeNewRequest() {
    assert(this.admission?.stage!=='resume','PENDING_FIRST_NEW_REQUEST_FORBIDDEN');
  }
}
