// Portable control fixtures: synthetic records/parser, not SG feature evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture as initial} from './demo-rollover.test.mjs';import {rolloverDemo} from './demo-rollover.mjs';
import {rolloverDemoResidual} from './demo-residual.mjs';import {DemoFresh} from './demo-fresh.mjs';
import {auditSessionOwner} from './demo-session-audit.mjs';import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
export async function residualFixture(){
 const f=initial();Object.assign(f.args.oldPlan,{campaignId:'sg_round_one_20260928',runtimeSlug:'beaverlasvegas',sourceKey:'beaverlasvegas-round-one-base-v1',betRaw:100,maxSteps:100,workers:20});
 f.args.plan={...f.args.oldPlan,demoGeneration:'a'.repeat(64)};f.docs.get('state/pool:'+f.args.plan.trialId).value.planHash=hash(f.args.oldPlan);
 f.args.expected=hash({campaign:f.get('state','campaign').value,pool:f.get('state','pool:'+f.args.plan.trialId).value,fromPool:f.get('state','pool:'+f.args.fromPlan.trialId).value});await rolloverDemo(f.args);
 const oldPlan=f.args.plan,plan={...oldPlan,demoGeneration:'b'.repeat(64)},trial=plan.trialId;
 const put=(c,k,v)=>f.docs.set(c+'/'+k,{value:structuredClone(v)});
 let id=2;for(const worker of [1,2,7,8,10,11,13,14,15,16,17,18]){
  const start=(id-1)*100+1,b={id,worker,start,end:start+99,journaled:start+4,checkpoint:start+4,pending:null,sessionHash:hash('old-'+worker),leaseUntil:0};
  put('state',`batch:${trial}:${id}`,b);
  for(let n=0;n<5;n++){const sequence=start+n,r={_id:hash(sequence),trialId:trial,sequence,batchId:id,shardId:worker,sourceSessionHash:b.sessionHash,raw:{synthetic:true}};put('journal',receiptKey(trial,sequence),r);f.mongo.set(r._id,r);}id++;
 }
 const start=(id-1)*100+1,pending={sequence:start,attempt:'synthetic-abandoned',awaiting:null,raw:{steps:[{msgId:'BET'}]}};
 const b={id,worker:0,start,end:start+99,journaled:start-1,checkpoint:start-1,pending:null,sessionHash:hash('old-0'),leaseUntil:0,retiredDemo:'retired-demo:second'};put('state',`batch:${trial}:${id}`,b);
 const pool=f.get('state','pool:'+trial).value;Object.assign(pool,{enabled:false,retiredDemo:b.retiredDemo,nextBatchId:id+1,nextSequence:start+100});put('state','pool:'+trial,pool);
 const campaign=f.get('state','campaign').value;campaign.protocolValidation.runKey='capture-run:22:1';put('state','campaign',campaign);
 const batches=Array.from({length:id},(_,i)=>f.get('state',`batch:${trial}:${i+1}`).value);
 const retiredBefore={pool,batches:batches.map(x=>x.id===id?{...x,pending}:x)};
 const retirement={schema:'sg-retired-demo-result-v1',trialId:trial,completePreserved:62,abandonedAttempts:1,sourceRequests:0,newBetAllowance:0,beforeHash:hash(retiredBefore)};
 put('journal',pool.retiredDemo+':before',retiredBefore);put('journal',pool.retiredDemo+':complete',retirement);
 put('journal',pool.retiredDemo+':analysis',{sourceRequests:0,attempts:[{batchId:id,worker:0,pending}]});
 const hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{batchId:id}};put('state','global-hold',hold);
 const budgets=Array.from({length:20},(_,w)=>w===0?4:[3,4,5,6,9,12,19].includes(w)?5:0);
 const profile={schema:'sg-demo-residual-pilot-v1',parentGeneration:oldPlan.demoGeneration,generation:plan.demoGeneration,createdAt:100,expiresAt:7200100,sourceRun:'22:1',snapshotHash:hash({campaign,pool,hold}),completePreserved:62,budgets,usedBetAllowance:61,newBetAllowance:39,failureBatch:id,failurePendingHash:hash(pending)};
 const args={...f.args,basePlan:f.args.oldPlan,oldPlan,plan,profile,parser:{call:async x=>x.op==='next'?{MSGID:'FREE_GAME'}:{verified:x.record.raw.synthetic}},run:'23:1'};
 const key=`demo-generation:${trial}:${plan.demoGeneration}`;
 return {...f,args,put,key,profile,batches};
}
test('residual charges abandoned BET, preserves both generations and admits only4/0/5 totaling39',async()=>{
 const f=await residualFixture(),old=hash(f.batches);const r=await rolloverDemoResidual(f.args);assert.equal(r.newBetAllowance,39);
 assert.equal(hash(f.batches.map(b=>f.get('state',`batch:${f.args.plan.trialId}:${b.id}`).value)),old);
 const c=f.get('state','campaign').value;c.protocolValidation.runKey='capture-run:24:1';f.put('state','campaign',c);
 let total=0;for(let w=0;w<20;w++){
  const fresh=new DemoFresh({store:f.args.store,plan:f.args.plan,stage:'fresh',runKey:'capture-run:24:1',now:f.args.now});const a=await fresh.admit({shardId:w,sessionHash:hash('new-'+w),commitSha:f.args.commit},w);assert.equal(a.limit,f.profile.budgets[w]);total+=a.limit;
  if(a.limit){fresh.checkLease({id:f.batches.length+1,start:1501});for(let n=0;n<a.limit;n++)fresh.beforeBegin(1501+n);assert.throws(()=>fresh.beforeBegin(1501+a.limit));}
 }
 assert.equal(total,39);const pool=f.get('state','pool:'+f.args.plan.trialId).value;
 for(const r of f.mongo.values())await auditSessionOwner({store:f.args.store,plan:f.args.plan,pool,record:r});
 const record=structuredClone([...f.mongo.values()][0]);record.sourceSessionHash='forged';await assert.rejects(auditSessionOwner({store:f.args.store,plan:f.args.plan,pool,record}));
 await assert.rejects(rolloverDemoResidual(f.args));
});
test('partial stage, interleaved jobs and hold CAS conflict never grant capture',async()=>{
 for(const phase of ['spec','campaign','hold','job']){
  const f=await residualFixture();if(phase==='spec')f.fail(f.key);if(phase==='campaign')f.fail('campaign');if(phase==='hold')f.fail('global-hold');
  if(phase==='job'){let calls=0;f.args.boundary=async()=>assert(++calls<3,'LATE_JOB');}
  await assert.rejects(rolloverDemoResidual(f.args));assert(!f.get('journal',f.key+':complete'));
 }
});
test('expired, expanded, changed archive, live lease and unresolved parser are refused before mutation',async()=>{
 for(const cause of ['expired','extra','archive','lease','parser','mongo']){
  const f=await residualFixture();
  if(cause==='expired')f.args.now=()=>7200100;
  if(cause==='extra'){f.profile.budgets[0]=5;f.profile.newBetAllowance=40;}
  if(cause==='archive')f.docs.get('journal/retired-demo:second:before').value.batches[0].start++;
  if(cause==='lease')f.docs.get('state/batch:'+f.args.plan.trialId+':1').value.leaseUntil=999;
  if(cause==='parser')f.args.parser.call=async x=>x.op==='next'?null:{verified:true};
  if(cause==='mongo')f.corrupt();
  await assert.rejects(rolloverDemoResidual(f.args));assert(!f.get('journal',f.key+':before'));
 }
});
