import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {exportNativeRepairReplay,validateNativeRepairReplay} from './native-repair-replay.mjs';
import {receiptKey} from './durable-queue.mjs';
import {captureFaultReceipt} from './capture-fault-receipt.mjs';
import fs from 'node:fs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
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

function historicalActionFixture(){
  const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),plan=read('config/round-one-plans.json')[32714];
  const name='formal-prepared-count-32714-671f5512b92219003f11c4d49c55cf616b245386d2084618e4eb333ae57125c6.json';
  const captured=preparedCountPlan(plan,read('config/'+name),read('config/prepared-count-authorizations.json').profiles[name]);
  const raw=read('scripts/trial/fixtures/huff-hardhat-mansion-prefix.json').raw,pending={awaiting:null,sequence:2,raw};
  const batch={id:1,start:1,end:100,journaled:1,checkpoint:1,pending:null,
   abandonedDemo:`abandoned-demo:${plan.trialId}:1:${hash(pending)}`};
  const abandoned={schema:'sg-abandoned-demo-v1',trialId:plan.trialId,batchId:1,pending,
   disposition:'interrupted-abandoned-without-replay',sourceRequests:0};
  const receipt=captureFaultReceipt({plan:captured,batch:{...batch,pending},archiveKey:batch.abandonedDemo,archive:abandoned,group:'primary'});
  batch.workLineFault=`capture-fault:${plan.trialId}:1:${hash(receipt)}`;
  const repairKey=`game-repair:${plan.trialId}:`+'a'.repeat(64),archiveKey='parked-original';
  const repair={schema:'sg-game-repair-v1',gameId:32714,trialId:plan.trialId,status:'pending-adapter',
   sourceAllowance:0,requiresNewSession:true,archiveKey,evidence:[{key:'original-batch:'+plan.trialId,hash:hash(batch)}]};
  const record={_id:'historical-record',gameId:32714,fixtureOnly:false,raw:{fixtureOnly:false,steps:[{msgId:'BET'}]},normalized:{bet:5}};
  const docs=new Map([['state/campaign',{games:[{game_id:32714,status:'parked-protocol',repairKey}]}],
   ['state/'+repairKey,repair],['journal/'+archiveKey,{}],['journal/original-batch:'+plan.trialId,{batch}],
   ['journal/'+batch.abandonedDemo,abandoned],['journal/'+batch.workLineFault,receipt],
   ['journal/'+receiptKey(plan.trialId,1),record]]);
  const store={get:async(c,k)=>docs.has(c+'/'+k)?{value:docs.get(c+'/'+k)}:null,
   getMany:async(c,keys)=>Promise.all(keys.map(k=>store.get(c,k)))};
  return {store,plan,repairKey,revisionHash:'b'.repeat(64),docs,batch,receipt,captured,
   transport:{request:async()=>[record]}};
}
test('historical action fault exports its independently registered original plan and exact native receipt',async()=>{
 const make=historicalActionFixture;
 const a=make(),before=hash([...a.docs]),task=await exportNativeRepairReplay(a);
 validateNativeRepairReplay(task);assert.equal(hash([...a.docs]),before);
 assert.deepEqual(task.faults[0].evidence.captureEvidence.plan,a.captured);
 assert.deepEqual(task.faults[0].evidence.captureEvidence.receipt,a.receipt);
 for(const change of [x=>x.docs.delete('journal/'+x.batch.workLineFault),
  x=>x.receipt.planHash='f'.repeat(64),x=>x.receipt.rawHash='f'.repeat(64),x=>x.receipt.sourceAllowance=1]){
  const b=make();change(b);await assert.rejects(exportNativeRepairReplay(b));
 }
});

test('paged retirement retains the original action pending and its final receipt as separately bound immutable snapshots',async()=>{
 const make=()=>{
  const a=historicalActionFixture(),prefix='retired-count:'+a.plan.trialId+':fixed',archiveKey='shared-close:before';
  const abandoned=a.docs.get('journal/'+a.batch.abandonedDemo),original={...a.batch,pending:abandoned.pending};
  delete original.abandonedDemo;delete original.workLineFault;
  const key=prefix+':batch:1',frozen={...a.batch,retiredCount:key};
  const before={schema:'sg-retired-count-before-v1',plan:a.captured,pool:{nextBatchId:2}};
  const result={schema:'sg-retired-count-result-v1',trialId:a.plan.trialId,sourceRequests:0,newBetAllowance:0,
   completePreserved:1,beforeHash:hash({plan:before.plan,pool:before.pool})};
  a.docs.set('state/pool:'+a.plan.trialId,{nextBatchId:2,confirmed:1,retiredCount:prefix});
  a.docs.set('state/batch:'+a.plan.trialId+':1',frozen);
  a.docs.set('journal/'+prefix+':before',before);a.docs.set('journal/'+prefix+':complete',result);
  a.docs.set('journal/'+prefix+':page:1',{schema:'sg-retired-count-page-v1',entries:[{batchId:1,beforeHash:hash(original)}]});
  a.docs.set('journal/'+key,{schema:'sg-retired-count-batch-v1',batch:original});
  a.docs.set('journal/'+prefix+':fault:1',{schema:'sg-retired-count-fault-v1',batch:frozen,
   originalBatchHash:hash(original),retirementKey:key,sourceRequests:0,newBetAllowance:0});
  a.docs.set('journal/'+archiveKey,{schema:'sg-count-shared-before-v1',terminalRecords:[]});
  const repair=a.docs.get('state/'+a.repairKey);repair.archiveKey=archiveKey;repair.evidence=[{key:prefix+':complete',hash:hash(result)}];
  return {...a,prefix,original,frozen};
 };
 const a=make(),before=hash([...a.docs]),task=await exportNativeRepairReplay(a);
 validateNativeRepairReplay(task);assert.equal(hash([...a.docs]),before);
 assert.deepEqual(task.faults[0].evidence.captureEvidence.plan,a.captured);
 for(const change of [x=>x.docs.delete('journal/'+x.prefix+':fault:1'),
  x=>x.docs.get('journal/'+x.prefix+':fault:1').originalBatchHash='0'.repeat(64),
  x=>x.original.pending.raw.steps.push({msgId:'FREE_GAME'}),x=>x.frozen.checkpoint=0,
  x=>x.docs.delete('journal/'+x.batch.workLineFault)]){
  const b=make();change(b);await assert.rejects(exportNativeRepairReplay(b));
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
 a.batch.checkpoint=a.batch.journaled;
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

function receivedTerminalFixture(){
 const a=retiredFixture(1),closure=`count-shared-close:${a.plan.trialId}:9:1`,repair=a.docs.get('state/'+a.repairKey);
 repair.archiveKey=closure+':before';
 const current={id:1,journaled:2,end:5,pending:null},pending={sequence:2,awaiting:null,raw:structuredClone(a.record.raw)};
 const terminal={batch:{id:1,journaled:1,end:5,pending},pending,sourceRequests:0,
  record:{...structuredClone(a.record),_id:'terminal-record',sequence:2,trialId:a.plan.trialId}};
 a.docs.set('state/batch:'+a.plan.trialId+':1',current);
 a.docs.get('journal/'+a.prefix+':page:1').entries[0].beforeHash=hash(current);
 a.docs.set('journal/'+closure+':before',{schema:'sg-count-shared-before-v1',terminalRecords:[{
  batchId:1,pendingHash:hash(pending),recordHash:hash(terminal.record)}]});
 a.docs.set('journal/'+closure+':complete',{schema:'sg-count-shared-close-v1',repairKey:a.repairKey,receivedTerminalsReconciled:1});
 a.docs.set('journal/'+closure+':terminal:1',terminal);
 a.docs.set('journal/'+receiptKey(a.plan.trialId,2),terminal.record);
 a.transport.request=async(op,q)=>{assert.equal(op,'rounds_read');return q.ids.map(id=>id===a.record._id?a.record:terminal.record);};
 return {...a,terminal,closure,current};
}

test('reconciled terminal returns to flow repair from its original proof and confirmed receipt without recreating pending',async()=>{
 const a=receivedTerminalFixture(),before=hash([...a.docs]),task=await exportNativeRepairReplay(a);
 assert.equal(task.faults.length,1);assert.deepEqual(task.faults[0].raw,a.terminal.record.raw);
 assert.equal(a.current.pending,null);assert.equal(hash([...a.docs]),before);validateNativeRepairReplay(task);
 for(const change of [x=>x.docs.delete('journal/'+receiptKey(x.plan.trialId,2)),
  x=>x.terminal.pending.awaiting='FREE_GAME',x=>x.terminal.record.raw.steps.push({msgId:'FREE_GAME'}),
  x=>x.docs.get('journal/'+x.closure+':complete').receivedTerminalsReconciled=2,
  x=>x.transport.request=async()=>[]]){
  const b=receivedTerminalFixture();change(b);await assert.rejects(exportNativeRepairReplay(b));
 }
});

for(const kind of ['shared','prepared','abandoned-shared'])test(kind+' closure advances only its archived previous native repair identity',async()=>{
 const make=()=>{
  const a=kind==='shared'?receivedTerminalFixture():retiredFixture(2),previousKey='game-repair:fixture:'+'d'.repeat(64);
  if(kind==='abandoned-shared'){
   a.closure='count-shared-close:fixture:9:1';
   a.docs.get('state/'+a.repairKey).archiveKey=a.closure+':before';
   const fields={profileHash:'a'.repeat(64),disposition:'interrupted-abandoned-without-replay',
    faultCode:'HUFF_ACTION_DISPLAY_COUNTERS',faultPendingHash:'b'.repeat(64)};
   a.docs.set('journal/'+a.closure+':before',{schema:'sg-count-shared-before-v1',...fields});
   a.docs.set('journal/'+a.closure+':complete',{schema:'sg-count-shared-close-v1',repairKey:a.repairKey,
    abandonedAttempts:1,...fields});
  }
  if(kind==='prepared'){
   a.closure='count-prepared-close:fixture:9:1';
   a.docs.get('state/'+a.repairKey).archiveKey=a.closure+':before';
   a.docs.set('journal/'+a.closure+':before',{schema:'sg-count-prepared-before-v1'});
   a.docs.set('journal/'+a.closure+':complete',{schema:'sg-count-prepared-close-v1',repairKey:a.repairKey});
  }
  const original={schema:'sg-game-repair-v1',gameId:1,trialId:'fixture',status:'pending-adapter',sourceAllowance:0,requiresNewSession:true,archiveKey:'previous-archive'};
  const previous={...original,status:'validated-awaiting-admission',preparationProofHash:'e'.repeat(64),countActivation:'f'.repeat(64)};
  const previousArchive={schema:'original-fault'};
  a.docs.set('state/'+previousKey,previous);a.docs.set('journal/'+previous.archiveKey,previousArchive);
  a.docs.get('journal/'+a.closure+':before').campaign={games:[{game_id:1,repairKey:previousKey,preparationProofHash:'e'.repeat(64)}]};
  Object.assign(a.docs.get('journal/'+a.closure+':complete'),{trialId:'fixture',activation:'f'.repeat(64),sourceRequests:0,newBetAllowance:0,requiresNewSession:true});
  const key='complete-count:fixture:'+'f'.repeat(64),spec={schema:'sg-complete-count-v1',activation:'f'.repeat(64),trialId:'fixture',profileHash:'a'.repeat(64)};
  a.docs.set('journal/'+key,spec);a.docs.set('journal/'+key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),profileHash:spec.profileHash});
  a.docs.set('journal/'+key+':before',{schema:'sg-prepared-count-before-v1',profileHash:spec.profileHash,
   scene:{repair:original,closed:{repairKey:previousKey},preparationProofHash:'e'.repeat(64),
    failureEvidenceHash:hash({repairKey:previousKey,repair:original,archiveHash:hash(previousArchive)})}});
  return {...a,previousKey,previous,original,previousArchive};
 };
 const a=make(),snapshot=hash([...a.docs]),task=await exportNativeRepairReplay(a);
 validateNativeRepairReplay(task);assert.equal(hash([...a.docs]),snapshot);
 assert.equal(task.repairTransition.previousFailureEvidenceHash,hash({repairKey:a.previousKey,repair:a.original,archiveHash:hash(a.previousArchive)}));
 for(const mutate of [b=>b.docs.delete('state/'+b.previousKey),b=>b.previous.sourceAllowance=1,
  b=>b.previous.trialId='foreign',b=>b.docs.get('journal/'+b.closure+':complete').sourceRequests=1]){
  const b=make();mutate(b);await assert.rejects(exportNativeRepairReplay(b),/TRANSITION/);
 }
 const changed=structuredClone(task);changed.repairTransition.archiveHash='0'.repeat(64);
 assert.throws(()=>validateNativeRepairReplay(changed),/TRANSITION/);
});
