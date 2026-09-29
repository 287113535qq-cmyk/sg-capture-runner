import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
export const STAGE_KEY='demon-nested-stage:36562923330';
export async function beginStage(o,s,verified){
 assert(/^\d+:1$/.test(o.run) && !['36525403196:1','36551302211:1','36559066920:1','36558680223:1','36562547221:1','36562923330:1'].includes(o.run),'NEW_UNIQUE_RUN_REQUIRED');
 assert(/^[a-f0-9]{40}$/.test(o.commit) && !['4b38a0f306e6a3017b0245cd43a014acbc9a51ec','f68344a15e0185dfc26abc0c5f50ff98f6e0b50f','a7f550910c16e7de7bfa2fcb7c44ed73614905da'].includes(o.commit),'NEW_COMMIT_REQUIRED');
 assert(!(await o.store.get('journal',STAGE_KEY)),'STAGE_ALREADY_STARTED');
 const v={schema:'sg-demon-nested-stage-v1',run:o.run,commit:o.commit,profileHash:hash(o.profile),snapshotHash:hash(s),ancestorReceiptHash:o.profile.ancestorReceiptHash,ancestorCompleteHash:o.profile.ancestorCompleteHash,verified,createdAt:o.now(),expiresAt:o.profile.createdAt+7200000};
 assert(v.createdAt>=o.profile.createdAt && v.createdAt<v.expiresAt && verified.count===267 && verified.committed===256,'STAGE_STALE_OR_INCOMPLETE');
 await o.store.create('journal',STAGE_KEY,v,{immutable:true});
 assert(hash((await o.store.get('journal',STAGE_KEY))?.value)===hash(v),'STAGE_READBACK_FAILED');
}
export async function stageBoundary(o){
 const s=(await o.store.get('journal',STAGE_KEY))?.value;
 if(!s){assert(o.recovering,'STAGE_REQUIRED');return;}
 assert(s.schema==='sg-demon-nested-stage-v1' && s.commit===o.commit && s.profileHash===hash(o.profile)
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
 assert(result.count===267 && result.oldPreserved===267 && result.originalPendingPreserved===2 && result.flushed===11,'STAGE_RESULT_CHANGED');
 const v={stageHash:hash(stage),run:o.run,commit:o.commit,proofHash:result.proofHash,at:o.now()};
 await o.store.create('journal',STAGE_KEY+':complete',v,{immutable:true});
 assert(hash((await o.store.get('journal',STAGE_KEY+':complete'))?.value)===hash(v),'STAGE_COMPLETION_READBACK_FAILED');
}
