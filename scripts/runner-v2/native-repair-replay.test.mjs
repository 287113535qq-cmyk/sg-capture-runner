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
