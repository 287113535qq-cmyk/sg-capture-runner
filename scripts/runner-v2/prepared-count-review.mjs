import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewPreparedCountScene} from './prepared-count-scene.mjs';

export async function exportPreparedCountReview(args){
 const scene=await reviewPreparedCountScene(args);
 return {schema:'sg-prepared-count-review-task-v1',gameId:args.base.gameId,trialId:args.base.trialId,
  group:args.group,basePlanHash:hash(args.base),publicationHash:hash(args.publication),scene,sceneHash:hash(scene),
  reviewedAt:(args.now??Date.now)(),sourceAllowance:0};
}
export function validatePreparedCountReview(task){
 assert(task?.schema==='sg-prepared-count-review-task-v1'&&task.sourceAllowance===0
  &&Number.isSafeInteger(task.gameId)&&['primary','secondary'].includes(task.group)
  &&task.sceneHash===hash(task.scene)&&Number.isSafeInteger(task.reviewedAt)
  &&task.scene?.sourceRequests===0&&task.scene.newBetAllowance===0
  &&task.scene.completePreserved===task.scene.closed?.completePreserved
  &&task.scene.recordsHash===task.scene.closed?.recordsHash
  &&Array.isArray(task.scene.batches)&&task.scene.batches.length<=1000,
  'PREPARED_COUNT_REVIEW_CHANGED');
 for(const f of ['basePlanHash','publicationHash','sceneHash'])assert(/^[a-f0-9]{64}$/.test(task[f]??''),'PREPARED_COUNT_REVIEW_BINDING');
 return task;
}
