import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
import {retireStoppedFormal} from './formal-stopped-retire.mjs';
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


function stopped(){
 const f=countedFixture(),p=f.pool,plan=f.args.plan;plan.gameId=32795;p.failure='PROTOCOL_VALIDATION_FAILED';p.planHash=hash(plan);
 f.batch.pending=null;f.batch.checkpoint=f.batch.journaled;
 for(const [k,r] of f.docs)if(k.startsWith('journal/receipt:'))f.mongo.set(r.value._id,structuredClone(r.value));
 const spec=f.docs.get('journal/'+f.key).value;spec.gameId=32795;spec.planHash=hash(plan);spec.profileHash='e'.repeat(64);spec.sessionRotation='closed-batches-v1';p.countAllocation.specHash=hash(spec);
 Object.assign(f.docs.get('journal/'+f.key+':complete').value,{specHash:hash(spec),planHash:hash(plan)});
 const set=(c,k,value)=>f.docs.set(c+'/'+k,{value});
 const repairKey='game-repair:synthetic-demo:a',repair={sourceAllowance:0,requiresNewSession:true,status:'pending-adapter'};
 const campaign={activeGame:null,games:[{game_id:32795,status:'parked-protocol',repairKey}]};
 set('state','campaign',campaign);set('state',repairKey,repair);set('journal','abandoned-demo:old',{immutable:true});
 set('journal','count-run:synthetic-demo:77:1',{activation:spec.activation,commit:spec.commit,profileHash:spec.profileHash,run:'77:1'});
 const records=[...f.mongo.values()],profile={schema:'sg-formal-stopped-retire-profile-v1',trialId:plan.trialId,gameId:32795,
  planHash:hash(plan),sourceAllowance:0,createdAt:1,expiresAt:1000,sourceCommit:spec.commit,sourceRun:'77:1',poolHash:hash(p),campaignHash:hash(campaign),repairKey,repairHash:hash(repair),recordsHash:hash(records),completePreserved:2,abandonedKey:'abandoned-demo:old',abandonedHash:hash({immutable:true})};
 const ended={repository:{full_name:'zyzuoyang/sg-capture-runner'},status:'completed',conclusion:'success',head_sha:spec.commit,id:77,run_attempt:1};
 const jobs={total_count:22,jobs:['formal-admit','verify',...Array.from({length:20},(_,i)=>'capture-'+i)].map(name=>({name,status:'completed',conclusion:'success'}))};
 return {...f,args:{...f.args,profile,ended,jobs,commit:'f'.repeat(40),run:'88:1',boundary:async()=>{},now:()=>100}};
}
test('parked formal retirement settles records without enabling pool or altering campaign and repair',async()=>{
 const f=stopped(),oldCampaign=hash(f.get('state','campaign')),oldRepair=hash(f.get('state',f.args.profile.repairKey));
 const r=await retireStoppedFormal(f.args);assert.equal(r.completePreserved,2);assert.equal(r.newBetAllowance,0);assert.equal(r.sourceRequests,0);
 const p=f.get('state','pool:synthetic-demo').value;assert.equal(p.confirmed,2);assert.equal(p.countAllocation.reserved,0);assert.equal(p.enabled,false);
 assert.equal(hash(f.get('state','campaign')),oldCampaign);assert.equal(hash(f.get('state',f.args.profile.repairKey)),oldRepair);
 await assert.rejects(retireStoppedFormal(f.args),/ALREADY_COMPLETE/);
});
test('secondary retirement cannot reuse primary schema or admission jobs',async()=>{
 const f=stopped();f.args.ended.repository.full_name='287113535qq-cmyk/sg-capture-runner';
 await assert.rejects(retireStoppedFormal(f.args),/FORMAL_RETIRE_SOURCE/);
 f.args.profile.schema='sg-formal-stopped-retire-pyramids-v1';f.args.profile.group='secondary';
 await assert.rejects(retireStoppedFormal(f.args),/FORMAL_RETIRE_SECONDARY_SCOPE/);
});
for(const cause of ['expired','active-game','records','source','repair','pending','jobs'])test('parked formal retirement rejects '+cause+' before writes',async()=>{
 const f=stopped();
 if(cause==='expired')f.args.profile.expiresAt=99;
 if(cause==='active-game')f.docs.get('state/campaign').value.activeGame=32795;
 if(cause==='records')f.args.profile.recordsHash='0'.repeat(64);
 if(cause==='source')f.args.ended.head_sha='0'.repeat(40);
 if(cause==='repair')f.docs.get('state/'+f.args.profile.repairKey).value.sourceAllowance=1;
 if(cause==='pending')f.batch.pending={raw:{steps:[]}};
 if(cause==='jobs')f.args.jobs.jobs[2].status='in_progress';
 const before=hash([...f.docs]);await assert.rejects(retireStoppedFormal(f.args));assert.equal(hash([...f.docs]),before);
});
