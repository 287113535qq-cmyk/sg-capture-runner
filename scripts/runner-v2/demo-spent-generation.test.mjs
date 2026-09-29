import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSpentDemoGeneration} from './demo-spent-generation.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

// Synthetic receipts/parser exercise authorization and I/O, not game rules.
function fixture(){
 const basePlan={trialId:'spent-fixture',gameId:32835,buy:0,phase:1},fromPlan={...basePlan,demoGeneration:'a'.repeat(64)},docs=new Map();
 const key=`demo-generation:${fromPlan.trialId}:${fromPlan.demoGeneration}`,activation=`next-demo-game:${fromPlan.trialId}:${fromPlan.demoGeneration}`;
 const parent={schema:'sg-demo-generation-v1',trialId:fromPlan.trialId,generation:fromPlan.demoGeneration,planHash:hash(fromPlan),firstBatchId:2,workers:20,perWorker:5,newBetAllowance:100,commit:'b'.repeat(40),run:'10:1',activationStage:{key:activation,profileHash:'c'.repeat(64)}};
 const bind=()=>{docs.set(key,{value:structuredClone(parent)});docs.set(key+':complete',{value:{schema:'sg-demo-generation-complete-v1',specHash:hash(parent),commit:parent.commit,run:parent.run}});};bind();
 docs.set(activation+':complete',{value:{schema:'sg-next-demo-game-complete-v1',profileHash:parent.activationStage.profileHash,generation:parent.generation,commit:parent.commit,run:parent.run,newBetAllowance:100,sourceRequests:0}});
 const batches=[{id:1,worker:0,start:1,end:100,journaled:2,checkpoint:2,leaseUntil:0}];
 for(let w=0;w<20;w++){
  const start=101+w*100,b={id:w+2,worker:w,start,end:start+99,journaled:start+4,checkpoint:start+4,leaseUntil:0,sessionHash:`session-${w}`};batches.push(b);
  for(let n=start;n<start+5;n++)docs.set(receiptKey(fromPlan.trialId,n),{value:{trialId:fromPlan.trialId,batchId:b.id,shardId:w,sequence:n,sourceSessionHash:b.sessionHash,raw:{steps:[{msgId:'BET'}],valid:true}}});
 }
 const profile={sourceSpecHash:hash(parent)},scene={sourceBatches:batches,fromPool:{nextBatchId:22,workers:{0:{leaseUntil:0}},demoGeneration:{specHash:hash(parent)}}};let calls=0;
 const args={store:{get:async(_c,k)=>docs.get(k),getMany:async(_c,keys)=>keys.map(k=>docs.get(k))},parser:{call:async({plan,record})=>{assert.deepEqual(plan,basePlan);calls++;return {verified:record.raw.valid};}},basePlan,fromPlan,profile,scene,now:()=>100};
 return {args,docs,parent,key,activation,batches,calls:()=>calls,rebind(){bind();profile.sourceSpecHash=scene.fromPool.demoGeneration.specHash=hash(parent);}};
}

test('spent v1 checks all100 actual BET records and creates no source allowance',async()=>{
 const f=fixture(),before=hash([...f.docs]);assert.deepEqual(await reviewSpentDemoGeneration(f.args),{schema:'sg-demo-generation-v1',spent:100,verified:100,newBetAllowance:0});assert.equal(f.calls(),100);assert.equal(hash([...f.docs]),before);
});
test('v1 completed generation with incomplete outer activation is refused',async()=>{
 for(const cause of ['missing','runtime','profile','allowance']){const f=fixture(),top=f.docs.get(f.activation+':complete').value;
  if(cause==='missing')f.docs.delete(f.activation+':complete');if(cause==='runtime')top.commit='d'.repeat(40);if(cause==='profile')top.profileHash='d'.repeat(64);if(cause==='allowance')top.newBetAllowance=101;
  await assert.rejects(reviewSpentDemoGeneration(f.args),/SOURCE_ACTIVATION/);assert.equal(f.calls(),0);
 }
});
test('missing, reordered and duplicate batch coverage cannot prove spent quota',async()=>{
 for(const cause of ['missing','duplicate','reorder']){const f=fixture();if(cause==='missing')f.batches.pop();else if(cause==='duplicate')f.batches[1]=structuredClone(f.batches[2]);else [f.batches[1],f.batches[2]]=[f.batches[2],f.batches[1]];await assert.rejects(reviewSpentDemoGeneration(f.args),/BATCH_COVERAGE/);}
});
test('missing or altered actual receipt and invalid parser result refuse spent proof',async()=>{
 for(const cause of ['missing','session','worker','sequence','secondBet','noBet','invalid']){const f=fixture(),k=receiptKey(f.args.fromPlan.trialId,101),r=f.docs.get(k).value;
  if(cause==='missing')f.docs.delete(k);if(cause==='session')r.sourceSessionHash='other';if(cause==='worker')r.shardId=1;if(cause==='sequence')r.sequence=102;if(cause==='secondBet')r.raw.steps.push({msgId:'BET'});if(cause==='noBet')r.raw.steps[0].msgId='FREE_GAME';if(cause==='invalid')r.raw.valid=false;
  await assert.rejects(reviewSpentDemoGeneration(f.args),/SOURCE_(RECEIPT|RECORD)/);
 }
});
test('pending, unknown, unflushed, live lease and unspent worker reject before parsing',async()=>{
 for(const cause of ['pending','unknown','checkpoint','workerLease','batchLease','budget']){const f=fixture(),b=f.batches[1];
  if(cause==='pending')b.pending={};if(cause==='unknown')b.bootstrapAwaiting={};if(cause==='checkpoint')b.checkpoint--;if(cause==='workerLease')f.args.scene.fromPool.workers[0].leaseUntil=101;if(cause==='batchLease')b.leaseUntil=101;if(cause==='budget')b.checkpoint=--b.journaled;
  await assert.rejects(reviewSpentDemoGeneration(f.args),/SOURCE_(UNSETTLED|QUOTA)/);assert.equal(f.calls(),0);
 }
});
test('changed parent runtime and extra BET allowance cannot mint another pilot',async()=>{
 const f=fixture();f.docs.get(f.key+':complete').value.commit='d'.repeat(40);await assert.rejects(reviewSpentDemoGeneration(f.args),/SOURCE_PROOF/);
 const g=fixture();g.parent.newBetAllowance=101;g.rebind();await assert.rejects(reviewSpentDemoGeneration(g.args),/SOURCE_PROOF/);
});
