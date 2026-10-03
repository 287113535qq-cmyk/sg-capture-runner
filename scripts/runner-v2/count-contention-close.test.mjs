import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {network} from './count-network-close.test.mjs';
import {closeCountShared} from './count-shared-close.mjs';
import {reviewClosedReadbacks} from './closed-readback-history.mjs';
import {allocateCountBatch} from './complete-count.mjs';

async function contention(){
 const f=network(),old=f.args.plan.trialId,trial='sg_r1_20260928_32714';
 const plan=f.args.plan;Object.assign(plan,{trialId:trial,gameId:32714,featureProfile:'huff-action-v1'});
 for(const [k,r] of [...f.docs]){f.docs.delete(k);if(r.value.trialId===old)r.value.trialId=trial;
  f.docs.set(k.replaceAll(old,trial),r);}
 f.key=f.key.replaceAll(old,trial);f.batch.pending=null;f.batch.checkpoint=2;
 const spec=f.docs.get('journal/'+f.key).value;spec.planHash=hash(plan);spec.gameId=32714;
 f.pool.planHash=hash(plan);f.pool.countAllocation.specHash=hash(spec);
 Object.assign(f.docs.get('journal/'+f.key+':complete').value,{specHash:hash(spec),planHash:hash(plan)});
 const campaign=f.docs.get('state/campaign').value;campaign.activeGame=32714;
 const hold=f.docs.get('state/global-hold').value;
 Object.assign(hold.details,{trialId:trial,code:'STATE_CONTENTION',category:'storage'});
 const settlement={schema:'sg-count-batch-settlement-v1',activation:spec.activation,trialId:trial,
  batch:structuredClone(f.batch),fullReadback:true};
 f.docs.set(`journal/count-settlement:${trial}:${spec.activation}:1`,{value:settlement});
 for(const [k,r] of f.docs)if(k.startsWith('journal/receipt:'))f.mongo.set(r.value._id,structuredClone(r.value));
 // Production immutable create acknowledges an identical frozen receipt.
 f.args.store.create=async(c,k,v)=>{const prior=f.get(c,k);
  if(prior){assert.equal(hash(prior.value),hash(v),'IMMUTABLE_CONFLICT');return prior;}
  const row={value:structuredClone(v)};f.docs.set(c+'/'+k,row);return row;};
 const permit=f.docs.get(`journal/count-run:${trial}:77:1`).value;
 f.args.profile={...f.args.profile,schema:'sg-count-contention-close-profile-v1',group:'primary',trialId:trial,
  gameId:32714,planHash:hash(plan),sourceProfileHash:spec.profileHash,faultCode:'STATE_CONTENTION',
  disposition:'known-cas-contention-settled-without-source',abandonedAttempts:0,
  poolHash:hash(f.pool),campaignHash:hash(campaign),holdHash:hash(hold),batchesHash:hash([f.batch]),
  permitHash:hash(permit),closedReadbackReuse:await reviewClosedReadbacks({store:f.args.store,plan,pool:f.pool,spec,now:()=>100})};
 return {...f,spec,settlement};
}
test('known CAS contention reuses the exact frozen settlement, with no new request or allowance',async()=>{
 const f=await contention(),before=hash(f.batch),evidence=hash(f.settlement),r=await closeCountShared(f.args);
 const p=f.get('state','pool:'+f.args.plan.trialId).value;
 assert.equal(p.confirmed,2);assert.equal(p.countAllocation.reserved,0);assert.equal(p.enabled,true);
 assert.equal(p.workers[7].activeBatch,null);assert.equal(f.get('state','global-hold').value.active,false);
 assert.equal(hash(f.get('state','batch:'+f.args.plan.trialId+':1').value),before);
 assert.equal(hash(f.get('journal',`count-settlement:${f.args.plan.trialId}:${f.spec.activation}:1`).value),evidence);
 assert.equal(r.sourceRequests,0);assert.equal(r.newBetAllowance,0);assert.equal(r.unknownAttempts,0);
 assert.equal(r.abandonedAttempts,0);assert.equal(r.currentRecordsRead,2);assert.equal(f.mongo.size,2);
 await assert.rejects(closeCountShared(f.args));
});
for(const cause of ['unknown','lease','missing-freeze','changed-freeze','category','fault','profile','history','count'])
 test('contention closure rejects '+cause+' before mutation',async()=>{
  const f=await contention(),p=f.args.profile;
  if(cause==='unknown'){f.batch.pending={awaiting:'unknown'};p.batchesHash=hash([f.batch]);}
  if(cause==='lease'){f.batch.leaseUntil=101;p.batchesHash=hash([f.batch]);}
  if(cause==='missing-freeze')f.docs.delete(`journal/count-settlement:${f.args.plan.trialId}:${f.spec.activation}:1`);
  if(cause==='changed-freeze')f.settlement.batch.epoch++;
  if(cause==='category'){const h=f.docs.get('state/global-hold').value;h.details.category='source_network';p.holdHash=hash(h);}
  if(cause==='fault')p.faultCode='MONGO_CONTENT_CONFLICT';
  if(cause==='profile')p.sourceProfileHash='0'.repeat(64);
  if(cause==='history')p.closedReadbackReuse.rangesHash='0'.repeat(64);
  if(cause==='count')p.completePreserved=3;
  const before=hash([...f.docs]);await assert.rejects(closeCountShared(f.args));assert.equal(hash([...f.docs]),before);
 });
test('Mongo conflict keeps the shared hold and original immutable freeze',async()=>{
 const f=await contention(),frozen=hash(f.settlement);f.corrupt();
 await assert.rejects(closeCountShared(f.args));assert.equal(f.get('state','global-hold').value.active,true);
 assert.equal(f.get('state','pool:'+f.args.plan.trialId).value.enabled,false);assert.equal(hash(f.settlement),frozen);
});
test('closed history reuses only matching original full-readback receipts',async()=>{
 const f=await contention();await closeCountShared(f.args);
 const pool=f.get('state','pool:'+f.args.plan.trialId).value;
 const args={store:f.args.store,plan:f.args.plan,pool,spec:f.spec,now:()=>100};
 const good=await reviewClosedReadbacks(args);assert.equal(good.complete,2);assert.equal(good.rawRecordsRead,0);
 const key=`journal/count-settlement:${f.args.plan.trialId}:${f.spec.activation}:1`;
 for(const corrupt of ['receipt','batch','missing','counter']){
  const original=structuredClone(f.docs.get(key)),batch=f.docs.get('state/batch:'+f.args.plan.trialId+':1');
  if(corrupt==='receipt')f.docs.get(key).value.fullReadback=false;
  if(corrupt==='batch')batch.value.epoch++;
  if(corrupt==='missing')f.docs.delete(key);
  if(corrupt==='counter')pool.confirmed++;
  await assert.rejects(reviewClosedReadbacks(args));f.docs.set(key,original);
  if(corrupt==='batch')batch.value.epoch--;if(corrupt==='counter')pool.confirmed--;
 }
});
function allocator(huff=true,ceiling=600){
 const plan={trialId:'tail',gameId:32714,target:121,...(huff?{featureProfile:'huff-action-v1'}:{})};
 const spec={schema:'sg-complete-count-v1',trialId:'tail',target:121,firstSequence:1,maxSequence:ceiling,
  baselineBatchCount:0,baselineHash:hash([]),sessionRotation:'closed-batches-v1'};
 const pool={nextBatchId:1,nextSequence:1,confirmed:0,workers:Object.fromEntries(Array.from({length:20},(_,i)=>
  [i,{sessionHash:hash(i),leaseUntil:0,activeBatch:null}])),countAllocation:{specHash:hash(spec),reserved:0,batches:{}}};
 return {plan,spec,pool,now:100};
}
test('twenty Huff workers reserve the last 121 as bounded 100 and 21, without overbooking',()=>{
 const f=allocator(),a=Array.from({length:20},(_,worker)=>allocateCountBatch({...f,worker}).batch);
 assert.deepEqual(a.slice(0,2).map(b=>[b.start,b.end]),[[1,100],[101,121]]);
 assert(a.slice(2).every(b=>b===null));assert.equal(f.pool.countAllocation.reserved,121);
 assert.equal(f.pool.nextSequence,122);
});
test('Huff batches still obey the sequence ceiling; historical allocation stays balanced',()=>{
 const f=allocator(true,111),a=Array.from({length:20},(_,worker)=>allocateCountBatch({...f,worker}).batch);
 assert.deepEqual(a.slice(0,2).map(b=>[b.start,b.end]),[[1,100],[101,111]]);assert(a.slice(2).every(b=>!b));
 const legacy=allocator(false);assert.equal(allocateCountBatch({...legacy,worker:0}).batch.end,7);
});
