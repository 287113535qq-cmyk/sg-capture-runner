import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {beaverEvidence,beaverSequence} from '../trial/beaver-protocol.mjs';
import {PREFIX,STAGE} from './beaver-transition-contract.mjs';
export class BeaverPendingOnly{
 constructor(args){Object.assign(this,args);this.now??=Date.now;this.admission=null;}
 async load(identity){
  const c=(await this.store.get('state','campaign'))?.value,p=c?.protocolValidation;
  assert(this.stage==='resume'&&this.plan.gameId===32820&&this.plan.buy===0&&this.plan.phase===1,'BEAVER_PENDING_SCOPE');
  assert(c?.enabled&&c.activeGame===32820&&!c.audit&&!c.reason&&c.validationLimit===1&&p?.gameId===32820&&p.phase==='short'&&p.commit===identity.commitSha&&p.runKey===this.runKey&&/^capture-run:\d+:1$/.test(this.runKey),'BEAVER_PENDING_RUN');
  const get=async k=>(await this.store.get('journal',k))?.value;
  const spec=await get('beaver-pending:'+p.proofHash),s=await get(STAGE),done=await get(STAGE+':complete'),proof=await get(PREFIX+':proof'),result=await get(PREFIX+':result');
  assert(spec?.schema==='sg-beaver-pending-only-v1'&&hash(spec)===p.beaverPending&&spec.proofHash===p.proofHash&&spec.commit===p.commit&&spec.gameId===32820&&spec.trialId===this.plan.trialId&&spec.planHash===hash(this.plan)&&spec.stage===STAGE&&spec.newBetAllowance===0&&spec.limit===1,'BEAVER_PENDING_PROOF');
  assert(this.now()>=spec.createdAt&&this.now()<spec.expiresAt&&spec.expiresAt-spec.createdAt<=7200000,'BEAVER_PENDING_STALE');
  assert(s?.schema==='sg-beaver-transition-stage-v1'&&s.commit===p.commit&&s.expiresAt===spec.expiresAt&&proof?.proofHash===p.proofHash&&hash(proof.proof)===p.proofHash&&proof.proof.stageHash===hash(s)&&proof.proof.commit===p.commit&&proof.proof.run===s.run&&hash(proof.profile)===s.profileHash,'BEAVER_PENDING_STAGE');
  assert(done&&hash(done)===hash(result)&&done.proofHash===p.proofHash&&done.stageHash===hash(s)&&done.commit===p.commit&&done.run===s.run&&done.at>=s.createdAt&&done.at<=this.now()&&done.at<s.expiresAt&&done.flushed===38&&done.demonPreserved===446&&done.pendingPreserved===1&&done.sourceRequests===0&&done.newBetAllowance===0,'BEAVER_TRANSITION_INCOMPLETE');
  assert(spec.entry.worker===7&&spec.entry.batchId===2&&spec.entry.pending.sequence===120&&spec.entry.pending.awaiting===null&&hash(spec.entry.pending)==='d6ed5037762b0569a3287341471d8e2d36d225a4204f8a4cdf3d320744d472de','BEAVER_PENDING_IDENTITY');
  return spec;
 }
 async admit(identity,worker){
  const spec=await this.load(identity),e=spec.entry;
  assert(worker===7&&identity.shardId===7&&identity.sessionHash===e.sessionHash,'BEAVER_WRONG_WORKER');
  const pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value,b=(await this.store.get('state',`batch:${this.plan.trialId}:2`))?.value;
  assert(pool?.enabled&&!pool.failure&&pool.protocolRecovery===spec.proofHash&&pool.workers[7]?.sessionHash===e.sessionHash,'BEAVER_POOL_CHANGED');
  assert(b?.worker===7&&b.sessionHash===e.sessionHash&&!b.failure&&!b.bootstrapAwaiting&&!b.pendingOriginal&&b.journaled===119&&b.checkpoint===119&&hash(b.pending)===hash(e.pending)&&b.protocolResume?.schema===spec.schema&&b.protocolResume.proofHash===spec.proofHash&&b.protocolResume.pendingHash===hash(e.pending),'BEAVER_ORIGINAL_CHANGED');
  assert(beaverSequence(b.pending.raw,this.plan).next==='FREE_GAME','BEAVER_CONTINUATION_CHANGED');
  this.admission={stage:'resume',limit:1,entry:e};return this.admission;
 }
 checkLease(b){assert(this.admission&&b.id===2&&b.worker===7&&b.sessionHash===this.admission.entry.sessionHash,'BEAVER_LEASE_CHANGED');}
 beforeNewRequest(){throw Error('BEAVER_NEW_BET_FORBIDDEN');}
 async settled(identity){
  const spec=await this.load(identity),e=spec.entry,b=(await this.store.get('state',`batch:${this.plan.trialId}:2`))?.value,r=(await this.store.get('journal',receiptKey(this.plan.trialId,120)))?.value;
  assert(b&&b.checkpoint===120&&b.journaled===120&&!b.pending&&r?.trialId===this.plan.trialId&&r.batchId===2&&r.shardId===7&&r.sequence===120&&r.attempt===e.pending.attempt&&r.sourceSessionHash===e.sessionHash&&r.fixtureOnly===false&&r.buy===0&&r.raw.startBalanceRaw===e.pending.raw.startBalanceRaw&&r.raw.steps.length>e.pending.raw.steps.length&&hash(r.raw.steps.slice(0,e.pending.raw.steps.length))===hash(e.pending.raw.steps),'BEAVER_NOT_SETTLED');
  assert((await this.analyzer.call({op:'verify',plan:this.plan,raw:r.raw,record:r})).verified,'BEAVER_RECORD_INVALID');
  const evidence=beaverEvidence(r.raw,this.plan);assert(evidence.independentFid1&&r.bonus===2,'BEAVER_FEATURE_NOT_OBSERVED');
  const got=await this.transport.request('rounds_read',{trialId:this.plan.trialId,ids:[r._id]});assert(got.length===1&&hash(got[0])===hash(r),'BEAVER_MONGO_CHANGED');return {sequence:120,recordHash:hash(r),rawHash:hash(r.raw),newBetAllowance:0};
 }
}
