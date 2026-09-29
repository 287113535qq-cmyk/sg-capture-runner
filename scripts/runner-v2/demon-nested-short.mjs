import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const ZERO_PROOF='3b1c3bfed941b58dd2aca4201ed700e9c18c2180a50cce08021485f6a20534f8';
export const ZERO_SPEC_HASH='728a31d0f34feb37d6b0da3f8f7dd93b6e3b73e7b3bfa3cce7909b336e9a5814';
export const NESTED_STAGE='demon-nested-stage:36562923330';
export function nestedShortPlan({plan,batches,original,proofHash,commit,createdAt,expiresAt}){
 assert(hash(original)===ZERO_SPEC_HASH && original.proofHash===ZERO_PROOF,'ORIGINAL_QUOTA_CHANGED');
 assert(plan.gameId===32739 && plan.buy===0 && plan.phase===1 && original.planHash===hash(plan),'NESTED_SCOPE_CHANGED');
 assert(/^[a-f0-9]{64}$/.test(proofHash)&&/^[a-f0-9]{40}$/.test(commit)&&expiresAt>createdAt&&expiresAt-createdAt<=7200000,'NESTED_PERMISSION_CHANGED');
 const counts=Object.fromEntries(Array.from({length:20},(_,i)=>[i,0]));
 const entries=[];
 for(const {value:b} of batches){
  assert(Number.isInteger(b.worker)&&b.worker>=0&&b.worker<20,'NESTED_WORKER_CHANGED');
  counts[b.worker]+=b.journaled-b.start+1;
  if(b.pending){assert(b.pending.awaiting===null,'UNKNOWN_SOURCE_OUTCOME');entries.push({batchId:b.id,worker:b.worker,sessionHash:b.sessionHash,pending:structuredClone(b.pending)});}
 }
 assert(hash(entries.map(e=>e.worker).sort((a,b)=>a-b))===hash([0,14]),'NESTED_OWNERS_CHANGED');
 const baseline=original.baseline;
 assert(Object.values(counts).reduce((a,b)=>a+b,0)===267&&Object.values(baseline).reduce((a,b)=>a+b,0)===246,'NESTED_COUNTS_CHANGED');
 const remaining=Object.fromEntries(Object.keys(counts).map(w=>[w,10-(counts[w]-(baseline[w]||0))]));
 assert(Object.values(remaining).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10)&&remaining[0]===4&&remaining[13]===0&&remaining[14]===5&&Object.values(remaining).reduce((a,b)=>a+b,0)===179,'NESTED_QUOTA_CHANGED');
 return {schema:'sg-demon-nested-short-v1',gameId:32739,trialId:plan.trialId,planHash:hash(plan),proofHash,commit,createdAt,expiresAt,
  perWorker:10,baseline:structuredClone(baseline),entries,initialCounts:counts,remaining,originalSpecHash:hash(original),stageKey:NESTED_STAGE};
}
export async function loadNestedShort(o,identity,c){
 const p=c.protocolValidation;
 assert(['resume','capture'].includes(o.stage)&&c.enabled&&c.activeGame===32739&&c.validationLimit===10&&p.phase==='short'
  &&p.commit===identity.commitSha&&/^capture-run:\d+:1$/.test(o.runKey||'')&&p.runKey===o.runKey,'NESTED_RUN_CHANGED');
 const spec=(await o.store.get('journal','pending-first:'+p.proofHash))?.value;
 const original=(await o.store.get('journal','fresh-start:'+ZERO_PROOF))?.value;
 assert(spec&&spec.schema==='sg-demon-nested-short-v1'&&hash(spec)===p.nestedShort&&spec.proofHash===p.proofHash&&spec.commit===p.commit
  &&spec.planHash===hash(o.plan)&&spec.trialId===o.plan.trialId&&spec.perWorker===10&&spec.stageKey===NESTED_STAGE
  &&hash(original)===ZERO_SPEC_HASH&&spec.originalSpecHash===ZERO_SPEC_HASH&&hash(spec.baseline)===hash(original.baseline),'NESTED_PROOF_CHANGED');
 assert(o.now()>=spec.createdAt&&o.now()<spec.expiresAt&&spec.expiresAt-spec.createdAt<=7200000,'NESTED_PROOF_STALE');
 const stage=(await o.store.get('journal',NESTED_STAGE))?.value,done=(await o.store.get('journal',NESTED_STAGE+':complete'))?.value;
 const proof=(await o.store.get('journal','demon-nested:demon-nested-36562923330:proof'))?.value;
 const result=(await o.store.get('journal','demon-nested:demon-nested-36562923330:reconciled'))?.value;
 assert(stage&&done&&stage.commit===p.commit&&done.stageHash===hash(stage)&&done.run===stage.run&&done.commit===stage.commit
  &&done.proofHash===p.proofHash&&proof?.proofHash===p.proofHash&&hash(proof.proof)===p.proofHash
  &&proof.proof.run===stage.run&&proof.proof.commit===stage.commit&&hash(proof.profile)===stage.profileHash
  &&done.at>=stage.createdAt&&done.at<stage.expiresAt&&o.now()<stage.expiresAt
  &&proof.proof.profileHash===stage.profileHash&&result?.proofHash===p.proofHash&&result.count===267&&result.committed===267
  &&result.originalPendingPreserved===2&&result.flushed===11&&result.oldPreserved===267
  &&result.abandonedAttempts===0&&result.sourceRequests===0&&result.replayedBets===0&&result.validRecordsDeleted===0,'NESTED_RECOVERY_NOT_COMPLETE');
 assert(hash(spec.entries.map(e=>e.worker).sort((a,b)=>a-b))===hash([0,14])&&spec.entries.every(e=>e.pending.awaiting===null),'NESTED_OWNERS_CHANGED');
 return spec;
}
