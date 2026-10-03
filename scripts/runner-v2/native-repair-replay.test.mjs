import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {exportNativeRepairReplay,validateNativeRepairReplay} from './native-repair-replay.mjs';
import {receiptKey} from './durable-queue.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
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

function retiredFixture(count=101){
 const a=stoppedFixture(),prefix='retired-count:'+a.plan.trialId+':fixed';
 const pool={confirmed:1,nextBatchId:count+1,retiredCount:prefix};
 const before={schema:'sg-retired-count-before-v1',plan:a.plan,pool:{confirmed:1,nextBatchId:count+1}};
 const result={schema:'sg-retired-count-result-v1',trialId:a.plan.trialId,sourceRequests:0,newBetAllowance:0,
  completePreserved:1,beforeHash:hash({plan:before.plan,pool:before.pool})};
 a.docs.set('state/pool:'+a.plan.trialId,pool);
 a.docs.set('journal/'+prefix+':before',before);a.docs.set('journal/'+prefix+':complete',result);
 a.docs.set('journal/'+a.docs.get('state/'+a.repairKey).archiveKey,{schema:'sg-count-prepared-before-v1'});
 a.docs.get('state/'+a.repairKey).evidence=[{key:prefix+':complete',hash:hash(result)}];
 for(let first=1;first<=count;first+=100){
  const entries=[];
  for(let id=first;id<=Math.min(count,first+99);id++){
   const batch=id===1?a.batch:{id,journaled:id,end:id,pending:null};
   entries.push({batchId:id,beforeHash:hash(batch)});
   a.docs.set('state/batch:'+a.plan.trialId+':'+id,structuredClone(batch));
  }
  a.docs.set('journal/'+prefix+':page:'+first,{schema:'sg-retired-count-page-v1',entries});
 }
 const original={id:count,journaled:count,end:count,pending:null},key=prefix+':batch:'+count;
 a.docs.set('journal/'+key,{schema:'sg-retired-count-batch-v1',batch:original});
 a.docs.set('state/batch:'+a.plan.trialId+':'+count,{...original,retiredCount:key});
 return {...a,prefix,count};
}

test('formal retirement export follows all pages and immutable original batches including abandoned faults',async()=>{
 const a=retiredFixture(),before=hash([...a.docs]),task=await exportNativeRepairReplay(a);
 validateNativeRepairReplay(task);assert.equal(task.faults.length,1);
 assert.equal(hash([...a.docs]),before);assert.equal(task.sourceAllowance,0);
 for(const change of [x=>x.docs.delete('journal/'+x.prefix+':page:101'),
  x=>x.docs.get('journal/'+x.prefix+':page:101').entries[0].batchId=99,
  x=>x.docs.get('journal/'+x.prefix+':batch:101').batch.journaled=0,
  x=>x.docs.get('state/pool:'+x.plan.trialId).confirmed=2,
  x=>x.docs.get('state/batch:'+x.plan.trialId+':101').retiredCount='foreign',
  x=>x.docs.delete('journal/'+x.batch.abandonedDemo)]){
  const b=retiredFixture();change(b);await assert.rejects(exportNativeRepairReplay(b));
 }
});

test('formal repair binds the retired ledger to the original captured fault and rejected preparation proof',async()=>{
 const a=retiredFixture(),archive=a.docs.get('journal/'+a.docs.get('state/'+a.repairKey).archiveKey);
 const abandoned=a.docs.get('journal/'+a.batch.abandonedDemo),pending=abandoned.pending;
 const plan={...a.plan,countAllocation:'f'.repeat(64)};
 const receipt=captureFaultReceipt({plan,batch:{...a.batch,pending},archiveKey:a.batch.abandonedDemo,archive:abandoned,group:'primary'});
 a.batch.workLineFault=`capture-fault:${a.plan.trialId}:1:${hash(receipt)}`;
 a.docs.set('journal/'+a.batch.workLineFault,receipt);
 a.docs.set('state/batch:'+a.plan.trialId+':1',structuredClone(a.batch));
 a.docs.get('journal/'+a.prefix+':page:1').entries[0].beforeHash=hash(a.batch);
 const before=a.docs.get('journal/'+a.prefix+':before');before.plan=plan;
 const result=a.docs.get('journal/'+a.prefix+':complete');result.beforeHash=hash({plan:before.plan,pool:before.pool});
 a.docs.get('state/'+a.repairKey).evidence[0].hash=hash(result);
 Object.assign(archive,{run:'3:1',commit:'c'.repeat(40),campaign:{games:[{game_id:a.plan.gameId,
  pendingReview:{rawHash:hash(pending.raw)},preparationProofHash:'d'.repeat(64)}]}});
 a.docs.set('journal/'+a.docs.get('state/'+a.repairKey).archiveKey.replace(/:archive$/,':archive:complete'),{});
 const archiveKey=`count-prepared-close:${a.plan.trialId}:3:1:before`;
 a.docs.get('state/'+a.repairKey).archiveKey=archiveKey;a.docs.set('journal/'+archiveKey,archive);
 a.docs.set('journal/'+archiveKey.slice(0,-7)+':complete',{repairKey:a.repairKey,sourceRun:'3:1',sourceCommit:archive.commit,activation:plan.countAllocation});
 const task=await exportNativeRepairReplay(a);validateNativeRepairReplay(task);
 assert.equal(task.captureLink.failureEvidenceHash,hash({receipt,plan,raw:pending.raw}));
 assert.equal(task.captureLink.rejectedProofHash,'d'.repeat(64));
 const changed=structuredClone(task);changed.captureLink.captureEvidence.receipt.rawHash='0'.repeat(64);
 assert.throws(()=>validateNativeRepairReplay(changed));
});
