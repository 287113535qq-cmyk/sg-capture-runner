import test from 'node:test';
import assert from 'node:assert/strict';
import {network} from './count-network-close.test.mjs';
import {closeCountShared} from './count-shared-close.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {checkCountPeerHolds} from './count-peer-boundary.mjs';
import {reconcilesPreparedEvidence} from './prepared-evidence-disposition.mjs';

test('prepared cleanup distinguishes unfinished originals from independently received terminals',()=>{
 assert.equal(reconcilesPreparedEvidence({disposition:'interrupted-abandoned-without-replay'}),false);
 assert.equal(reconcilesPreparedEvidence({disposition:'received-terminal-reconciled-without-source'}),true);
 for(const field of ['terminalRecords','terminalMappings'])assert.throws(()=>reconcilesPreparedEvidence({
  disposition:'interrupted-abandoned-without-replay',[field]:[{record:'unverified'}]}),/ABANDONMENT_TERMINALS/);
 for(const disposition of [undefined,'resume','complete','unknown-abandoned-without-replay'])
  assert.throws(()=>reconcilesPreparedEvidence({disposition}),/DISPOSITION/);
});

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

function terminalFixture(){
 const f=fixture(),p=f.args.profile,b=f.batch;
 b.pending.raw.synthetic=true;
 const record={_id:hash('received-terminal'),contentHash:hash('terminal-content'),raw:structuredClone(b.pending.raw),
  trialId:f.args.plan.trialId,batchId:b.id,shardId:b.worker,sequence:b.pending.sequence,
  attempt:b.pending.attempt,sourceSessionHash:b.sessionHash,fixtureOnly:false,buy:0};
 p.disposition='received-terminal-reconciled-without-source';p.completePreserved=3;p.abandonedAttempts=0;
 p.faultPendingHash=hash(b.pending);p.batchesHash=hash([b]);
 p.terminalRecords=[{batchId:b.id,pendingHash:hash(b.pending),recordHash:hash(record)}];
 f.args.terminalRecords=[record];
 f.args.parser={call:async q=>q.op==='next'?null:{verified:q.record?.raw.synthetic===true}};
 return f;
}

test('received complete terminal is preserved as a complete record before releasing the exact hold',async()=>{
 const f=terminalFixture(),pending=structuredClone(f.batch.pending),original=hash(f.get('journal',f.key));
 const out=await closeCountShared(f.args);
 assert.equal(out.completePreserved,3);assert.equal(out.abandonedAttempts,0);
 assert.equal(out.receivedTerminalsReconciled,1);assert.equal(out.sourceRequests,0);assert.equal(out.newBetAllowance,0);
 assert.equal(f.mongo.size,3);assert.equal(f.get('state','global-hold').value.active,false);
 assert.equal(f.get('state','pool:synthetic-demo').value.confirmed,3);
 assert.equal(hash(f.get('journal',f.key)),original);
 assert.deepEqual(f.get('journal','count-shared-close:synthetic-demo:77:1:terminal:1').value.pending,pending);
 await assert.rejects(closeCountShared(f.args));
});

for(const cause of ['incomplete','unverified','record-binding','raw-changed','duplicate','unknown','wrong-attempt','new-mapping'])
 test('received terminal closure refuses '+cause+' before writes',async()=>{
  const f=terminalFixture(),record=f.args.terminalRecords[0];
  if(cause==='incomplete')f.args.parser.call=async q=>q.op==='next'?{MSGID:'FREE_GAME'}:{verified:true};
  if(cause==='unverified')f.args.parser.call=async q=>q.op==='next'?null:{verified:false};
  if(cause==='record-binding')f.args.profile.terminalRecords[0].recordHash='0'.repeat(64);
  if(cause==='raw-changed')record.raw.steps[0].responsePayload='changed';
  if(cause==='duplicate')f.args.terminalRecords.push(record);
  if(cause==='unknown')f.batch.pending.awaiting='unknown';
  if(cause==='wrong-attempt')record.attempt='other';
  if(cause==='new-mapping')record.buy=1;
  if(['raw-changed','wrong-attempt','new-mapping'].includes(cause))
   f.args.profile.terminalRecords[0].recordHash=hash(record);
  if(cause==='new-mapping')f.args.parser.call=async q=>q.op==='next'?null:{verified:q.record.buy===0};
  const before=hash([...f.docs]);await assert.rejects(closeCountShared(f.args));assert.equal(hash([...f.docs]),before);
 });

test('terminal Mongo conflict retains the hold and original terminal proof',async()=>{
 const f=terminalFixture(),pending=structuredClone(f.batch.pending);f.corrupt();
 await assert.rejects(closeCountShared(f.args));assert.equal(f.get('state','global-hold').value.active,true);
 assert.deepEqual(f.get('journal','count-shared-close:synthetic-demo:77:1:terminal:1').value.pending,pending);
});

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
