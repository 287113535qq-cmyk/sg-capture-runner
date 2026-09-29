import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {INCIDENT as I} from './demon-pair-review.mjs';
export async function stageBoundary(o){
 const s=(await o.store.get('journal',I.stage))?.value;
 if(!s){assert(o.recovering,'PAIR_STAGE_REQUIRED');return;}
 assert(s.schema==='sg-demon-pair-stage-v1'&&s.commit===o.commit&&s.profileHash===hash(o.profile)&&s.previousProof===I.proof&&o.now()>=s.createdAt&&o.now()<s.expiresAt&&s.expiresAt===o.profile.createdAt+7200000,'PAIR_STAGE_CHANGED');
 if(o.recovering)assert(s.run===o.run,'PAIR_STAGE_OWNER_CHANGED');
 else{const d=(await o.store.get('journal',I.stage+':complete'))?.value,p=(await o.store.get('journal',I.prefix+':proof'))?.value,r=(await o.store.get('journal',I.prefix+':reconciled'))?.value;
  assert(d?.stageHash===hash(s)&&d.run===s.run&&d.commit===s.commit&&d.proofHash===p?.proofHash&&d.proofHash===r?.proofHash,'PAIR_STAGE_INCOMPLETE');}
}
export async function beginStage(o,s,full){
 assert(/^\d+:1$/.test(o.run)&&!['36525403196:1','36551302211:1','36559066920:1','36558680223:1','36562547221:1','36562923330:1','36574038011:1','36574646755:1',I.run,I.failedRun.slice(12)].includes(o.run)&&/^[a-f0-9]{40}$/.test(o.commit)&&!['4b38a0f306e6a3017b0245cd43a014acbc9a51ec','f68344a15e0185dfc26abc0c5f50ff98f6e0b50f','a7f550910c16e7de7bfa2fcb7c44ed73614905da','bc0348918dc6d79c347cb84cd582928b9a77a6aa',I.commit].includes(o.commit),'PAIR_NEW_RUNTIME_REQUIRED');
 assert(!(await o.store.get('journal',I.stage))&&!(await o.store.get('journal',I.prefix+':proof')),'PAIR_ALREADY_STARTED');
 assert(full.count===267&&full.committed===267&&o.now()>=o.profile.createdAt&&o.now()<o.profile.createdAt+7200000,'PAIR_STAGE_STALE');
 const v={schema:'sg-demon-pair-stage-v1',run:o.run,commit:o.commit,profileHash:hash(o.profile),snapshotHash:hash(s),previousProof:I.proof,verified:full,createdAt:o.now(),expiresAt:o.profile.createdAt+7200000};
 await o.store.create('journal',I.stage,v,{immutable:true});assert(hash((await o.store.get('journal',I.stage))?.value)===hash(v),'PAIR_STAGE_READBACK_FAILED');
}
export async function completeStage(o,r){
 await stageBoundary(o);assert(r.count===267&&r.committed===267&&r.oldPreserved===267&&r.flushed===0&&r.abandonedAttempts===2&&r.originalPendingPreserved===0&&r.sourceRequests===0,'PAIR_RESULT_CHANGED');
 const s=(await o.store.get('journal',I.stage)).value,v={stageHash:hash(s),run:o.run,commit:o.commit,proofHash:r.proofHash,at:o.now()};
 await o.store.create('journal',I.stage+':complete',v,{immutable:true});assert(hash((await o.store.get('journal',I.stage+':complete'))?.value)===hash(v),'PAIR_COMPLETION_READBACK_FAILED');
}
