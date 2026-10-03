import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {preparedSettledHistory} from './prepared-settled-history.mjs';

// An ended producer can have frozen the full audit before a final campaign CAS
// failed. Complete only that exact audited, fully settled allocation. No source,
// Mongo record insertion, quota change or another game's selection exists here.
export async function finalizePreparedAudit({store,plan,pool,spec,campaign,sourceRun,sourceCommit,boundary,now=Date.now}){
 const game=campaign?.games.find(g=>g.game_id===plan.gameId),proofKey='game-audit:'+plan.trialId;
 const proof=(await store.get('journal',proofKey))?.value;
 assert(plan.target===300000&&plan.buy===0&&plan.phase===1&&pool.enabled&&!pool.failure
  &&pool.confirmed===plan.target&&campaign.enabled&&campaign.activeGame===plan.gameId
  &&['ready','active'].includes(game?.status)&&!campaign.validationLimit&&!campaign.protocolValidation
  &&campaign.formalCount?.activation===spec.activation&&campaign.audit?.gameId===plan.gameId
  &&new RegExp(`^primary:${sourceRun}:[0-9]{1,2}$`).test(campaign.audit?.owner??''), 'PREPARED_AUDIT_SCENE');
 assert(proof?.trialId===plan.trialId&&proof.planHash===hash(plan)&&proof.fullReadback===plan.target
  &&/^[a-f0-9]{64}$/.test(proof.recordsHash??''),'PREPARED_AUDIT_FULL_PROOF');
 const history=await preparedSettledHistory({store,plan,pool,spec,now});
 const key=`prepared-audit-complete:${plan.trialId}:${sourceRun}`;
 assert(!await store.get('journal',key+':before'),'PREPARED_AUDIT_ALREADY_STARTED');
 const before={schema:'sg-prepared-audit-before-v1',sourceRun,sourceCommit,activation:spec.activation,
  planHash:hash(plan),poolHash:hash(pool),campaignHash:hash(campaign),proofHash:hash(proof),historyHash:hash(history),
  complete:plan.target,at:now(),sourceRequests:0,newBetAllowance:0};
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('state','campaign'))?.value)===hash(campaign)
  &&hash((await store.get('journal',proofKey))?.value)===hash(proof),'PREPARED_AUDIT_CHANGED');
 await store.create('journal',key+':before',before,{immutable:true});
 assert(hash((await store.get('journal',key+':before'))?.value)===hash(before),'PREPARED_AUDIT_READBACK');
 await boundary();
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===hash(pool)
  &&hash((await store.get('journal',proofKey))?.value)===hash(proof),'PREPARED_AUDIT_CHANGED');
 await store.update('state','campaign',v=>{
  assert(hash(v)===hash(campaign),'PREPARED_AUDIT_CHANGED');
  const g=v.games.find(g=>g.game_id===plan.gameId);g.status='complete';g.confirmed=proof.fullReadback;
  g.completed=before.at/1000;g.auditCompletionKey=key;v.activeGame=null;v.audit=null;return v;
 });
 const after=(await store.get('state','campaign'))?.value;
 assert(after.activeGame===null&&after.audit===null&&after.games.find(g=>g.game_id===plan.gameId)?.auditCompletionKey===key,'PREPARED_AUDIT_READBACK');
 const result={schema:'sg-prepared-audit-complete-v1',sourceRun,sourceCommit,activation:spec.activation,
  trialId:plan.trialId,proofHash:hash(proof),historyHash:hash(history),fullReadback:proof.fullReadback,
  sourceRequests:0,newBetAllowance:0,recordsHash:proof.recordsHash};
 await store.create('journal',key+':complete',result,{immutable:true});
 assert(hash((await store.get('journal',key+':complete'))?.value)===hash(result),'PREPARED_AUDIT_READBACK');
 return {auditedComplete:true,fullReadback:plan.target,sourceRequests:0,newBetAllowance:0};
}
