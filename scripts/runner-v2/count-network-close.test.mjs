import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
import {closeCountNetwork} from './count-network-close.mjs';
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



function network(){
 const f=countedFixture(),pool=f.pool,plan=f.args.plan;pool.enabled=true;pool.failure=null;f.batch.failure=null;f.batch.pending.awaiting='unknown-synthetic-request';
 const spec=f.docs.get('journal/'+f.key).value;spec.sessionRotation='closed-batches-v1';spec.profileHash='e'.repeat(64);
 pool.countAllocation.specHash=hash(spec);f.docs.get('journal/'+f.key+':complete').value.specHash=hash(spec);
 const campaign={enabled:true,activeGame:plan.gameId,formalCount:{activation:plan.countAllocation}},hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{trialId:plan.trialId,batchId:1,code:'SOURCE_NETWORK_OUTCOME_UNKNOWN',category:'source_network',cooldownUntil:0}};
 const permit={schema:'sg-count-run-v1',activation:spec.activation,profileHash:spec.profileHash,commit:spec.commit,run:'77:1'};
 for(const [c,k,value]of [['state','campaign',campaign],['state','global-hold',hold],['journal','count-run:'+plan.trialId+':77:1',permit]])f.docs.set(c+'/'+k,{value});
 const ended={repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml',status:'completed',conclusion:'failure',head_sha:spec.commit,id:77,run_attempt:1};
 const jobs={total_count:22,jobs:['formal-admit','verify',...Array.from({length:20},(_,i)=>'capture-'+i)].map(name=>({name,status:'completed',conclusion:name.startsWith('capture-')?'failure':'success'}))};
 const profile={schema:'sg-count-network-close-profile-v1',trialId:plan.trialId,gameId:plan.gameId,planHash:hash(plan),sourceAllowance:0,createdAt:1,expiresAt:1000,sourceCommit:spec.commit,sourceRun:'77:1',jobsHash:hash(jobs),poolHash:hash(pool),campaignHash:hash(campaign),holdHash:hash(hold),batchesHash:hash([f.batch]),pendingHash:hash(f.batch.pending),batchId:1,permitHash:hash(permit),completePreserved:2,abandonedAttempts:1,unknownAttempts:1};
 f.args.store.cas=async(c,k,before,value)=>{assert.equal(hash(f.get(c,k)),hash(before));f.docs.set(c+'/'+k,{value:structuredClone(value)});return {value};};
 return {...f,args:{...f.args,profile,ended,jobs,commit:'f'.repeat(40),run:'88:1'}};
}
test('network cleanup flushes complete records and abandons unknown, preserving activation and original count ceiling',async()=>{
 const f=network(),activation=hash(f.get('journal',f.key)),r=await closeCountNetwork(f.args);
 const pool=f.get('state','pool:synthetic-demo').value;assert.equal(pool.enabled,true);assert.equal(pool.confirmed,2);assert.equal(pool.nextSequence,101);assert.equal(pool.countAllocation.reserved,0);
 assert.equal(pool.workers[7].activeBatch,null);assert.equal(f.get('state','global-hold').value.active,false);assert.equal(hash(f.get('journal',f.key)),activation);
 assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(r.unknownAttempts,1);assert.equal(f.mongo.size,2);
 const archived=[...f.docs.values()].find(r=>r.value.schema==='sg-retired-count-batch-v1').value;assert.equal(archived.disposition,'unknown-abandoned-without-replay');assert.equal(archived.batch.pending.awaiting,'unknown-synthetic-request');
 await assert.rejects(closeCountNetwork(f.args));
});
for(const cause of ['expired','lease','hold','scene','jobs','pending','count','permission'])test('network cleanup refuses '+cause+' before writes',async()=>{
 const f=network();if(cause==='expired')f.args.profile.expiresAt=99;if(cause==='lease')f.batch.leaseUntil=101;
 if(cause==='hold')f.docs.get('state/global-hold').value.details.code='MONGO_CONTENT_CONFLICT';if(cause==='scene')f.pool.confirmed=1;
 if(cause==='jobs')f.args.jobs.jobs[2].status='in_progress';if(cause==='pending')f.batch.pending.awaiting=null;
 if(cause==='count')f.args.profile.completePreserved=3;if(cause==='permission')f.docs.get('journal/'+f.key+':complete').value.specHash='0'.repeat(64);
 const before=hash([...f.docs]);await assert.rejects(closeCountNetwork(f.args));assert.equal(hash([...f.docs]),before);
});
test('network cleanup keeps exact shared protection after Mongo conflict or partial archive',async()=>{
 for(const fault of ['mongo','archive']){const f=network();if(fault==='mongo')f.corrupt();else f.fail('count-network-close:synthetic-demo:77:1:settled');
 await assert.rejects(closeCountNetwork(f.args));assert.equal(f.get('state','global-hold').value.active,true);assert.equal(f.get('state','pool:synthetic-demo').value.enabled,false);await assert.rejects(closeCountNetwork(f.args));}
});
