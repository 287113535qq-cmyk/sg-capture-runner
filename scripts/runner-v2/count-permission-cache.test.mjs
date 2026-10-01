import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countPermissionReader} from './count-permission-cache.mjs';
function fixture(){
 const commit='a'.repeat(40),activation='b'.repeat(64),plan={trialId:'fixture',gameId:32723,buy:0,phase:1,target:300000,countAllocation:activation};
 const spec={schema:'sg-complete-count-v1',activation,commit,planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId,target:plan.target,profileHash:'c'.repeat(64),maxSequence:600000,baselineBatchCount:0,baselineHash:hash([]),firstSequence:1};
 const pool={nextBatchId:1,nextSequence:1,confirmed:0,countAllocation:{specHash:hash(spec),reserved:0,batches:{}}};
 const key=`complete-count:${plan.trialId}:${activation}`,docs=new Map([[key,{value:spec}],[key+':complete',{value:{schema:'sg-complete-count-activation-v1',specHash:hash(spec),trialId:plan.trialId,planHash:hash(plan),commit}}]]);
 let reads=0;const store={get:async(c,k)=>{reads++;return structuredClone(docs.get(k));}},reader=countPermissionReader({store}),read=(pool,runtime=commit)=>reader({pool,plan,commit:runtime});return {read,pool,docs,key,plan,spec,reads:()=>reads};
}
test('repeated permission reads reuse only fully validated immutable journals',async()=>{const f=fixture();for(let i=0;i<100;i++)assert.equal(hash(await f.read(f.pool)),hash(f.spec));assert.equal(f.reads(),2);});
test('cached permission still checks current counters and changed allocation',async()=>{const f=fixture();await f.read(f.pool);f.pool.confirmed=1;await assert.rejects(f.read(f.pool),/COUNT_COUNTER/);f.pool.confirmed=0;await f.read(f.pool);assert.equal(f.reads(),4);f.pool.countAllocation.specHash='c'.repeat(64);await assert.rejects(f.read(f.pool),/COUNT_PERMISSION/);assert.equal(f.reads(),6);});
test('returned values cannot change the accepted cached evidence',async()=>{const f=fixture();const s=await f.read(f.pool);s.target=1;assert.equal((await f.read(f.pool)).target,300000);});
test('an incomplete activation is never cached and later must be read again',async()=>{const f=fixture(),receipt=f.docs.get(f.key+':complete');f.docs.delete(f.key+':complete');await assert.rejects(f.read(f.pool),/COUNT_ACTIVATION_INCOMPLETE/);f.docs.set(f.key+':complete',receipt);await f.read(f.pool);assert.equal(f.reads(),4);});
test('changed plans do not inherit old permission',async()=>{const f=fixture();await f.read(f.pool);f.plan.target=299999;await assert.rejects(f.read(f.pool),/COUNT_AUTHORIZATION/);assert.equal(f.reads(),4);});

test('runtime change requires its own complete zero-quota revision before caching',async()=>{
 const f=fixture(),runtime='d'.repeat(40),key=`count-runtime:${f.plan.trialId}:${f.spec.activation}:${runtime}`;await f.read(f.pool);
 await assert.rejects(f.read(f.pool,runtime),/COUNT_AUTHORIZATION/);
 f.docs.set(key,{value:{schema:'sg-count-runtime-v2',planHash:hash(f.plan),newBetAllowance:0,completePreserved:0,remainingComplete:f.plan.target,
  revisionHash:'e'.repeat(64),commit:runtime,fromCommit:f.spec.commit,specHash:hash(f.spec),profileHash:f.spec.profileHash,activation:f.spec.activation,sourceRequests:0}});
 const before=f.reads();await f.read(f.pool,runtime);assert.equal(f.reads()-before,3);await f.read(f.pool,runtime);assert.equal(f.reads()-before,3);
 f.pool.confirmed=-1;await assert.rejects(f.read(f.pool,runtime),/COUNT_AUTHORIZATION/);
});
