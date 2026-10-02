import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {publishCaptureFailure} from './work-line-mailbox.mjs';
import {applyWorkLineEvent} from './work-line-events.mjs';
import {observeProtocolTask} from './protocol-analysis-task.mjs';
import {newInventory,claimPreparation,finishPreparation,preparationGates} from './preparation-inventory.mjs';
test('actual file mailboxes deliver one failure to both lanes and an independent protocol task without source authority',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sg-work-lines-'));
 try{
  const admission=newInventory([{gameId:1,name:'test'}]),repair=structuredClone(admission);
  const c=claimPreparation(admission,{owner:'test',now:0});const proof={schema:'sg-reusable-preparation-v1',gameId:1,sourceAllowance:0,revisionHash:'a'.repeat(64),gates:Object.fromEntries(preparationGates.map(g=>[g,{verified:true,evidenceHash:'b'.repeat(64)}]))};
  finishPreparation(admission,c,{status:'prepared',proof},1);
  const arg={gameId:1,proofHash:admission.tasks[0].proofHash,reason:'FLOW_REVIEW_REQUIRED',evidence:{steps:[{raw:'immutable fixture'}]}};
  const ids=publishCaptureFailure(root,arg);assert.deepEqual(publishCaptureFailure(root,arg),ids);
  for(const [lane,q] of [['admission',admission],['repair',repair]]){
   const dir=path.join(root,'.local','preparation-worker',lane,'inbox');assert.equal(fs.readdirSync(dir).length,1);
   const event=JSON.parse(fs.readFileSync(path.join(dir,ids[lane]+'.json')));assert(applyWorkLineEvent(q,event,lane,20));
  }
  const task=JSON.parse(fs.readFileSync(path.join(root,'.local','protocol-analysis-worker','inbox',ids.protocol+'.json')));
  assert.equal(observeProtocolTask(task).captureAuthorization,false);assert.equal(repair.tasks[0].status,'queued');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
