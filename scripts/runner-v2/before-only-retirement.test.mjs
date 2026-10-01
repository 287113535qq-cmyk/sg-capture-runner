import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
import {reviewBeforeOnlyRetirement} from './before-only-retirement.mjs';
function fixture(){
 const plan={gameId:32721,trialId:'sg_r1_20260928_32721',countAllocation:'a'.repeat(64)};
 const pool={nextBatchId:3,countAllocation:{batches:{1:{closed:true},2:{closed:false}}}},prefix='retired-count:'+plan.trialId+':fixed';
 const before={schema:'sg-retired-count-before-v1',plan,pool,owner:'36840426858:1'},batches={1:{id:1},2:{id:2}};
 const proof={schema:'sg-retirement-before-only-v1',run:before.owner,commit:'e4afdf6aeca450710651a07ad66cf1255474d537',
  key:prefix+':before',hash:hash(before),batchHashes:Object.fromEntries(Object.entries(batches).map(([k,v])=>[k,hash(v)]))};
 const journals=new Map(),store={getMany:async(c,keys)=>{assert(keys.length<=100);return keys.map(k=>c==='journal'?journals.get(k):{value:batches[k.split(':').at(-1)]});}};
 return {args:{store,plan,pool,prefix,before,proof},journals,batches};
}
test('only an unchanged before marker may be reused, without overwriting it',async()=>{
 const f=fixture(),old=hash(f.args.before);assert.equal(await reviewBeforeOnlyRetirement(f.args),true);assert.equal(hash(f.args.before),old);
});
test('any partial batch page settlement or completed stage refuses',async()=>{
 for(const suffix of [':batch:2',':page:1',':closed-decoration:1',':complete']){const f=fixture();f.journals.set(f.args.prefix+suffix,{value:{}});await assert.rejects(reviewBeforeOnlyRetirement(f.args),/HAS_PARTIAL_STAGE/);}
 const f=fixture();f.journals.set(`count-settlement:${f.args.plan.trialId}:${f.args.plan.countAllocation}:2`,{value:{}});await assert.rejects(reviewBeforeOnlyRetirement(f.args),/HAS_PARTIAL_STAGE/);
});
test('changed owner before plan batch scope or batch content refuses',async()=>{
 for(const reason of ['owner','before','plan','scope','batch']){const f=fixture();
  if(reason==='owner')f.args.before.owner='999:1';if(reason==='before')f.args.proof.hash='b'.repeat(64);
  if(reason==='plan')f.args.plan.gameId=32795;if(reason==='scope')delete f.args.proof.batchHashes[2];
  if(reason==='batch')f.batches[2].checkpoint=1;await assert.rejects(reviewBeforeOnlyRetirement(f.args),undefined,reason);
 }
});
