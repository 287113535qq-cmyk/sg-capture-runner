import test from 'node:test';import assert from 'node:assert/strict';
import {reviewCountWindow} from './count-window-review.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const plan={gameId:32799,trialId:'sg_r1_20261001_32799',adapter:'rhino-wms-v1',target:300000,buy:0,phase:1,countAllocation:'a'.repeat(64)},docs=new Map(),batches={},records=[];
 for(let id=1;id<=26;id++){
  const start=(id-1)*100+1,complete=id===26?1:100,b={id,worker:0,start,end:id*100,sessionHash:hash('fixture'),pending:null,journaled:start+complete-1,checkpoint:start+complete-1,leaseUntil:0};
  if(id===1)b.failure='OLD_ARCHIVED_FAILURE';
  docs.set('batch:'+plan.trialId+':'+id,{value:b});batches[id]={...b,closed:true,complete,evidenceHash:hash(b)};
  for(let n=start;n<start+complete;n++)records.push({_id:hash(n),contentHash:hash(n),sequence:n,trialId:plan.trialId,buy:0,fixtureOnly:false,batchId:id,shardId:0,sourceSessionHash:b.sessionHash,raw:{synthetic:true}});
 }
 const spec={schema:'sg-complete-count-v1',trialId:plan.trialId,activation:plan.countAllocation,target:plan.target,maxSequence:600000,firstSequence:2601,baselineBatchCount:26,baselineHash:hash(Object.values(batches))};
 const pool={enabled:true,confirmed:2501,nextBatchId:27,nextSequence:2601,workers:{},countAllocation:{specHash:hash(spec),reserved:0,batches}};
 docs.set('pool:'+plan.trialId,{value:pool});let requests=0;
 const args={plan,pool,spec,store:{get:async(c,k)=>{assert.equal(c,'state');return docs.get(k);}},parser:{call:async({op})=>{assert.equal(op,'verify');return {verified:true};}},
  transport:{request:async(op,{after})=>{assert.equal(op,'rounds_scan');requests++;return records.filter(r=>r.sequence>after).slice(0,100);}}};
 return {args,records,docs,requests:()=>requests};
}
test('partial window fully verifies 2501 records through bounded pages without marking game complete or writing',async()=>{
 const f=fixture(),before=hash([...f.docs]);const result=await reviewCountWindow(f.args);
 assert.equal(result.complete,2501);assert.equal(result.remainingComplete,297499);assert.equal(result.pages,26);assert.equal(f.requests(),27);
 assert.equal(result.gameComplete,false);assert.equal(result.databaseWrites,0);assert.equal(hash([...f.docs]),before);
});
for(const bad of ['missing-record','unverified','active-batch','changed-pool','excess-record','changed-baseline'])test('window refuses '+bad,async()=>{
 const f=fixture();
 if(bad==='missing-record')f.records.pop();
 if(bad==='unverified')f.args.parser={call:async()=>({verified:false})};
 if(bad==='active-batch')f.args.pool.workers={0:{activeBatch:{id:27}}};
 if(bad==='changed-pool')f.args.store={get:async(c,k)=>k.startsWith('pool:')?{value:{...f.args.pool,enabled:false}}:f.docs.get(k)};
 if(bad==='excess-record')f.records.push({...f.records.at(-1),sequence:2600});
 if(bad==='changed-baseline')f.docs.get('batch:'+f.args.plan.trialId+':1').value.failure='CHANGED';
 await assert.rejects(reviewCountWindow(f.args));
});
