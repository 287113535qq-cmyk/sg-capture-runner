import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewVeryFruityBootstrapFailure} from './bootstrap-failure-review.mjs';
import {veryFruityPayload} from '../trial/veryfruity-session.mjs';
function fixture(){
 const plan={gameId:32812,trialId:'sg_r1_20261003_32812',adapter:'veryfruity-wms-action-v1',betRaw:20,buy:0,
  requestHeader:{gameCodeRGI:'veryfruity',gameID:'20206',versionID:'1_0',freePlay:'Y',promotions:'N',ccyCode:'',lang:'en_US'}};
 const payload=veryFruityPayload(plan,'Init','offline-new');
 const xml='<GameResponse type="Init"><Header gameID="20206" versionID="1_0" ccyCode="" lang="en_US" isRecovering="N" sessionID="offline-next"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><Stakes count="2" defaultIndex="0">20|40</Stakes><AccountData/><Paylines><PaylineInfo>'+Array.from({length:20},(_,i)=>`<Payline index="${i}" selectable="${i===19?'Y':'N'}"/>`).join('')+'</PaylineInfo></Paylines></GameResponse>';
 const step={msgId:'Init',requestPayload:payload,responsePayload:xml,responseXml:xml,responseBalance:1000};
 const bootstrap={worker:28,step};
 const ended={id:37045282759,run_attempt:1,status:'completed',conclusion:'failure',head_sha:'0258b2f75d643915e92f797df1d9b7c5ae9e3171',path:'.github/workflows/trial-300k.yml'};
 return {plan,ended,now:1000,campaign:{group:'secondary',activeGame:32812,protocolValidation:{runKey:'capture-run:37045282759:1',commit:ended.head_sha}},
  pool:{planHash:hash(plan),confirmed:0,nextBatchId:2,workers:{28:{sessionHash:'offline-session',leaseUntil:0}}},
  batches:[{id:1,worker:28,start:1,journaled:0,checkpoint:0,pending:null,leaseUntil:0,sessionHash:'offline-session',bootstrapAwaiting:{msgId:'Init',payload}}],
  bootstrap,bootstrapKey:`bootstrap:${plan.trialId}:1:${hash(step)}`,
  hold:{active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'VERYFRUITY_INIT_STAKES',trialId:plan.trialId,batchId:1}}};
}
test('durable Init failure is a zero-paid review, with no state change or source authority',()=>{
 const f=fixture(),before=hash(f),r=reviewVeryFruityBootstrapFailure(f);
 assert.equal(r.paidRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(r.requiresNewSession,true);
 assert.equal(r.status,'online-retirement-and-runtime-binding-required');assert.equal(hash(f),before);
});
test('unknown source, paid activity, mismatched original XML and active owners retain protection',()=>{
 for(const change of [f=>f.ended.status='in_progress',f=>f.ended.id++,f=>f.pool.confirmed++,
  f=>f.batches[0].pending={raw:{}},f=>f.batches[0].journaled++,f=>f.batches[0].leaseUntil=2000,
  f=>f.pool.workers[28].leaseUntil=2000,f=>f.bootstrap.step.responseXml+=' ',
  f=>f.bootstrapKey+='0',f=>f.hold.details.code='SOURCE_NETWORK_OUTCOME_UNKNOWN',
  f=>f.hold.details.batchId=2,f=>f.campaign.protocolValidation.runKey='capture-run:1:1']){
  const f=fixture();change(f);assert.throws(()=>reviewVeryFruityBootstrapFailure(f));
 }
});
