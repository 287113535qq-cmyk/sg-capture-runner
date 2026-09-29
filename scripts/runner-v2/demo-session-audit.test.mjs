import test from 'node:test';import assert from 'node:assert/strict';
import {auditSessionOwner} from './demo-session-audit.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const plan={trialId:'synthetic-demo',demoGeneration:'a'.repeat(64)};
 const old={id:1,worker:0,sessionHash:'old',start:1,checkpoint:2,journaled:2,pending:null,retiredDemo:'retired-demo:synthetic'};
 const fresh={id:2,worker:0,sessionHash:'new',start:101,checkpoint:102,journaled:102,pending:null};
 const retirement={schema:'sg-retired-demo-result-v1',trialId:plan.trialId};
 const spec={schema:'sg-demo-generation-v1',generation:plan.demoGeneration,trialId:plan.trialId,planHash:hash(plan),firstBatchId:2,historicalBatches:{1:hash(old)},retirement:old.retiredDemo,retirementHash:hash(retirement)};
 const pool={workers:{0:{sessionHash:'new'}},demoGeneration:{id:plan.demoGeneration,specHash:hash(spec)}};
 const docs=new Map([['journal/demo-generation:'+plan.trialId+':'+plan.demoGeneration,spec],['journal/'+old.retiredDemo+':complete',retirement],['state/batch:'+plan.trialId+':1',old],['state/batch:'+plan.trialId+':2',fresh]]);
 let reads=0;const store={get:async(c,k)=>{reads++;const value=docs.get(c+'/'+k);return value?{value}:null;}};
 const run=(record,cache)=>auditSessionOwner({store,plan,pool,record,cache});
 const record=(batch,sequence=batch.start)=>({batchId:batch.id,shardId:batch.worker,sourceSessionHash:batch.sessionHash,sequence});
 return {plan,pool,old,fresh,spec,retirement,docs,run,record,reads:()=>reads};
}
test('two session generations keep historical ownership and bound reads by batches',async()=>{
 const f=fixture(),cache=new Map();for(const b of [f.old,f.fresh])for(const n of [b.start,b.start+1])await f.run(f.record(b,n),cache);
 assert.equal(f.reads(),4);
});
test('forged old/new session, worker or sequence cannot pass ownership audit',async()=>{
 for(const patch of [{sourceSessionHash:'new'},{shardId:1},{sequence:3}]){const f=fixture();await assert.rejects(f.run({...f.record(f.old),...patch}));}
 const f=fixture();await assert.rejects(f.run({...f.record(f.fresh),sourceSessionHash:'old'}));
});
test('missing or changed historical batch, retirement and generation proof fail closed',async()=>{
 for(const mutate of [f=>{f.old.checkpoint=1;},f=>{f.old.pending={};},f=>{f.retirement.trialId='other';},f=>{f.spec.firstBatchId=3;},f=>{f.pool.demoGeneration.id='b'.repeat(64);},f=>{f.docs.delete('state/batch:'+f.plan.trialId+':1');}]){
  const f=fixture();mutate(f);await assert.rejects(f.run(f.record(f.old)));
 }
});
test('legacy audit stays compatible without generation and rejects silently removed generation',async()=>{
 const f=fixture();delete f.plan.demoGeneration;await assert.rejects(f.run(f.record(f.fresh)));
 delete f.pool.demoGeneration;await f.run(f.record(f.fresh));await assert.rejects(f.run(f.record(f.old)));assert.equal(f.reads(),0);
});
