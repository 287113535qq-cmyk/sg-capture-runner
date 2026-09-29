import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewNestedAncestor} from './demon-nested-rebind.mjs';
import {INCIDENT as I} from './demon-pair-review.mjs';
export async function reviewRebindAncestor(o){
 const get=async k=>(await o.store.get('journal',k))?.value;
 const p=await get(I.previousPrefix+':proof');
 assert(p?.proofHash===I.proof&&hash(p.proof)===I.proof&&hash(p.profile)===I.profile&&p.proof.profileHash===I.profile&&p.proof.commit===I.commit&&p.proof.run===I.run,'REBIND_ANCESTOR_PROOF_CHANGED');
 // Historical expiry remains historical; never extend a previous receipt.
 await reviewNestedAncestor({store:o.store,profile:p.profile,now:o.now});
 const stage=await get(I.previousStage),done=await get(I.previousStage+':complete'),r=await get(I.previousPrefix+':reconciled'),b=await get(I.previousPrefix+':backup-complete'),spec=await get('pending-first:'+I.proof),before=await get(I.previousPrefix+':before');
 assert(stage?.schema==='sg-demon-nested-rebind-stage-v1'&&stage.profileHash===I.profile&&stage.commit===I.commit&&stage.run===I.run&&done?.stageHash===hash(stage)&&done.commit===I.commit&&done.run===I.run&&done.proofHash===I.proof&&done.at>=stage.createdAt&&done.at<stage.expiresAt&&o.now()>=done.at,'REBIND_ANCESTOR_STAGE_CHANGED');
 assert(r?.proofHash===I.proof&&r.count===267&&r.committed===267&&r.oldPreserved===267&&r.flushed===0&&r.originalPendingPreserved===2&&r.abandonedAttempts===0&&r.sourceRequests===0&&b?.proofHash===I.proof&&b.recordsHash===r.recordsHash&&hash(spec)===I.spec,'REBIND_ANCESTOR_RESULT_CHANGED');
 assert(before&&hash({campaign:before.campaign,pool:before.pool,batches:before.batches})===p.proof.snapshotHash&&b.snapshotHash===p.proof.snapshotHash,'REBIND_ANCESTOR_BEFORE_CHANGED');
 return {before,spec,result:r,profile:p.profile};
}
