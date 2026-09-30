import test from 'node:test';import assert from 'node:assert/strict';
import {amendFormalRuntime} from './formal-count-runtime.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

function fixture(){
 const docs=new Map(),fromCommit='7200e7b74df1eb29e86c0b74d1940dfab2449557',commit='f'.repeat(40),activation='a'.repeat(64);
 const plan={trialId:'sg_r1_20260930_32795',gameId:32795,buy:0,phase:1,target:300000,countAllocation:activation};
 const batches=[],records=[];
 const set=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
 for(let i=1;i<=20;i++){
  const b={id:i,worker:i-1,start:(i-1)*100+1,end:i*100,sessionHash:hash(i),checkpoint:(i-1)*100+5,journaled:(i-1)*100+5,pending:null,leaseUntil:0};
  set('state',`batch:${plan.trialId}:${i}`,b);
  batches.push({id:i,worker:i-1,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:5,evidenceHash:hash(b)});
  for(let j=0;j<5;j++){const r={_id:hash([i,j]),sequence:b.start+j};records.push(r);set('journal',receiptKey(plan.trialId,r.sequence),r);}
 }
 const profile={activation,recordsHash:hash(records)};
 const spec={schema:'sg-complete-count-v1',activation,commit:fromCommit,planHash:hash(plan),trialId:plan.trialId,gameId:32795,target:300000,maxSequence:600000,baselineBatchCount:20,baselineHash:hash(batches),firstSequence:2001,profileHash:hash(profile)};
 const key=`complete-count:${plan.trialId}:${activation}`;
 set('journal',key,spec);set('journal',key+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit:fromCommit});
 const pool={enabled:true,confirmed:100,nextBatchId:21,nextSequence:2001,workers:{},planHash:hash(plan),countAllocation:{specHash:hash(spec),reserved:0,batches:Object.fromEntries(batches.map(b=>[b.id,b]))}};
 set('state','pool:'+plan.trialId,pool);set('state','campaign',{enabled:true,activeGame:32795,validationLimit:0,formalCount:{activation}});
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k))),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));set(c,k,v);}};
 const transport={request:async(op,p)=>{assert.equal(op,'rounds_read');return records.filter(r=>p.ids.includes(r._id));}};
 const revision={schema:'sg-formal-runtime-profile-v1',activation,profileHash:hash(profile),sourceRun:'36728815536:1',fromCommit,createdAt:10,expiresAt:1000};
 const ended={id:36728815536,run_attempt:1,status:'completed',conclusion:'failure',head_sha:fromCommit,repository:{full_name:'zyzuoyang/sg-capture-runner'}};
 const jobs={total_count:2,jobs:[{name:'formal-admit',status:'completed',conclusion:'failure'},{name:'verify',status:'completed',conclusion:'success'}]};
 return {docs,set,pool,args:{store,transport,plan,profile,revision,ended,jobs,commit,run:'99:1',boundary:async()=>{},now:()=>100}};
}
test('runtime amendment preserves all original documents and admits only its exact new runtime',async()=>{
 const f=fixture(),before=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));
 await assert.rejects(loadCountPermission({...f.args,pool:f.pool}),/COUNT_AUTHORIZATION/);
 const r=await amendFormalRuntime(f.args);assert.equal(r.completePreserved,100);assert.equal(r.sourceRequests,0);
 for(const [k,h] of before)assert.equal(hash(f.docs.get(k)),h);
 await loadCountPermission({...f.args,pool:f.pool});
 await assert.rejects(loadCountPermission({...f.args,pool:f.pool,commit:'e'.repeat(40)}),/COUNT_AUTHORIZATION/);
 await assert.rejects(amendFormalRuntime(f.args),/COUNT_REVISION_ALREADY_APPLIED/);
});
for(const bad of ['admitted','capture-started','changed-counter','changed-record','expired'])test('runtime amendment rejects '+bad,async()=>{
 const f=fixture();
 if(bad==='admitted')f.set('journal',`count-run:${f.args.plan.trialId}:36728815536:1`,{});
 if(bad==='capture-started'){f.args.jobs.jobs.push({name:'capture-0',status:'completed',conclusion:'success'});f.args.jobs.total_count++;}
 if(bad==='changed-counter')f.docs.get('state/pool:'+f.args.plan.trialId).value.confirmed++;
 if(bad==='changed-record')f.docs.get('journal/'+receiptKey(f.args.plan.trialId,1)).value.sequence++;
 if(bad==='expired')f.args.now=()=>1001;
 await assert.rejects(amendFormalRuntime(f.args));
});
