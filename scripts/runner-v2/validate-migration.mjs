import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {connectGateway} from './transport.mjs';
import {ResourceGate} from './resource-gate.mjs';
import {RunnerState} from './state-store.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
import {analyzer} from './analyzer.mjs';
import {repositories} from '../trial/runner-group.mjs';

const group=repositories[process.env.GITHUB_REPOSITORY]?.name;assert(group);
const cfg=JSON.parse(fs.readFileSync('config/github-migration-v2.json','utf8'));
const plan=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[cfg.groups[group]];
const transport=connectGateway(),gate=new ResourceGate(),store=new RunnerState({transport,gate,deadline:Date.now()+30*60000}),parser=analyzer();
try{
  const recovery=(await store.get('state','migration-recovery-complete'))?.value;assert(recovery);
  const pool=(await store.get('state','pool:'+plan.trialId)).value;
  assert(Object.values(pool.workers).every(w=>w.leaseUntil<=Date.now()),'ACTIVE_WORKERS');
  const batches=new Map();let journaled=0;
  for(let id=1;id<pool.nextBatchId;id++){
    const b=(await store.get('state',`batch:${plan.trialId}:${id}`))?.value;if(!b)continue;
    assert(!b.pending && !b.pendingOriginal && !b.bootstrapAwaiting && !b.failure,'UNRESOLVED_PENDING');
    assert(b.journaled===b.checkpoint,'UNCONFIRMED_DATA');batches.set(id,b);journaled+=b.journaled-b.start+1;
  }
  let after=0,count=0,oldPreserved=0,newComplete=0;const workers={};
  while(true){
    await store.writable();
    const rows=await transport.request('rounds_scan',{trialId:plan.trialId,after});if(!rows.length)break;
    for(const record of rows){
      assert(record.sequence>after && record.sequence<=plan.target && record.fixtureOnly===false);
      assert(pool.workers[String(record.shardId)]?.sessionHash===record.sourceSessionHash,'SESSION_CHANGED');
      await parser.call({op:'verify',plan,record,raw:record.raw});
      const b=batches.get(record.batchId);assert(b && record.sequence>=b.start && record.sequence<=b.journaled);
      if(record.sequence<=(b.legacyJournaled??b.start-1))oldPreserved++;
      else{
        const receipt=(await store.get('journal',receiptKey(plan.trialId,record.sequence)))?.value;
        assert(stable(receipt)===stable(record),'RAW_JOURNAL_MONGO_MISMATCH');
        workers[String(record.shardId)]=(workers[String(record.shardId)]||0)+1;newComplete++;
      }
      after=record.sequence;count++;
    }
  }
  assert(count===journaled && oldPreserved===recovery.completeFullReadback);
  assert(Object.keys(workers).length===20 && Object.values(workers).every(n=>n===10),'SHORT_WORKER_COUNTS_INCOMPLETE');
  assert(stable((await store.get('state','pool:'+plan.trialId)).value)===stable(pool),'POOL_CHANGED_DURING_AUDIT');
  const result={group,trialId:plan.trialId,recoveryProof:recovery.proofHash,fullReadback:count,oldPreserved,
    newComplete,workersVerified:20,pending:0,oldRecordsDeleted:0,unknownBetsReplayed:0,
    poolHash:createHash('sha256').update(stable(pool)).digest('hex'),at:Date.now()};
  await store.create('state','migration-validation-complete',result,{immutable:true});console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({group,error:'SHORT_VALIDATION_REQUIRES_REVIEW'}));process.exitCode=2;}
finally{parser.close();transport.close();}
