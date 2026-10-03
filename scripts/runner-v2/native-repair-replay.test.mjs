import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {exportNativeRepairReplay,validateNativeRepairReplay} from './native-repair-replay.mjs';
import {receiptKey} from './durable-queue.mjs';
function fixture(){
 const plan={gameId:1,trialId:'fixture',runtimeGameId:10},repairKey='game-repair:fixture:'+'a'.repeat(64);
 const raw={fixtureOnly:false,steps:[{msgId:'BET'}]},batch={pending:{awaiting:null,raw}};
 const archive={pool:{},evidence:[]},ref={key:'parked-v2:fixture:batch:1',hash:hash(batch)};
 const repair={schema:'sg-game-repair-v1',gameId:1,trialId:'fixture',status:'pending-adapter',
  sourceAllowance:0,requiresNewSession:true,archiveKey:'parked-v2:fixture:archive',evidence:[ref]};
 const record={_id:'fixture-record',gameId:1,fixtureOnly:false,raw,normalized:{bet:20}};
 const docs=new Map([['state/campaign',{games:[{game_id:1,status:'parked-protocol',repairKey}]}],
  ['state/'+repairKey,repair],['journal/'+repair.archiveKey,archive],['journal/'+ref.key,{batch}],
  ['journal/'+receiptKey(plan.trialId,1),record]]);
 const store={get:async(c,k)=>docs.has(c+'/'+k)?{value:docs.get(c+'/'+k)}:null,
  getMany:async(c,keys)=>{assert(keys.length<=100);return Promise.all(keys.map(k=>store.get(c,k)));}};
 return {plan,repairKey,revisionHash:'b'.repeat(64),store,docs,record,batch,
  transport:{request:async(op,q)=>{assert.equal(op,'rounds_read');assert.deepEqual(q.ids,[record._id]);return [record];}}};
}
test('fixed native repair export binds every archived batch and full readback without writes or synthesized old preparation proof',async()=>{
 const a=fixture(),task=await exportNativeRepairReplay(a);
 assert.equal(validateNativeRepairReplay(task).schema,'sg-preparation-replay-task-v1');
 assert.equal(task.faults[0].failureEvidenceHash,hash(task.manifest));assert.equal(task.sourceAllowance,0);
 for(const change of [x=>x.batch.pending.awaiting='FREE_GAME',x=>x.batch.pending.raw.steps=[],
  x=>x.docs.get('state/'+x.repairKey).status='repaired-returned',
  x=>x.docs.get('state/campaign').games[0].repairKey='foreign']){
  const b=fixture();change(b);await assert.rejects(exportNativeRepairReplay(b));
 }
 const changed=structuredClone(task);changed.faults[0].raw.steps=[];assert.throws(()=>validateNativeRepairReplay(changed));
});

function stoppedFixture(){
 const a=fixture(),pending={...a.batch.pending,sequence:2};
 Object.assign(a.batch,{id:1,journaled:1,end:5,pending:null,
  abandonedDemo:`abandoned-demo:${a.plan.trialId}:1:${hash(pending)}`});
 a.docs.set('journal/'+a.batch.abandonedDemo,{schema:'sg-abandoned-demo-v1',trialId:a.plan.trialId,
  batchId:1,disposition:'interrupted-abandoned-without-replay',sourceRequests:0,pending,pendingOriginal:null});
 a.docs.get('state/'+a.repairKey).evidence[0].hash=hash(a.batch);
 return a;
}
test('stopped batch follows its immutable abandoned archive without restoring pending or replaying requests',async()=>{
 const a=stoppedFixture(),before=hash(a.batch),task=await exportNativeRepairReplay(a);
 assert.equal(task.faults.length,1);assert.equal(hash(a.batch),before);assert.equal(a.batch.pending,null);
 assert.equal(task.faults[0].evidence.abandonedKey,a.batch.abandonedDemo);
 assert.equal(task.faults[0].evidence.abandonedHash,hash(a.docs.get('journal/'+a.batch.abandonedDemo)));
 validateNativeRepairReplay(task);
 for(const change of [x=>x.docs.delete('journal/'+x.batch.abandonedDemo),
  x=>x.docs.get('journal/'+x.batch.abandonedDemo).trialId='foreign',
  x=>x.docs.get('journal/'+x.batch.abandonedDemo).pending.awaiting='FREE_GAME',
  x=>x.docs.get('journal/'+x.batch.abandonedDemo).pending.raw.steps=[],
  x=>x.docs.get('journal/'+x.batch.abandonedDemo).sourceRequests=1,
  x=>x.docs.get('journal/'+x.batch.abandonedDemo).pending.sequence=3]){
  const b=stoppedFixture();change(b);await assert.rejects(exportNativeRepairReplay(b));
 }
});
