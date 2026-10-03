import test from 'node:test';import assert from 'node:assert/strict';
import {validatePreparedCountReview} from './prepared-count-review.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('source-free scene delivery binds intact review and never grants a profile or source allowance',()=>{
 const scene={sourceRequests:0,newBetAllowance:0,completePreserved:152,recordsHash:'a'.repeat(64),
  closed:{completePreserved:152,recordsHash:'a'.repeat(64)},batches:[]};
 const task={schema:'sg-prepared-count-review-task-v1',gameId:32714,group:'primary',scene,sceneHash:hash(scene),
  publicationHash:'b'.repeat(64),basePlanHash:'c'.repeat(64),reviewedAt:2000,sourceAllowance:0};
 assert.equal(validatePreparedCountReview(task),task);
 for(const change of [{sourceAllowance:100},{sceneHash:'0'.repeat(64)},{reviewedAt:null},
  {scene:{...scene,newBetAllowance:100}},{group:'other'}])assert.throws(()=>validatePreparedCountReview({...task,...change}));
});

test('repair delivery binds the retired source activation and closure instead of granting another quota',()=>{
 const trialId='fixture',repairParent={activation:'a'.repeat(64),specHash:'b'.repeat(64),sourceCommit:'c'.repeat(40),
  sourceRun:'3:1',closureKey:'count-prepared-close:fixture:3:1:complete'};
 const scene={sourceRequests:0,newBetAllowance:0,completePreserved:155,recordsHash:'d'.repeat(64),batches:[],
  parentActivation:repairParent.activation,parentSpecHash:repairParent.specHash,
  closed:{...repairParent,completePreserved:155,recordsHash:'d'.repeat(64)}};
 const task={schema:'sg-prepared-count-review-task-v1',gameId:32714,trialId,group:'primary',scene,sceneHash:hash(scene),
  repairParent,publicationHash:'e'.repeat(64),basePlanHash:'f'.repeat(64),reviewedAt:2000,sourceAllowance:0};
 validatePreparedCountReview(task);
 for(const key of ['activation','specHash','sourceCommit','sourceRun','closureKey']){
  const changed=structuredClone(task);changed.repairParent[key]='foreign';assert.throws(()=>validatePreparedCountReview(changed));
 }
});
