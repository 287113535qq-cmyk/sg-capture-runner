import test from 'node:test';import assert from 'node:assert/strict';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import fs from 'node:fs';
import {ACTION_VERSION,ACTION_CONTRACT_HASH} from '../trial/huff-action-contract.mjs';
test('prepared formal permission binds exact reviewed profile and counts preserved complete rounds without a new pilot quota',()=>{
 const base={gameId:1,trialId:'fixture',buy:0,phase:1,target:299900};
 const p={schema:'sg-prepared-count-profile-v1',gameId:1,trialId:'fixture',group:'primary',basePlanHash:hash(base),
  targetComplete:300000,completePreserved:152,remainingComplete:299848,maxSequence:600000,
  sessionRotation:'closed-batches-v1',newBetAllowance:0,requiresNewSession:true,createdAt:0,expiresAt:7200000};
 for(const f of ['activation','preparationProofHash','failureEvidenceHash','sceneHash','recordsHash','closureHash'])p[f]='a'.repeat(64);
 p.planHash=hash({...base,target:300000,countAllocation:p.activation});
 const auth=x=>({schema:'sg-prepared-count-authorization-v1',gameId:1,trialId:'fixture',group:'primary',
  basePlanHash:hash(base),activation:x.activation,profileHash:hash(x)});
 assert.equal(preparedCountPlan(base,p,auth(p)).target,300000);
 assert.equal(base.target,299900);
 for(const [k,v] of [['newBetAllowance',100],['remainingComplete',300000],['maxSequence',900000],
  ['requiresNewSession',false],['completePreserved',300000],['basePlanHash','b'.repeat(64)],['planHash','b'.repeat(64)]]){
  const q={...p,[k]:v};assert.throws(()=>preparedCountPlan(base,q,auth(q)));
 }
 assert.throws(()=>preparedCountPlan(base,{...p,createdAt:1},auth(p)),/AUTHORIZATION/);
});

test('new action contract requires its own exact prepared profile; legacy profiles remain exact',()=>{
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32714'];
 const p={schema:'sg-prepared-count-profile-v1',gameId:32714,trialId:base.trialId,group:'primary',basePlanHash:hash(base),
  targetComplete:300000,completePreserved:1416,remainingComplete:298584,maxSequence:600000,
  sessionRotation:'closed-batches-v1',newBetAllowance:0,requiresNewSession:true,createdAt:0,expiresAt:7200000,
  actionContract:{version:ACTION_VERSION,hash:ACTION_CONTRACT_HASH}};
 for(const f of ['activation','preparationProofHash','failureEvidenceHash','sceneHash','recordsHash','closureHash'])p[f]='a'.repeat(64);
 const expected={...base,target:300000,countAllocation:p.activation,featureProfile:ACTION_VERSION,actionContractHash:ACTION_CONTRACT_HASH};
 p.planHash=hash(expected);
 const auth=x=>({schema:'sg-prepared-count-authorization-v1',gameId:32714,trialId:base.trialId,group:'primary',
  basePlanHash:hash(base),activation:x.activation,profileHash:hash(x)});
 assert.deepEqual(preparedCountPlan(base,p,auth(p)),expected);assert.equal(base.featureProfile,undefined);
 for(const descriptor of [{version:ACTION_VERSION,hash:'b'.repeat(64)},
  {version:ACTION_VERSION,hash:ACTION_CONTRACT_HASH,extra:true},{version:'unknown',hash:ACTION_CONTRACT_HASH}]){
  const q={...p,actionContract:descriptor};assert.throws(()=>preparedCountPlan(base,q,auth(q)),/PREPARED_ACTION_CONTRACT/);
 }
 const old={...p};delete old.actionContract;old.planHash=hash({...base,target:300000,countAllocation:p.activation});
 assert.equal(preparedCountPlan(base,old,auth(old)).featureProfile,undefined);
});
