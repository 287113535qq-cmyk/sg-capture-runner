import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {veryFruityInit,veryFruityPayload} from '../trial/veryfruity-session.mjs';
import {parseXml,one} from '../trial/pearl-protocol.mjs';

// Read-only repair evidence. This neither clears a hold, changes a generation,
// retires a batch nor issues a source allowance. Those need online CAS controls.
export function reviewVeryFruityBootstrapFailure({plan,campaign,pool,batches,bootstrap,bootstrapKey,hold,ended,now}){
  assert(plan.gameId===32812&&plan.trialId==='sg_r1_20261003_32812'
    &&plan.adapter==='veryfruity-wms-action-v1'&&plan.betRaw===20&&plan.buy===0,
    'BOOTSTRAP_REPAIR_SCOPE');
  assert(ended.id===37045282759&&ended.run_attempt===1&&ended.status==='completed'
    &&ended.conclusion==='failure'&&ended.head_sha==='0258b2f75d643915e92f797df1d9b7c5ae9e3171'
    &&ended.path==='.github/workflows/trial-300k.yml','BOOTSTRAP_REPAIR_SOURCE');
  assert(campaign.group==='secondary'&&campaign.activeGame===plan.gameId
    &&campaign.protocolValidation?.runKey==='capture-run:37045282759:1'
    &&campaign.protocolValidation.commit===ended.head_sha
    &&pool.planHash===hash(plan)&&pool.confirmed===0&&pool.nextBatchId===2
    &&batches.length===1&&Object.keys(pool.workers).length===1,'BOOTSTRAP_REPAIR_SCENE');
  const b=batches[0],worker=pool.workers[String(b.worker)];
  assert(b.id===1&&b.worker>=20&&b.worker<40&&b.journaled===b.start-1
    &&b.checkpoint===b.journaled&&!b.pending&&!b.pendingOriginal
    &&b.bootstrapAwaiting?.msgId==='Init'&&b.leaseUntil<=now&&worker?.leaseUntil<=now
    &&worker.sessionHash===b.sessionHash,'BOOTSTRAP_REPAIR_BATCH');
  assert(bootstrap?.worker===b.worker&&bootstrapKey===`bootstrap:${plan.trialId}:${b.id}:${hash(bootstrap.step)}`
    &&bootstrap.step?.msgId==='Init'&&bootstrap.step.requestPayload===b.bootstrapAwaiting.payload
    &&bootstrap.step.responseXml===bootstrap.step.responsePayload,'BOOTSTRAP_REPAIR_FRAME');
  const s=bootstrap.step,q=parseXml(s.requestPayload),session=one(q,'Header').a.sessionID;
  assert(s.requestPayload===veryFruityPayload(plan,'Init',session),'BOOTSTRAP_REPAIR_REQUEST');
  const response=veryFruityInit(plan,s.responseXml);
  assert(response.balance===Number(s.responseBalance),'BOOTSTRAP_REPAIR_BALANCE');
  assert(hold.active===true&&hold.reason==='SOURCE_OR_STORAGE_REQUIRES_REVIEW'
    &&hold.details?.code==='VERYFRUITY_INIT_STAKES'&&hold.details.trialId===plan.trialId
    &&hold.details.batchId===b.id,'BOOTSTRAP_REPAIR_HOLD');
  return {schema:'sg-bootstrap-failure-review-v1',gameId:plan.gameId,trialId:plan.trialId,
    sourceRunKey:campaign.protocolValidation.runKey,sceneHash:hash({campaign,pool,batches,hold}),
    frameHash:hash(bootstrap),bootstrapAttempts:1,paidRequests:0,completePreserved:0,
    disposition:'bootstrap-response-retain-and-retire-without-replay',requiresNewSession:true,
    status:'online-retirement-and-runtime-binding-required',sourceRequests:0,newBetAllowance:0};
}
