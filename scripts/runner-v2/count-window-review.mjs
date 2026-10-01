import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkLedger,auditAllocatedRecord,auditCountBatch} from './complete-count.mjs';

// Read-only measurement verification. A partial window never marks a game complete.
export async function reviewCountWindow({store,transport,parser,plan,pool,spec}){
 const ledger=checkLedger(pool,plan,spec),before=hash(pool);
 assert(ledger.reserved===0&&pool.enabled&&!pool.failure&&Object.values(pool.workers).every(w=>!w.activeBatch&&w.leaseUntil<=Date.now()),'WINDOW_NOT_SETTLED');
 const cache=new Map(),counts=new Map(),digest=createHash('sha256');let after=0,count=0,pages=0;
 while(true){
  const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after});
  assert(Array.isArray(rows)&&rows.length<=100,'WINDOW_PAGE');
  if(!rows.length)break;
  assert(++pages<=Math.ceil(plan.target/100)+1,'WINDOW_PAGE_BOUND');
  for(const record of rows){
   assert(Number.isSafeInteger(record.sequence)&&record.sequence>after,'WINDOW_RECORD_ORDER');
   auditAllocatedRecord({pool,plan,spec,record});
   await auditCountBatch({store,pool,plan,spec,record,cache});
   assert((await parser.call({op:'verify',plan,raw:record.raw,record}))?.verified===true,'WINDOW_PYTHON_UNVERIFIED');
   digest.update(hash([record._id,record.contentHash])+'\n');after=record.sequence;count++;
   assert(count<=pool.confirmed,'WINDOW_EXCESS');counts.set(record.batchId,(counts.get(record.batchId)||0)+1);
  }
 }
 assert(count===pool.confirmed,'WINDOW_MISSING');
 for(const item of Object.values(pool.countAllocation.batches))assert((counts.get(item.id)||0)===item.complete,'WINDOW_BATCH_COUNT');
 assert(hash((await store.get('state','pool:'+plan.trialId))?.value)===before,'WINDOW_CHANGED');
 return {schema:'sg-count-window-review-v1',gameId:plan.gameId,trialId:plan.trialId,activation:spec.activation,
  complete:count,remainingComplete:plan.target-count,recordsHash:digest.digest('hex'),poolHash:before,
  fullReadback:true,pageSize:100,pages,lastSequence:after,sourceRequests:0,databaseWrites:0,
  gameComplete:count===plan.target};
}
