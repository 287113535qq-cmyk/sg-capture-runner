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
