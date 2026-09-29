import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const ZERO_PREFIX='demon-zero:demon-zero-36559066920';
export const ZERO_STAGE='demon-zero-stage:36559066920';
export function freshStartPlan({plan,batches,proofHash,commit,createdAt,expiresAt}){
 assert(plan.gameId===32739 && plan.phase===1 && plan.buy===0 && /^[a-f0-9]{64}$/.test(proofHash)
  && /^[a-f0-9]{40}$/.test(commit) && expiresAt>createdAt && expiresAt-createdAt<=7200000,'FRESH_SCOPE_CHANGED');
 assert(batches.length===19 && batches.every(x=>!x.value.pending && !x.value.pendingOriginal && !x.value.bootstrapAwaiting),'FRESH_ORIGINAL_PENDING_EXISTS');
 const baseline=Object.fromEntries(Array.from({length:20},(_,w)=>[w,0]));
 for(const {value:b} of batches){assert(b.checkpoint===b.journaled && Number.isInteger(b.worker) && b.worker>=0 && b.worker<20,'FRESH_UNCOMMITTED_RECORDS');baseline[b.worker]+=b.journaled-b.start+1;}
 assert(Object.values(baseline).reduce((a,b)=>a+b,0)===246,'FRESH_BASELINE_CHANGED');
 return {schema:'sg-demon-zero-short-v1',gameId:32739,trialId:plan.trialId,planHash:hash(plan),proofHash,commit,createdAt,expiresAt,
  recoveryPrefix:ZERO_PREFIX,stageKey:ZERO_STAGE,originalPending:0,perWorker:10,totalNew:200,baseline};
}
export class FreshStart{
 constructor({store,plan,stage,runKey,now=Date.now}){Object.assign(this,{store,plan,stage,runKey,now});this.admission=null;}
 async load(identity){
  const c=(await this.store.get('state','campaign'))?.value,p=c?.protocolValidation;
  assert(this.stage==='fresh' && c?.enabled && c.activeGame===32739 && c.validationLimit===10 && p?.phase==='short'
   && p.gameId===32739 && !p.pendingFirst && p.freshStart && p.commit===identity.commitSha
   && /^capture-run:\d+:1$/.test(this.runKey||'') && p.runKey===this.runKey,'FRESH_RUN_NOT_AUTHORIZED');
  const spec=(await this.store.get('journal','fresh-start:'+p.proofHash))?.value;
  assert(spec && hash(spec)===p.freshStart && spec.schema==='sg-demon-zero-short-v1' && spec.originalPending===0
   && spec.recoveryPrefix===ZERO_PREFIX && spec.stageKey===ZERO_STAGE && spec.perWorker===10 && spec.totalNew===200
   && spec.gameId===32739 && spec.trialId===this.plan.trialId && spec.planHash===hash(this.plan)
   && spec.commit===p.commit && spec.proofHash===p.proofHash,'FRESH_PROOF_CHANGED');
  assert(this.now()>=spec.createdAt && this.now()<spec.expiresAt && spec.expiresAt>spec.createdAt && spec.expiresAt-spec.createdAt<=7200000,'FRESH_PROOF_STALE');
  const proof=(await this.store.get('journal',ZERO_PREFIX+':proof'))?.value;
  const result=(await this.store.get('journal',ZERO_PREFIX+':reconciled'))?.value;
  const stage=(await this.store.get('journal',ZERO_STAGE))?.value,done=(await this.store.get('journal',ZERO_STAGE+':complete'))?.value;
  assert(proof?.proofHash===p.proofHash && hash(proof.proof)===p.proofHash && proof.proof.commit===p.commit
   && hash(proof.profile)===proof.proof.profileHash && stage?.profileHash===proof.proof.profileHash
   && stage.commit===p.commit && stage.run===proof.proof.run && done?.stageHash===hash(stage)
   && done.run===stage.run && done.commit===stage.commit && done.proofHash===p.proofHash
   && done.at>=stage.createdAt && done.at<stage.expiresAt && this.now()>=done.at && this.now()<stage.expiresAt
   && result?.proofHash===p.proofHash && result.count===246 && result.oldPreserved===246
   && result.originalPendingPreserved===0 && result.abandonedAttempts===1 && result.sourceRequests===0,'FRESH_RECOVERY_NOT_COMPLETE');
  const counts=proof.proof.verified.workerCounts;
  assert(proof.proof.verified.count===246 && proof.proof.verified.committed===246
   && Object.keys(spec.baseline).length===20 && Object.keys(counts).every(w=>/^\d+$/.test(w) && Number(w)<20)
   && Array.from({length:20},(_,w)=>w).every(w=>Number.isSafeInteger(spec.baseline[w]) && spec.baseline[w]>=0 && spec.baseline[w]===(counts[w]||0)),'FRESH_BASELINE_CHANGED');
  return spec;
 }
 async admit(identity,worker){
  assert(Number.isInteger(worker) && worker>=0 && worker<20 && identity.shardId===worker,'FRESH_WORKER_CHANGED');
  const spec=await this.load(identity),pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value;
  assert(pool && pool.protocolRecovery===spec.proofHash && pool.nextBatchId>=20 && pool.nextBatchId<=101
   && pool.workers[worker]?.sessionHash===identity.sessionHash,'FRESH_POOL_CHANGED');
  const rows=await this.store.getMany('state',Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${this.plan.trialId}:${i+1}`));
  assert(rows.every(Boolean),'FRESH_BATCH_MISSING');
  const owned=rows.filter(x=>x.value.worker===worker);
  assert(owned.every(x=>!x.value.pending && !x.value.pendingOriginal && !x.value.bootstrapAwaiting),'FRESH_PENDING_REQUIRES_REVIEW');
  const count=owned.reduce((n,x)=>n+x.value.journaled-x.value.start+1,0),delta=count-(spec.baseline[worker]||0);
  assert(Number.isSafeInteger(delta) && delta>=0 && delta<=10,'FRESH_QUOTA_CHANGED');
  this.admission={stage:'fresh',limit:10-delta};return this.admission;
 }
 checkLease(){assert(this.admission,'FRESH_ADMISSION_REQUIRED');}
 beforeNewRequest(){assert(this.admission,'FRESH_ADMISSION_REQUIRED');}
}
