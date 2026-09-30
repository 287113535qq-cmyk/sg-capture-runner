import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './demo-rollover.test.mjs';import {rolloverDemo} from './demo-rollover.mjs';
import {RunnerPool} from './state-store.mjs';import {DemoFresh} from './demo-fresh.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
async function setup(){
 const f=fixture();await rolloverDemo(f.args);const plan=f.args.plan;
 f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:2:1';
 const pool=new RunnerPool({store:f.args.store,plan,group:'primary',now:f.args.now,commit:f.args.commit});
 const lease=await pool.register(1,{owner:'peer',sessionHash:hash('peer')});const batch=await pool.take(lease);
 const identity={shardId:0,commitSha:f.args.commit,sessionHash:hash('new-zero')};
 const materialize=()=>f.docs.set('state/batch:'+plan.trialId+':'+batch.id,{value:{...batch,pending:null,bootstrapAwaiting:null,journaled:batch.start-1,checkpoint:batch.start-1,sessionHash:hash('peer')}});
 return {f,plan,batch,identity,materialize};
}
test('actual pool reservation before batch create waits for peer materialization without granting extra BETs',async()=>{
 const {f,plan,identity,materialize}=await setup();let waits=0;
 const fresh=new DemoFresh({store:f.args.store,plan,stage:'fresh',runKey:'capture-run:2:1',now:f.args.now,sleep:async()=>{waits++;materialize();}});
 assert.equal((await fresh.admit(identity,0)).limit,5);assert.equal(waits,1);
});
test('missing batch without live owner, lost generation, or own reservation never becomes permission',async()=>{
 for(const cause of ['expired','unowned','generation','own']){
  const {f,plan,identity}=await setup(),pool=f.docs.get('state/pool:'+plan.trialId).value;
  if(cause==='expired')pool.workers['1'].leaseUntil=0;
  if(cause==='unowned')pool.workers['1'].activeBatch=null;
  if(cause==='own'){pool.workers['0']=pool.workers['1'];pool.workers['0'].activeBatch.worker=0;delete pool.workers['1'];}
  const base=f.args.store;let reads=0;const store={...base,get:async(c,k)=>{const r=await base.get(c,k);if(k==='pool:'+plan.trialId&&++reads===2&&cause==='generation')r.value.demoGeneration.specHash='0'.repeat(64);return r;}};
  const fresh=new DemoFresh({store,plan,stage:'fresh',runKey:'capture-run:2:1',now:f.args.now,sleep:async()=>assert.fail('must not wait')});
  await assert.rejects(fresh.admit(identity,0),/DEMO_FRESH_(BATCH_MISSING|POOL_CHANGED)/);
 }
});
test('reserved batch that never materializes remains blocked after bounded read-only waits',async()=>{
 const {f,plan,identity}=await setup();let waits=0;const before=hash([...f.docs]);
 const fresh=new DemoFresh({store:f.args.store,plan,stage:'fresh',runKey:'capture-run:2:1',now:f.args.now,sleep:async()=>{waits++;}});
 await assert.rejects(fresh.admit(identity,0),/DEMO_FRESH_BATCH_MISSING/);assert.equal(waits,8);assert.equal(hash([...f.docs]),before);
});
