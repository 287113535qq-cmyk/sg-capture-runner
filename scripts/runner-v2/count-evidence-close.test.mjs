import test from 'node:test';
import assert from 'node:assert/strict';
import {network} from './count-network-close.test.mjs';
import {closeCountShared} from './count-shared-close.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerHolds} from './count-peer-boundary.mjs';

test('generic maintenance fault is hash bound and never releases the source gate',()=>{
 const own={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'MIXED_HOLD_FEATURE',
  category:'source_protocol',trialId:'sg_r1_20260928_32721',cooldownUntil:0}};
 const holds=[{_id:'secondary/global-hold',value:own},{_id:'primary/global-hold',value:{active:false}}];
 checkCountPeerHolds(holds,'secondary',hash(own),'MIXED_HOLD_FEATURE');
 assert.throws(()=>checkCountPeerHolds(holds,'secondary'));
 assert.throws(()=>checkCountPeerHolds(holds,'secondary',hash(own),'OTHER_CODE'));
 assert.throws(()=>checkCountPeerHolds(holds,'secondary','0'.repeat(64),'MIXED_HOLD_FEATURE'));
 assert.throws(()=>checkCountPeerHolds(holds,'primary',hash(own),'MIXED_HOLD_FEATURE'));
 holds[1].value.active=true;
 assert.throws(()=>checkCountPeerHolds(holds,'secondary',hash(own),'MIXED_HOLD_FEATURE'));
});

function fixture(){
 const f=network(),p=f.args.profile;
 p.schema='sg-count-evidence-close-profile-v1';p.group='primary';
 p.disposition='interrupted-abandoned-without-replay';p.faultCode='UNRECOGNIZED_DISPLAY_FIELD';
 p.sourceProfileHash='e'.repeat(64);
 f.batch.pending.awaiting=null;
 f.batch.pending.raw={fixtureOnly:false,steps:[{msgId:'BET',requestPayload:'original-request',
   responsePayload:'unknown-display-original',responseXml:'original-xml'}]};
 p.faultPendingHash=hash(f.batch.pending);p.batchesHash=hash([f.batch]);
 const campaign=f.docs.get('state/campaign').value;
 campaign.games=[{game_id:f.args.plan.gameId,status:'active'}];p.campaignHash=hash(campaign);
 const hold=f.docs.get('state/global-hold').value;
 hold.details.code=p.faultCode;hold.details.category='source_protocol';p.holdHash=hash(hold);
 return f;
}

test('unknown gameplay shape retires by bound original evidence without interpreting or resuming it',async()=>{
 const f=fixture(),before=structuredClone(f.batch.pending),activation=hash(f.get('journal',f.key));
 const out=await closeCountShared(f.args);
 assert.equal(out.completePreserved,2);assert.equal(out.abandonedAttempts,1);
 assert.equal(out.sourceRequests,0);assert.equal(out.newBetAllowance,0);
 assert.equal(f.mongo.size,2);assert.equal(f.get('state','pool:synthetic-demo').value.enabled,false);
 assert.equal(f.get('state','pool:synthetic-demo').value.countAllocation.reserved,0);
 assert.equal(f.get('state','campaign').value.activeGame,null);
 assert.equal(f.get('state',out.repairKey).value.sourceAllowance,0);
 assert.equal(hash(f.get('journal',f.key)),activation);
 const archive=[...f.docs.values()].find(r=>r.value.schema==='sg-retired-count-batch-v1');
 assert.deepEqual(archive.value.batch.pending,before);
 await assert.rejects(closeCountShared(f.args));
});

for(const cause of ['lease','jobs','source-profile','unknown-request','missing-raw','fault-binding','count','storage-category'])
 test('evidence closure refuses '+cause+' without writes',async()=>{
  const f=fixture();
  if(cause==='lease')f.batch.leaseUntil=101;
  if(cause==='jobs')f.args.jobs.jobs[2].status='in_progress';
  if(cause==='source-profile')f.args.profile.sourceProfileHash='0'.repeat(64);
  if(cause==='unknown-request')f.batch.pending.awaiting='unknown';
  if(cause==='missing-raw'){delete f.batch.pending.raw.steps[0].responseXml;f.args.profile.faultPendingHash=hash(f.batch.pending);f.args.profile.batchesHash=hash([f.batch]);}
  if(cause==='fault-binding')f.args.profile.faultPendingHash='0'.repeat(64);
  if(cause==='count')f.args.profile.completePreserved=3;
  if(cause==='storage-category'){f.docs.get('state/global-hold').value.details.category='storage';f.args.profile.holdHash=hash(f.docs.get('state/global-hold').value);}
  const before=hash([...f.docs]);await assert.rejects(closeCountShared(f.args));assert.equal(hash([...f.docs]),before);
 });

test('Mongo discrepancy and interrupted archive retain protection',async()=>{
 for(const cause of ['mongo','archive']){
  const f=fixture();if(cause==='mongo')f.corrupt();else f.fail('count-shared-close:synthetic-demo:77:1:settled');
  await assert.rejects(closeCountShared(f.args));
  assert.equal(f.get('state','global-hold').value.active,true);
  assert.equal(f.get('state','pool:synthetic-demo').value.enabled,false);
 }
});
