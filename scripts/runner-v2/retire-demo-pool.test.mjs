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
