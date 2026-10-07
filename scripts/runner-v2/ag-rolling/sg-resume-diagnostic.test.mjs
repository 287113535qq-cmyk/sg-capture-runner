import test from 'node:test';import assert from 'node:assert/strict';
import {diagnoseResumeTask} from './sg-resume-diagnostic.mjs';
import {protocolStopReport} from './sg-fault-code.mjs';
const scope={game:{gameId:'32734',secret:'PRIVATE_TOKEN'},kind:'worker',index:7};
test('successful resume retains the exact result with one operation',async()=>{
 const result={ok:true};let n=0;assert.equal(await diagnoseResumeTask(scope,async()=>{n++;return result;}),result);assert.equal(n,1);
});
test('concurrent failures bind their own task and retain unknown writes without retry',async()=>{
 const errors=[Error('raw PRIVATE_TOKEN'),Error('JOURNAL_ACK_UNKNOWN')];let calls=0;
 const out=await Promise.allSettled(errors.map((e,i)=>diagnoseResumeTask({...scope,index:i+1},async()=>{calls++;throw e;})));
 out.forEach((r,i)=>{assert.equal(r.reason,errors[i]);const p=protocolStopReport(r.reason);
  assert.equal(p.resumeTask.index,i+1);assert.equal(p.resumeTask.gameId,'32734');assert.equal(p.resumeTask.mutationOutcome,'requires-native-reconciliation');
  assert(!JSON.stringify(p).includes('PRIVATE_TOKEN'));
 });assert.equal(calls,2);
});
test('invalid context or forged diagnostic never enters the stop report',async()=>{
 for(const invalid of [{game:{gameId:'PRIVATE_TOKEN'}},{index:21},{kind:'PRIVATE_TOKEN'}]){
  const error=Object.assign(Error('raw PRIVATE_TOKEN'),{resumeTask:{token:'PRIVATE_TOKEN'}});
  await assert.rejects(diagnoseResumeTask({...scope,...invalid},async()=>{throw error;}),e=>{
   assert.equal(e,error);assert.deepEqual(protocolStopReport(e),{outcome:'stopped',code:'SG_PROTOCOL_STOPPED'});return true;
  });
 }
});

