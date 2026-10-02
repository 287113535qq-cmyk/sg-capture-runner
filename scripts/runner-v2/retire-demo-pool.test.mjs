// Portable synthetic control fixture. Parser is a test double; no official data.
import test from 'node:test';import assert from 'node:assert/strict';
import {retireDemoPool} from './retire-demo-pool.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
function fixture(){
 const plan={trialId:'synthetic-demo',gameId:32820,phase:1,buy:0},pool={enabled:false,nextBatchId:2,workers:{7:{leaseUntil:0}}},pending={sequence:3,attempt:'unfinished',awaiting:null,raw:{steps:[{msgId:'BET'}]}};
 pool.planHash=hash(plan);
 const batch={id:1,worker:7,start:1,end:100,epoch:0,leaseUntil:0,checkpoint:0,journaled:2,sessionHash:'session',pending,failure:'PROTOCOL_VALIDATION_FAILED'};
 const docs=new Map([['state/pool:'+plan.trialId,{value:pool}],['state/batch:'+plan.trialId+':1',{value:batch}],['state/write-permits',{value:{limit:1,slots:{}}}]]),mongo=new Map();let failAt=null,corrupt=false,busy=false;
 for(let n=1;n<=2;n++){const r={_id:hash('r'+n),contentHash:hash('content'+n),trialId:plan.trialId,batchId:1,shardId:7,sequence:n,sourceSessionHash:'session',fixtureOnly:false,buy:0,raw:{synthetic:true}};docs.set('journal/'+receiptKey(plan.trialId,n),{value:r});}
 const get=(c,k)=>structuredClone(docs.get(c+'/'+k));const store={get:async(c,k)=>get(c,k),getMany:async(c,keys)=>keys.map(k=>get(c,k)),writable:async()=>{},create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));assert(k!==failAt,'INJECTED_FAILURE');docs.set(c+'/'+k,{value:structuredClone(v)});},update:async(c,k,fn)=>{const v=fn(get(c,k).value);if(v!==null)docs.set(c+'/'+k,{value:v});return get(c,k);}};
 const transport={request:async(op,p)=>{if(op==='rounds_insert'){for(const r of p.records)mongo.set(r._id,structuredClone(r));return {};}assert.equal(op,'rounds_read');const a=[...mongo.values()].filter(r=>p.ids.includes(r._id)).map(x=>structuredClone(x));if(corrupt&&a.length)a[0].sequence=999;return a;}};
 const args={store,transport,plan,parser:{call:async({record})=>({verified:record.raw.synthetic===true})},gate:{status:()=>({allowed:true,maxBatchSize:100}),hold(){}},boundary:async()=>assert(!busy,'BUSY'),owner:'test',now:()=>100,expectedPoolHash:hash(pool)};
 return {args,docs,mongo,get,fail:k=>failAt=k,corrupt:()=>corrupt=true,busy:()=>busy=true,batch};
}
test('flush completed records, archive interrupted attempt and remove active partial without a source grant',async()=>{const f=fixture(),r=await retireDemoPool(f.args);assert.equal(r.completePreserved,2);assert.equal(r.abandonedAttempts,1);assert.equal(f.mongo.size,2);const b=f.get('state','batch:synthetic-demo:1').value;assert.equal(b.checkpoint,2);assert.equal(b.pending,null);assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(f.get('state','pool:synthetic-demo').value.enabled,false);assert(![...f.docs.keys()].some(k=>k.includes('protocol-resume:')));await assert.rejects(retireDemoPool(f.args),/POOL_CHANGED/);});
test('unknown response is explicitly abandoned, never represented as successful or never-sent',async()=>{const f=fixture();f.batch.pending.awaiting='BET payload';await retireDemoPool(f.args);const archive=[...f.docs.entries()].find(([k])=>k.endsWith(':analysis'))[1].value;assert.equal(archive.attempts[0].disposition,'unknown-abandoned-without-replay');assert.equal(archive.attempts[0].pending.awaiting,'BET payload');});
test('incomplete archive preserves active pending and refuses blind rerun',async()=>{const f=fixture();f.fail('retired-demo:synthetic-demo:'+f.args.expectedPoolHash.slice(0,16)+':analysis');await assert.rejects(retireDemoPool(f.args),/INJECTED/);assert(f.get('state','batch:synthetic-demo:1').value.pending);assert.equal(f.mongo.size,0);await assert.rejects(retireDemoPool(f.args),/ALREADY_STARTED/);});
test('Mongo conflict does not erase pending or advance checkpoint',async()=>{const f=fixture();f.corrupt();await assert.rejects(retireDemoPool(f.args),/MONGO_CONTENT_CONFLICT/);const b=f.get('state','batch:synthetic-demo:1').value;assert(b.pending);assert.equal(b.checkpoint,0);});
test('active boundary refuses before archival or mutation',async()=>{const f=fixture();f.busy();const old=hash([...f.docs]);await assert.rejects(retireDemoPool(f.args),/BUSY/);assert.equal(hash([...f.docs]),old);});
test('already settled historical batch retains the exact generation audit hash',async()=>{const f=fixture();f.batch.pending=null;f.batch.checkpoint=2;f.batch.retiredDemo='earlier-generation';for(const [k,r] of f.docs)if(k.startsWith('journal/receipt:'))f.mongo.set(r.value._id,r.value);const before=hash(f.batch);const r=await retireDemoPool(f.args);assert.equal(r.abandonedAttempts,0);assert.equal(hash(f.get('state','batch:synthetic-demo:1').value),before);});

function countedFixture(){
 const f=fixture(),plan=f.args.plan,pool=f.docs.get('state/pool:'+plan.trialId).value;
 plan.target=200;plan.countAllocation='a'.repeat(64);f.args.commit='b'.repeat(40);
 f.batch.sessionHash='c'.repeat(64);pool.workers[7].sessionHash=f.batch.sessionHash;
 pool.workers[7].activeBatch={id:1,worker:7,start:1,end:100};pool.nextSequence=101;pool.confirmed=0;
 for(const [key,row] of f.docs)if(key.startsWith('journal/receipt:'))row.value.sourceSessionHash=f.batch.sessionHash;
 pool.planHash=hash(plan);
 const spec={schema:'sg-complete-count-v1',activation:plan.countAllocation,planHash:hash(plan),commit:f.args.commit,trialId:plan.trialId,gameId:plan.gameId,target:200,maxSequence:300,firstSequence:1,baselineBatchCount:0,baselineHash:hash([])};
 pool.countAllocation={specHash:hash(spec),reserved:100,batches:{1:{id:1,worker:7,start:1,end:100,sessionHash:f.batch.sessionHash,closed:false,complete:0,evidenceHash:null}}};
 const key=`complete-count:${plan.trialId}:${plan.countAllocation}`;
 f.docs.set('journal/'+key,{value:spec});f.docs.set('journal/'+key+':complete',{value:{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit:f.args.commit}});
 f.args.expectedPoolHash=hash(pool);return {...f,pool,key};
}

test('count-mode retirement flushes two complete records and releases unused reservation only once',async()=>{
 const f=countedFixture();const result=await retireDemoPool(f.args),pool=f.get('state','pool:synthetic-demo').value;
 assert.equal(result.completePreserved,2);assert.equal(pool.confirmed,2);assert.equal(pool.countAllocation.reserved,0);
 assert.equal(pool.countAllocation.batches[1].complete,2);assert.equal(pool.countAllocation.batches[1].closed,true);
 assert.equal(pool.nextSequence,101);assert.equal(pool.workers[7].activeBatch,null);assert.equal(pool.enabled,false);
 const after=hash(pool);await assert.rejects(retireDemoPool(f.args));assert.equal(hash(f.get('state','pool:synthetic-demo').value),after);
});

test('count-mode Mongo conflict cannot release reservation or erase pending',async()=>{
 const f=countedFixture();f.corrupt();await assert.rejects(retireDemoPool(f.args),/MONGO_CONTENT_CONFLICT/);
 const p=f.get('state','pool:synthetic-demo').value;assert.equal(p.confirmed,0);assert.equal(p.countAllocation.reserved,100);
 assert(f.get('state','batch:synthetic-demo:1').value.pending);
});

test('count-mode archive failure cannot release reservation or allocate new source quota',async()=>{
 const f=countedFixture();f.fail('retired-demo:synthetic-demo:'+f.args.expectedPoolHash.slice(0,16)+':analysis');
 await assert.rejects(retireDemoPool(f.args),/INJECTED/);assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,100);
 assert.equal(f.mongo.size,0);
});

test('count-mode retirement requires current runtime and completed activation',async()=>{
 for(const cause of ['runtime','stage']){
  const f=countedFixture();if(cause==='runtime')f.args.commit='d'.repeat(40);else f.docs.delete('journal/'+f.key+':complete');
  const before=hash([...f.docs]);await assert.rejects(retireDemoPool(f.args));assert.equal(hash([...f.docs]),before);
 }
});

function largeCountFixture(){
 const f=countedFixture(),plan=f.args.plan,pool=f.pool,old=f.batch,baseline=[];
 f.docs.delete('state/batch:'+plan.trialId+':1');
 for(let id=1;id<=105;id++){
  const b={id,worker:7,start:(id-1)*100+1,end:id*100,sessionHash:'d'.repeat(64),checkpoint:(id-1)*100,journaled:(id-1)*100,pending:null,leaseUntil:0};
  f.docs.set(`state/batch:${plan.trialId}:${id}`,{value:b});
  baseline.push({...Object.fromEntries(['id','worker','start','end','sessionHash'].map(k=>[k,b[k]])),closed:true,complete:0,evidenceHash:hash(b)});
 }
 Object.assign(old,{id:106,start:10501,end:10600,checkpoint:10500,journaled:10502});
 f.docs.set(`state/batch:${plan.trialId}:106`,{value:old});
 for(let n=1;n<=2;n++){
  const r=f.docs.get('journal/'+receiptKey(plan.trialId,n)).value;
  f.docs.delete('journal/'+receiptKey(plan.trialId,n));r.sequence+=10500;r.batchId=106;
  f.docs.set('journal/'+receiptKey(plan.trialId,r.sequence),{value:r});
 }
 pool.workers[7].activeBatch={id:106,worker:7,start:10501,end:10600};pool.nextBatchId=107;pool.nextSequence=10601;
 const spec=f.docs.get('journal/'+f.key).value;
 Object.assign(spec,{maxSequence:20000,firstSequence:10501,baselineBatchCount:105,baselineHash:hash(baseline),sessionRotation:'closed-batches-v1'});
 pool.countAllocation={specHash:hash(spec),reserved:100,batches:Object.fromEntries(baseline.map(b=>[b.id,b]))};
 pool.countAllocation.batches[106]={...pool.workers[7].activeBatch,sessionHash:old.sessionHash,closed:false,complete:0,evidenceHash:null};
 f.docs.get('journal/'+f.key+':complete').value.specHash=hash(spec);f.args.expectedPoolHash=hash(pool);
 const getMany=f.args.store.getMany;f.args.store.getMany=async(c,ks)=>{assert(ks.length<=100);return getMany(c,ks);};
 return f;
}
test('formal retirement pages over 100 batches, preserves closed history and settles only verified records',async()=>{
 const f=largeCountFixture(),before=hash(f.get('state','batch:synthetic-demo:1').value);
 f.batch.pending.awaiting='unknown-synthetic-request';
 const r=await retireDemoPool(f.args),pool=f.get('state','pool:synthetic-demo').value;
 assert.equal(r.completePreserved,2);assert.equal(r.abandonedAttempts,1);assert.equal(pool.confirmed,2);assert.equal(pool.countAllocation.reserved,0);
 assert.equal(hash(f.get('state','batch:synthetic-demo:1').value),before);assert.equal(pool.workers[7].activeBatch,null);
 const archive=[...f.docs.values()].find(r=>r.value.schema==='sg-retired-count-batch-v1').value;
 assert.equal(archive.disposition,'unknown-abandoned-without-replay');assert.equal(archive.batch.pending.awaiting,'unknown-synthetic-request');
 assert.equal([...f.docs.values()].filter(r=>r.value.schema==='sg-retired-count-page-v1').length,2);
});
test('formal retirement Mongo conflict retains reservation and original private attempt',async()=>{
 const f=largeCountFixture();f.corrupt();await assert.rejects(retireDemoPool(f.args),/MONGO_CONTENT_CONFLICT/);
 assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,100);
 assert(f.get('state','batch:synthetic-demo:106').value.pending);
});
test('network retirement reuses admission-bound closed history and audits only current records',async()=>{
 const f=largeCountFixture(),spec=f.docs.get('journal/'+f.key).value;
 spec.profileHash='e'.repeat(64);f.pool.countAllocation.specHash=hash(spec);
 f.docs.get('journal/'+f.key+':complete').value.specHash=hash(spec);f.args.expectedPoolHash=hash(f.pool);
 const permit={schema:'sg-count-run-v1',run:'77:1',commit:f.args.commit,profileHash:spec.profileHash,activation:spec.activation,completeBefore:0,
  historyBoundary:{schema:'sg-count-history-boundary-v1',nextBatchId:106,nextSequence:10501,complete:0,
   ledgerHash:hash(Array.from({length:105},(_,i)=>f.pool.countAllocation.batches[i+1]))}};
 f.docs.set('journal/count-run:synthetic-demo:77:1',{value:permit});f.args.historyPermit=permit;
 const before=hash(f.get('state','batch:synthetic-demo:1').value),r=await retireDemoPool(f.args);
 assert.equal(r.completePreserved,2);assert.equal(r.currentRecordsRead,2);assert.equal(r.historyReuse.rawRecordsRead,0);
 assert.equal(r.historyReuse.batchCount,105);assert.equal(hash(f.get('state','batch:synthetic-demo:1').value),before);
 assert.equal(f.pool.countAllocation.reserved,100);assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,0);
});
test('retirement rejects a fabricated history permit before any mutation',async()=>{
 const f=largeCountFixture();f.args.historyPermit={run:'77:1'};const before=hash([...f.docs]);
 await assert.rejects(retireDemoPool(f.args),/COUNT_RETIRE_HISTORY_PERMISSION/);assert.equal(hash([...f.docs]),before);
});
test('closed-batches retirement uses bounded verification and preserves the serial result',async()=>{
 const serial=countedFixture(),batched=countedFixture();
 for(const f of [serial,batched]){
  const spec=f.docs.get('journal/'+f.key).value;spec.sessionRotation='closed-batches-v1';
  f.pool.countAllocation.specHash=hash(spec);f.docs.get('journal/'+f.key+':complete').value.specHash=hash(spec);
  f.args.expectedPoolHash=hash(f.pool);
 }
 let pages=0;batched.args.parser.verifyPage=async(plan,records)=>{
  pages++;assert.equal(records.length,2);assert.deepEqual(records.map(r=>r.sequence),[1,2]);
  return {verified:true,count:records.length};
 };
 const a=await retireDemoPool(serial.args),b=await retireDemoPool(batched.args);
 assert.equal(pages,1);assert.deepEqual(a,b);assert.equal(hash([...serial.mongo]),hash([...batched.mongo]));
 assert.equal(hash(serial.get('state','pool:synthetic-demo')),hash(batched.get('state','pool:synthetic-demo')));
});

test('failed bounded retirement verification keeps pending, reservation and Mongo intact',async()=>{
 for(const result of [{verified:false,count:2},{verified:true,count:1}]){
  const f=countedFixture(),spec=f.docs.get('journal/'+f.key).value;spec.sessionRotation='closed-batches-v1';
  f.pool.countAllocation.specHash=hash(spec);f.docs.get('journal/'+f.key+':complete').value.specHash=hash(spec);
  f.args.expectedPoolHash=hash(f.pool);f.args.parser.verifyPage=async()=>result;
  await assert.rejects(retireDemoPool(f.args),/COUNT_RETIRE_RECORD_INVALID/);
  assert.equal(f.mongo.size,0);assert(f.get('state','batch:synthetic-demo:1').value.pending);
  assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,100);
 }
});
