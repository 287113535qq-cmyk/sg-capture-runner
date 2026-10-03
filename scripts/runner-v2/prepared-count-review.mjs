import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewPreparedCountScene} from './prepared-count-scene.mjs';
import {reviewPreparedCountRepairScene} from './prepared-count-repair-scene.mjs';

export async function exportPreparedCountReview(args){
 const pool=(await args.store.get('state','pool:'+args.base.trialId))?.value;
 let parent=args.parent;
 if(pool?.countAllocation&&!parent){
  const c=(await args.store.get('state','campaign'))?.value;
  const game=c?.games.find(g=>g.game_id===args.base.gameId);
  const repair=(await args.store.get('state',game?.repairKey))?.value;
  assert(repair?.archiveKey?.startsWith('count-prepared-close:'+args.base.trialId+':')
    &&repair.archiveKey.endsWith(':before'),'PREPARED_REPAIR_PARENT');
  const closureKey=repair.archiveKey.slice(0,-':before'.length)+':complete';
  const closed=(await args.store.get('journal',closureKey))?.value;
  const spec=(await args.store.get('journal',`complete-count:${args.base.trialId}:${closed?.activation}`))?.value;
  assert(closed?.schema==='sg-count-prepared-close-v1'&&spec,'PREPARED_REPAIR_PARENT');
  parent={activation:closed.activation,sourceCommit:closed.sourceCommit,sourceRun:closed.sourceRun,specHash:hash(spec),closureKey};
 }
 const scene=await (parent?reviewPreparedCountRepairScene:reviewPreparedCountScene)({...args,parent});
 return {schema:'sg-prepared-count-review-task-v1',gameId:args.base.gameId,trialId:args.base.trialId,
  group:args.group,basePlanHash:hash(args.base),publicationHash:hash(args.publication),scene,sceneHash:hash(scene),
  reviewedAt:(args.now??Date.now)(),...(parent?{repairParent:parent}:{}),sourceAllowance:0};
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
 if(task.repairParent){
  const p=task.repairParent,c=task.scene.closed;
  assert(p.activation===task.scene.parentActivation&&p.specHash===task.scene.parentSpecHash
   &&p.activation===c.activation&&p.sourceCommit===c.sourceCommit&&p.sourceRun===c.sourceRun
   &&/^[a-f0-9]{64}$/.test(p.activation??'')&&/^[a-f0-9]{64}$/.test(p.specHash??'')
   &&/^[a-f0-9]{40}$/.test(p.sourceCommit??'')&&/^\d+:1$/.test(p.sourceRun??'')
   &&['shared','parked','prepared'].some(k=>p.closureKey===`count-${k}-close:${task.trialId}:${p.sourceRun}:complete`),
  'PREPARED_COUNT_REPAIR_PARENT_CHANGED');
 }
 return task;
}
