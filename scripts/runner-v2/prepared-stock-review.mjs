import assert from 'node:assert/strict';
import {publishedPreparedSelector} from './prepared-campaign-selector.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

// Exercise the actual capture selector against published evidence and the
// current campaign. This is a read-only consumer check, never activation.
export async function reviewPreparedStock({publication,plans,campaign,group,readEvidence}){
 assert(['primary','secondary'].includes(group)&&Array.isArray(campaign?.games),'PREPARED_STOCK_SCOPE');
 const select=publishedPreparedSelector({publication,plans,readEvidence}),verifiedGames=[];
 for(const row of publication.inventory.tasks.filter(t=>t.status==='prepared')){
  if(publication.bindings[String(row.gameId)]?.group!==group)continue;
  assert(await select({readyGameIds:[row.gameId],group})===row.gameId,'PREPARED_STOCK_PROOF');
  verifiedGames.push(row.gameId);
 }
 const readyGameIds=campaign.games.filter(g=>g.status==='ready').map(g=>g.game_id);
 const eligibleGame=await select({readyGameIds,group});
 const report={schema:'sg-prepared-stock-review-v1',group,publicationHash:hash(publication),
  campaignHash:hash(campaign),verifiedGames,eligibleGame,sourceRequests:0,mongoWrites:0,
  newBetAllowance:0,activated:false,requiresFreshPermission:true};
 return {schema:'sg-prepared-stock-review-task-v1',sourceAllowance:0,report,reportHash:hash(report)};
}
export function validatePreparedStockReview(task){
 assert(task?.schema==='sg-prepared-stock-review-task-v1'&&task.sourceAllowance===0
  &&task.reportHash===hash(task.report)&&task.report?.schema==='sg-prepared-stock-review-v1'
  &&task.report.sourceRequests===0&&task.report.mongoWrites===0&&task.report.newBetAllowance===0
  &&task.report.activated===false&&task.report.requiresFreshPermission===true,'PREPARED_STOCK_DELIVERY');
 return task;
}
