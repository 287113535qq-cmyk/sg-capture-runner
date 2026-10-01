import test from 'node:test';import assert from 'node:assert/strict';
import {network} from './count-network-close.test.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {closeCountShared} from './count-shared-close.mjs';
function shared(){
 const f=network(),p=f.args.profile;p.schema='sg-count-shared-close-profile-v1';p.group='primary';
 f.batch.pending.awaiting=null;p.batchesHash=hash([f.batch]);p.unknownAttempts=0;
 const hold=f.docs.get('state/global-hold').value;hold.details.code='GLOBAL_SOURCE_STOPPED';p.holdHash=hash(hold);
 return f;
}
test('shared-stop peer flushes before clearing protection and preserves its allocation',async()=>{
 const f=shared(),activation=hash(f.get('journal',f.key)),out=await closeCountShared(f.args);
 assert.equal(out.completePreserved,2);assert.equal(out.abandonedAttempts,1);assert.equal(out.unknownAttempts,0);
 assert.equal(out.sourceRequests,0);assert.equal(out.newBetAllowance,0);assert.equal(out.repairKey,null);
 assert.equal(f.mongo.size,2);assert.equal(f.get('state','pool:synthetic-demo').value.enabled,true);
 assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,0);
 assert.equal(f.get('state','global-hold').value.active,false);assert.equal(hash(f.get('journal',f.key)),activation);
 await assert.rejects(closeCountShared(f.args));
});
for(const cause of ['unknown','lease','hold','scene','jobs','count','batch-failure'])test('shared close refuses '+cause+' before writes',async()=>{
 const f=shared();if(cause==='unknown')f.batch.pending.awaiting='unknown';if(cause==='lease')f.batch.leaseUntil=101;
 if(cause==='hold')f.docs.get('state/global-hold').value.details.code='MONGO_CONTENT_CONFLICT';
 if(cause==='scene')f.pool.confirmed=1;if(cause==='jobs')f.args.jobs.jobs[2].status='in_progress';
 if(cause==='count')f.args.profile.completePreserved=3;if(cause==='batch-failure')f.batch.failure='MONEY';
 const before=hash([...f.docs]);await assert.rejects(closeCountShared(f.args));assert.equal(hash([...f.docs]),before);
});
test('shared close leaves protection on Mongo or partial archive failure',async()=>{
 for(const fault of ['mongo','archive']){const f=shared();if(fault==='mongo')f.corrupt();else f.fail('count-shared-close:synthetic-demo:77:1:settled');
  await assert.rejects(closeCountShared(f.args));assert.equal(f.get('state','global-hold').value.active,true);
  assert.equal(f.get('state','pool:synthetic-demo').value.enabled,false);
 }
});
