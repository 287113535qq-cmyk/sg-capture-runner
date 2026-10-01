import test from 'node:test';import assert from 'node:assert/strict';
import {reviewHistoryPrefix,countHistoryBoundary} from './count-window-history.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const plan={trialId:'sg_r1_20261001_32799',target:300000},docs=new Map(),batches={};
 for(let id=1;id<=300;id++){
  const b={id,worker:0,start:(id-1)*100+1,end:id*100,sessionHash:hash(id),pending:null,journaled:id*100,checkpoint:id*100,leaseUntil:0};
  if(id===1)b.failure='OLD_ARCHIVED_FAILURE';
  const key=`count-settlement:${plan.trialId}:${'a'.repeat(64)}:${id}`;
  const receipt={schema:'sg-count-batch-settlement-v1',activation:'a'.repeat(64),trialId:plan.trialId,fullReadback:true,batch:b};
  docs.set('state/batch:'+plan.trialId+':'+id,{value:b});docs.set('journal/'+key,{value:receipt});
  batches[id]={id,worker:0,start:b.start,end:b.end,sessionHash:b.sessionHash,closed:true,complete:100,
   evidenceHash:id<=2?hash(b):hash(receipt),...(id>2?{settlementKey:key}:{})};
 }
 const spec={schema:'sg-complete-count-v1',trialId:plan.trialId,activation:'a'.repeat(64),target:300000,maxSequence:600000,
  firstSequence:201,baselineBatchCount:2,baselineHash:hash([batches[1],batches[2]]),profileHash:hash('profile'),sessionRotation:'closed-batches-v1'};
 const pool={enabled:true,confirmed:30000,nextBatchId:301,nextSequence:30001,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches}};
 const permit={schema:'sg-count-run-v1',run:'77:1',commit:'a'.repeat(40),profileHash:spec.profileHash,activation:spec.activation,completeBefore:25000,historyBoundary:{schema:'sg-count-history-boundary-v1',
  nextBatchId:251,nextSequence:25001,complete:25000,ledgerHash:hash(Array.from({length:250},(_,i)=>batches[i+1]))}};
 let reads=0;const store={async get(){throw Error('unbounded per-batch read');},async getMany(c,keys){assert(keys.length<=100);reads++;return keys.map(k=>docs.get(c+'/'+k));}};
 return {args:{store,plan,pool,spec,permit},docs,reads:()=>reads};
}
test('25000 preserved records reuse exact immutable proofs with six bounded reads and no old raw reads',async()=>{
 const f=fixture(),old=hash([...f.docs]);const r=await reviewHistoryPrefix(f.args);assert.equal(r.complete,25000);assert.equal(r.after,25000);
 assert.equal(r.pages,3);assert.equal(f.reads(),6);assert.equal(r.rawRecordsRead,0);assert.equal(r.historicalReadbackFresh,false);
 assert.equal(r.preservedReadbackReused,true);assert.equal(hash([...f.docs]),old);
});
for(const bad of ['permission-missing','wrong-count','cut-in-batch','changed-prefix','missing-batch','pending','missing-proof','unverified-proof','changed-baseline','active-reservation'])
test('reject '+bad+' before any source or metadata write',async()=>{
 const f=fixture(),a=f.args,h=a.permit.historyBoundary;
 if(bad==='permission-missing')delete a.permit.historyBoundary;
 if(bad==='wrong-count')h.complete++;
 if(bad==='cut-in-batch')h.nextSequence++;
 if(bad==='changed-prefix')h.ledgerHash=hash('changed');
 if(bad==='missing-batch')f.docs.delete('state/batch:'+a.plan.trialId+':100');
 if(bad==='pending')f.docs.get('state/batch:'+a.plan.trialId+':100').value.pending={};
 if(bad==='missing-proof')f.docs.delete('journal/'+a.pool.countAllocation.batches[100].settlementKey);
 if(bad==='unverified-proof')f.docs.get('journal/'+a.pool.countAllocation.batches[100].settlementKey).value.fullReadback=false;
 if(bad==='changed-baseline')f.docs.get('state/batch:'+a.plan.trialId+':1').value.failure='CHANGED';
 if(bad==='active-reservation')a.pool.countAllocation.reserved=100;
 await assert.rejects(()=>reviewHistoryPrefix(a));
});

test('admission captures an exact closed boundary and does not equate sequence with completed count',()=>{
 const f=fixture();const h=countHistoryBoundary(f.args);assert.equal(h.nextBatchId,301);assert.equal(h.complete,30000);
 f.args.pool.workers={0:{activeBatch:{id:301},leaseUntil:0}};assert.throws(()=>countHistoryBoundary(f.args));
});
