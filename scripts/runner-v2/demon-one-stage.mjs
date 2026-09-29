import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const STAGE_KEY='demon-one-stage:36551698305';
export async function beginStage(o,s,verified){
 assert(/^\d+:1$/.test(o.run) && !['36525403196:1','36551302211:1','36551698305:1'].includes(o.run),'NEW_UNIQUE_RUN_REQUIRED');
 assert(/^[a-f0-9]{40}$/.test(o.commit) && o.commit!=='4b38a0f306e6a3017b0245cd43a014acbc9a51ec','NEW_COMMIT_REQUIRED');
 assert(!(await o.store.get('journal',STAGE_KEY)),'STAGE_ALREADY_STARTED');
 const v={schema:'sg-demon-one-stage-v1',run:o.run,commit:o.commit,profileHash:hash(o.profile),snapshotHash:hash(s),ancestorReceiptHash:o.profile.ancestorReceiptHash,ancestorCompleteHash:o.profile.ancestorCompleteHash,verified,createdAt:o.now(),expiresAt:o.profile.createdAt+7200000};
 assert(v.createdAt>=o.profile.createdAt && v.createdAt<v.expiresAt && verified.count===246 && verified.committed===246,'STAGE_STALE_OR_INCOMPLETE');
 await o.store.create('journal',STAGE_KEY,v,{immutable:true});
 assert(hash((await o.store.get('journal',STAGE_KEY))?.value)===hash(v),'STAGE_READBACK_FAILED');
}
export async function stageBoundary(o){
 const s=(await o.store.get('journal',STAGE_KEY))?.value;
 if(!s){assert(o.recovering,'STAGE_REQUIRED');return;}
 assert(s.schema==='sg-demon-one-stage-v1' && s.commit===o.commit && s.profileHash===hash(o.profile)
  && s.ancestorReceiptHash===o.profile.ancestorReceiptHash && s.ancestorCompleteHash===o.profile.ancestorCompleteHash
  && o.now()>=s.createdAt && o.now()<s.expiresAt,'STAGE_BINDING_OR_EXPIRY_CHANGED');
 if(o.recovering)assert(s.run===o.run,'STAGE_OWNER_CHANGED');
 else{
  const done=(await o.store.get('journal',STAGE_KEY+':complete'))?.value;
  const proof=(await o.store.get('journal',o.prefix+':proof'))?.value;
  const result=(await o.store.get('journal',o.prefix+':reconciled'))?.value;
  assert(done?.stageHash===hash(s) && done.run===s.run && done.commit===s.commit
   && done.proofHash===proof?.proofHash && done.proofHash===result?.proofHash,'STAGE_NOT_COMPLETE');
 }
}
export async function completeStage(o,result){
 await stageBoundary(o);
 const stage=(await o.store.get('journal',STAGE_KEY)).value;
 assert(result.count===246 && result.oldPreserved===246 && result.originalPendingPreserved===1,'STAGE_RESULT_CHANGED');
 const v={stageHash:hash(stage),run:o.run,commit:o.commit,proofHash:result.proofHash,at:o.now()};
 await o.store.create('journal',STAGE_KEY+':complete',v,{immutable:true});
 assert(hash((await o.store.get('journal',STAGE_KEY+':complete'))?.value)===hash(v),'STAGE_COMPLETION_READBACK_FAILED');
}
