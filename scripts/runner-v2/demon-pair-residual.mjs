import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {ZERO_PROOF,ZERO_SPEC_HASH} from './demon-nested-short.mjs';
import {INCIDENT} from './demon-pair-review.mjs';
export class PairResidual{
 constructor({store,plan,stage,runKey,now=Date.now}){Object.assign(this,{store,plan,stage,runKey,now});this.admission=null;}
 async load(identity){
  const get=async(c,k)=>(await this.store.get(c,k))?.value;
  const c=await get('state','campaign'),p=c?.protocolValidation;
  assert(this.stage==='fresh'&&c?.enabled&&c.activeGame===32739&&c.games.find(g=>g.game_id===32739)?.status==='active'&&c.validationLimit===10&&p?.phase==='short'&&p.gameId===32739&&!p.pendingFirst&&!p.nestedShort&&p.freshStart&&p.commit===identity.commitSha&&p.commit!==INCIDENT.commit&&p.proofHash!==INCIDENT.proof&&/^capture-run:\d+:1$/.test(this.runKey||'')&&p.runKey===this.runKey,'PAIR_RUN_NOT_AUTHORIZED');
  const spec=await get('journal','fresh-start:'+p.proofHash),original=await get('journal','fresh-start:'+ZERO_PROOF);
  assert(spec&&hash(spec)===p.freshStart&&spec.schema==='sg-demon-pair-residual-v1'&&spec.proofHash===p.proofHash&&spec.commit===p.commit&&spec.gameId===32739&&spec.trialId===this.plan.trialId&&spec.planHash===hash(this.plan)&&spec.originalPending===0&&spec.perWorker===10&&spec.originalComplete===246&&spec.currentComplete===267&&spec.finalComplete===446&&spec.totalRemaining===179&&spec.recoveryPrefix===INCIDENT.prefix&&spec.stageKey===INCIDENT.stage&&spec.originalSpecHash===ZERO_SPEC_HASH&&hash(original)===ZERO_SPEC_HASH&&hash(spec.baseline)===hash(original.baseline),'PAIR_PERMISSION_CHANGED');
  assert(this.now()>=spec.createdAt&&this.now()<spec.expiresAt&&spec.expiresAt>spec.createdAt&&spec.expiresAt-spec.createdAt<=7200000,'PAIR_PERMISSION_STALE');
  const proof=await get('journal',INCIDENT.prefix+':proof'),stage=await get('journal',INCIDENT.stage),done=await get('journal',INCIDENT.stage+':complete'),result=await get('journal',INCIDENT.prefix+':reconciled');
  assert(proof?.proofHash===p.proofHash&&hash(proof.proof)===p.proofHash&&proof.proof.commit===p.commit&&hash(proof.profile)===proof.proof.profileHash&&stage?.profileHash===proof.proof.profileHash&&stage.commit===p.commit&&stage.run===proof.proof.run&&done?.stageHash===hash(stage)&&done.run===stage.run&&done.commit===stage.commit&&done.proofHash===p.proofHash&&done.at>=stage.createdAt&&done.at<stage.expiresAt&&this.now()>=done.at&&this.now()<stage.expiresAt&&stage.createdAt>=proof.profile.createdAt&&stage.expiresAt===proof.profile.createdAt+7200000,'PAIR_STAGE_NOT_COMPLETE');
  assert(result?.proofHash===p.proofHash&&result.count===267&&result.committed===267&&result.oldPreserved===267&&result.flushed===0&&result.abandonedAttempts===2&&result.originalPendingPreserved===0&&result.sourceRequests===0&&result.replayedBets===0&&result.validRecordsDeleted===0,'PAIR_RECOVERY_NOT_COMPLETE');
  const before=await get('journal',INCIDENT.prefix+':before');
  assert(before&&hash({campaign:before.campaign,pool:before.pool,batches:before.batches})===proof.proof.snapshotHash,'PAIR_BEFORE_CHANGED');
  const counts=Object.fromEntries(Array.from({length:20},(_,w)=>[w,0]));
  for(const {value:b} of before.batches){assert(Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20&&b.checkpoint===b.journaled,'PAIR_BASELINE_CHANGED');counts[b.worker]+=b.journaled-b.start+1;}
  assert(hash(counts)===hash(spec.initialCounts)&&Object.values(counts).reduce((a,b)=>a+b,0)===267&&Object.keys(spec.remaining).length===20&&Object.keys(counts).every(w=>spec.remaining[w]===10-(counts[w]-spec.baseline[w])&&Number.isSafeInteger(spec.remaining[w])&&spec.remaining[w]>=0&&spec.remaining[w]<=10)&&Object.values(spec.remaining).reduce((a,b)=>a+b,0)===179,'PAIR_BASELINE_CHANGED');
  for(const e of INCIDENT.rejected){const a=await get('journal',INCIDENT.prefix+':abandoned:'+e.batch),b=before.batches.find(x=>x.value.id===e.batch)?.value;
   assert(a?.proofHash===p.proofHash&&a.worker===e.worker&&a.pending.sequence===e.sequence&&a.sessionHash===b?.sessionHash&&hash(a.pending)===hash(b.pending)&&a.disposition==='source-invalid-session/abandon_without_replay','PAIR_ARCHIVE_MISSING');}
  return spec;
 }
 async admit(identity,worker){
  assert(Number.isInteger(worker)&&worker>=0&&worker<20&&identity.shardId===worker,'PAIR_WORKER_CHANGED');
  const spec=await this.load(identity),pool=(await this.store.get('state','pool:'+this.plan.trialId))?.value;
  assert(pool?.enabled&&!pool.failure&&pool.protocolRecovery===spec.proofHash&&pool.nextBatchId>=20&&pool.nextBatchId<=101&&pool.workers[worker]?.sessionHash===identity.sessionHash,'PAIR_POOL_CHANGED');
  const rows=await this.store.getMany('state',Array.from({length:pool.nextBatchId-1},(_,i)=>`batch:${this.plan.trialId}:${i+1}`));assert(rows.every(Boolean),'PAIR_BATCH_MISSING');
  const owned=rows.filter(x=>x.value.worker===worker);assert(owned.every(x=>!x.value.pending&&!x.value.pendingOriginal&&!x.value.bootstrapAwaiting),'PAIR_PENDING_REQUIRES_REVIEW');
  const count=owned.reduce((n,x)=>n+x.value.journaled-x.value.start+1,0),delta=count-spec.baseline[worker];
  assert(Number.isSafeInteger(delta)&&delta>=spec.initialCounts[worker]-spec.baseline[worker]&&delta<=10,'PAIR_QUOTA_CHANGED');
  this.admission={stage:'fresh',limit:10-delta};return this.admission;
 }
 checkLease(){assert(this.admission,'PAIR_ADMISSION_REQUIRED');}
 beforeNewRequest(){assert(this.admission,'PAIR_ADMISSION_REQUIRED');}
}
