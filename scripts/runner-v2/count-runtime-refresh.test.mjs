import test from 'node:test';import assert from 'node:assert/strict';
import {refreshCountRuntime} from './count-runtime-refresh.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

function fixture(){
 const docs=new Map(),fromCommit='a'.repeat(40),commit='b'.repeat(40),activation='c'.repeat(64);
 const plan={trialId:'sg_r1_20260930_32795',gameId:32795,buy:0,phase:1,target:300000,countAllocation:activation};
 const profile={activation},set=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
 const ledger={};
 for(let id=1;id<=121;id++){
  const b={id,worker:0,start:(id-1)*100+1,end:id*100,sessionHash:hash(id),checkpoint:id*100,journaled:id*100,pending:null,leaseUntil:0};
  set('state',`batch:${plan.trialId}:${id}`,b);
  const key=`count-settlement:${plan.trialId}:${activation}:${id}`;
  const receipt={schema:'sg-count-batch-settlement-v1',activation,trialId:plan.trialId,fullReadback:true,batch:b};
  set('journal',key,receipt);
  ledger[id]={id,worker:0,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:100,
   evidenceHash:id===1?hash(b):hash(receipt),...(id>1?{settlementKey:key}:{})};
 }
 const spec={schema:'sg-complete-count-v1',trialId:plan.trialId,gameId:plan.gameId,target:plan.target,
  activation,planHash:hash(plan),profileHash:hash(profile),commit:fromCommit,baselineBatchCount:1,
  baselineHash:hash([ledger[1]]),firstSequence:101,maxSequence:600000,sessionRotation:'closed-batches-v1'};
 const sk=`complete-count:${plan.trialId}:${activation}`;
 set('journal',sk,spec);set('journal',sk+':complete',{schema:'sg-complete-count-activation-v1',specHash:hash(spec),
  trialId:plan.trialId,planHash:hash(plan),commit:fromCommit});
 const pool={planHash:hash(plan),enabled:true,confirmed:12100,nextBatchId:122,nextSequence:12101,
  workers:{0:{activeBatch:null,leaseUntil:0}},countAllocation:{specHash:hash(spec),reserved:0,batches:ledger}};
 const campaign={enabled:true,activeGame:plan.gameId,formalCount:{activation}};
 set('state','pool:'+plan.trialId,pool);set('state','campaign',campaign);
 const permit={schema:'sg-count-run-v1',commit:fromCommit,run:'77:1',activation,profileHash:hash(profile),completeBefore:100};
 set('journal',`count-run:${plan.trialId}:77:1`,permit);
 const revision={schema:'sg-count-runtime-refresh-profile-v1',profileHash:hash(profile),activation,gameId:plan.gameId,
  planHash:hash(plan),poolHash:hash(pool),campaignHash:hash(campaign),fromCommit,sourceRun:'77:1',sourcePermitHash:hash(permit),
  completePreserved:pool.confirmed,createdAt:1,expiresAt:1000};
 const ended={id:77,run_attempt:1,status:'completed',conclusion:'success',head_sha:fromCommit,
  repository:{full_name:'zyzuoyang/sg-capture-runner'},path:'.github/workflows/trial-300k.yml'};
 const jobs={total_count:21,jobs:[{name:'formal-admit',status:'completed',conclusion:'success'},
  ...Array.from({length:20},(_,i)=>({name:'capture-'+i,status:'completed',conclusion:'success'}))]};
 const sizes=[];
 const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),getMany:async(c,ks)=>{
  sizes.push(ks.length);return ks.map(k=>structuredClone(docs.get(c+'/'+k)));},
  create:async(c,k,v,opts)=>{assert.equal(opts.immutable,true);assert(!docs.has(c+'/'+k));set(c,k,v);}};
 return {docs,set,pool,sizes,args:{store,plan,profile,revision,ended,jobs,commit,run:'88:1',boundary:async()=>{},now:()=>100}};
}
test('healthy runtime refresh audits multiple bounded pages and adds only one receipt',async()=>{
 const f=fixture(),old=new Map([...f.docs].map(([k,v])=>[k,hash(v)]));
 const r=await refreshCountRuntime(f.args);assert.equal(r.completePreserved,12100);assert.equal(r.remainingComplete,287900);
 assert.equal(r.newBetAllowance,0);assert.equal(r.sourceRequests,0);assert.equal(f.docs.size,old.size+1);
 assert(Math.max(...f.sizes)<=100);for(const[k,h]of old)assert.equal(hash(f.docs.get(k)),h);
 await loadCountPermission({...f.args,pool:f.pool});
 await assert.rejects(loadCountPermission({...f.args,pool:f.pool,commit:'d'.repeat(40)}),/COUNT_AUTHORIZATION/);
 await assert.rejects(refreshCountRuntime(f.args),/COUNT_REFRESH_ALREADY_APPLIED/);
});
for(const bad of ['source-failure','missing-worker','duplicate-worker','expired','changed-pool','reserved','pending','proof-change','missing-proof','wrong-permit','concurrent-change'])
test('runtime refresh fails closed: '+bad,async()=>{
 const f=fixture(),a=f.args;
 if(bad==='source-failure')a.ended.conclusion='failure';
 if(bad==='missing-worker')a.jobs.jobs.pop();
 if(bad==='duplicate-worker')a.jobs.jobs[20].name='capture-0';
 if(bad==='expired')a.now=()=>1001;
 if(bad==='changed-pool')f.docs.get('state/pool:'+a.plan.trialId).value.confirmed++;
 if(bad==='reserved'){f.docs.get('state/pool:'+a.plan.trialId).value.countAllocation.reserved=1;a.revision.poolHash=hash(f.docs.get('state/pool:'+a.plan.trialId).value);}
 if(bad==='pending')f.docs.get(`state/batch:${a.plan.trialId}:120`).value.pending={};
 const proof=`journal/count-settlement:${a.plan.trialId}:${a.profile.activation}:120`;
 if(bad==='proof-change')f.docs.get(proof).value.fullReadback=false;
 if(bad==='missing-proof')f.docs.delete(proof);
 if(bad==='wrong-permit')a.revision.sourcePermitHash='0'.repeat(64);
 if(bad==='concurrent-change'){let n=0;a.boundary=async()=>{if(++n===2)f.docs.get('state/campaign').value.enabled=false;};}
 const size=f.docs.size;await assert.rejects(refreshCountRuntime(a));assert.equal(f.docs.size,size);
});
