import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {operatorFixture,finishShort} from './session-test-fixture.mjs';
import {sessionPolicy,reviewSessionIncident,SessionRecovery} from './session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

async function fixture(gameId=32739) {
  const f=await operatorFixture(gameId);await f.operator.recover();
  const policy=sessionPolicy(gameId),prefix='protocol:'+f.profile.id;
  const get=k=>f.docs.get('state/'+k).value;
  f.docs.get('journal/'+prefix+':proof').value.proofHash=policy.previousProof;
  const previous=f.docs.get('journal/'+prefix+':before').value;
  const campaign=get('campaign'),pool=get('pool:'+f.plan.trialId);
  pool.protocolRecovery=policy.previousProof;
  Object.assign(campaign.protocolValidation,{proofHash:policy.previousProof,runKey:policy.runKey});
  for(const {value:old} of f.batches) {
    const b=get(`batch:${f.plan.trialId}:${old.id}`);b.protocolRecovery=policy.previousProof;
    if(b.protocolResume)b.protocolResume.proofHash=policy.previousProof;
    if(policy.abandon.includes(b.id)) {
      b.protocolResume=null;
      b.pending.raw.steps.push({msgId:'FREE_GAME',requestPayload:'MSGID=FREE_GAME&PID=fixture',
        responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',sourceRejected:true,
        responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
    }
  }
  f.holds[0].value=gameId===32739?{active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',trialId:f.plan.trialId,batchId:4,cooldownUntil:0}}:
    {active:false,reason:null,sessionRecoveryId:sessionPolicy(32739).id};
  f.docs.set('state/global-hold',{_id:policy.group+'/global-hold',version:1,value:structuredClone(f.holds[gameId===32739?0:1].value)});
  const snapshots=()=>({campaign:f.docs.get('state/campaign'),pool:f.docs.get('state/pool:'+f.plan.trialId),
    batches:f.batches.map(x=>f.docs.get(`state/batch:${f.plan.trialId}:${x.value.id}`))});
  const s=snapshots(),profile={schema:'sg-session-incident-v1',id:policy.id,group:policy.group,gameId,createdAt:f.now,
    planHash:hash(f.plan),campaignHash:hash(campaign),poolHash:hash(pool),complete:policy.complete,pending:policy.pending,
    abandon:policy.abandon,previousCommit:f.commit,previousSnapshotHash:hash(previous),
    primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),
    batches:s.batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const request=f.operator.transport.request.bind(f.operator.transport);
  f.operator.transport.request=async(op,r)=>{
    if(op==='global_holds') {
      const result=structuredClone(f.holds);result[gameId===32739?0:1].value=structuredClone(get('global-hold'));return result;
    }
    if(op==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold'))
      assert(f.docs.has('journal/session-incident:'+policy.id+':backup-complete'),'PRIVATE_BACKUP_REQUIRED');
    return request(op,r);
  };
  const originalOperator=f.operator;
  f.operator=new SessionRecovery({...originalOperator,profile,commit:'e'.repeat(40)});
  f.events.length=0;
  return {...f,profile,previous,snapshots,get};
}

test('exact session review discards only two proven invalid FREE_GAME attempts and preserves the rest',async()=>{
  const f=await fixture();
  assert.deepEqual(reviewSessionIncident({profile:f.profile,plan:f.plan,snapshot:f.snapshots(),previous:f.previous,now:f.now}),
    {complete:164,pending:6,abandoned:2,preserved:4});
  const before=structuredClone(f.snapshots());const result=await f.operator.recover();
  assert.equal(result.count,164);assert.equal(result.abandonedAttempts,2);assert.equal(result.sourceRequests,0);
  assert.equal(f.get('global-hold').active,false);assert.equal(f.rounds.size,164);
  for(const {value:b} of before.batches){
    const after=f.get(`batch:${f.plan.trialId}:${b.id}`);
    if([2,4].includes(b.id)) {
      assert.equal(after.pending,null);
      assert.deepEqual(f.docs.get(`journal/${f.operator.prefix}:abandoned:${b.id}`).value.pending,b.pending);
    } else assert.deepEqual(after.pending,b.pending);
    assert.equal(after.sessionHash,b.sessionHash);assert.equal(after.checkpoint,b.checkpoint);
  }
  assert.equal(f.get('campaign').protocolValidation.runKey,null);
  assert.equal(f.get('campaign').protocolValidation.commit,'e'.repeat(40));
  await assert.rejects(f.operator.recover());
});

test('unknown source outcomes, changed rejection type and extra loss of original pending are not session recovery',async()=>{
  for(const mode of ['awaiting','permission','xml','bet','new-pending','missing-marker','lease','expired','records','oldbackup']) {
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:2`);
    if(mode==='awaiting')b.pending.awaiting='MSGID=BET';
    if(mode==='permission')b.pending.raw.steps.at(-1).responsePayload='&MSGID=ERROR&EID=FORBIDDEN&';
    if(mode==='xml')b.pending.raw.steps.at(-1).responseXml='<GDMRESPONSE><SUCCESS>false</SUCCESS></GDMRESPONSE>';
    if(mode==='bet')b.pending.raw.steps.at(-1).msgId='BET';
    if(mode==='new-pending')f.get(`batch:${f.plan.trialId}:5`).pending.attempt='replaced';
    if(mode==='missing-marker')f.get(`batch:${f.plan.trialId}:5`).protocolResume=null;
    if(mode==='lease')b.leaseUntil=f.now+10;
    if(mode==='expired')f.profile.createdAt=f.now-2*60*60000;
    if(mode==='records')f.rounds.values().next().value.contentHash='changed';
    if(mode==='oldbackup')f.previous.batches[0].value.pending.raw.startBalanceRaw++;
    // Even updating local anchors must not defeat the semantic boundary.
    f.profile.batches=f.snapshots().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}));
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});

test('a different hold, another GitHub run or a stopped secondary prevents any mutation',async()=>{
  for(const mode of ['hold','secondary','github']) {
    const f=await fixture();
    if(mode==='hold')f.get('global-hold').details.code='SOURCE_HTTP_REJECTED';
    if(mode==='secondary')f.holds[1].value.active=true;
    if(mode==='github')f.block();
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});

test('backup failure retains original attempts and global hold and refuses blind retry',async()=>{
  const f=await fixture(),request=f.operator.transport.request;
  f.operator.transport.request=async(op,r)=>{if(op==='create' && r.key.endsWith(':abandoned:4'))throw Error('BACKUP_FAILURE');return request(op,r);};
  await assert.rejects(f.operator.recover(),/BACKUP_FAILURE/);
  assert(f.get(`batch:${f.plan.trialId}:2`).pending);assert.equal(f.get('global-hold').active,true);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});

test('secondary rebinds the unopened original Foam attempt only after primary evidence review',async()=>{
  const f=await fixture(32836),original=structuredClone(f.get(`batch:${f.plan.trialId}:2`).pending);
  const r=await f.operator.recover();assert.equal(r.count,42);assert.equal(r.abandonedAttempts,0);
  assert.deepEqual(f.get(`batch:${f.plan.trialId}:2`).pending,original);
  assert.equal(f.get('global-hold').active,false);assert.equal(r.originalPendingPreserved,1);
  await assert.rejects(f.operator.formal());
});

async function finish(f) {
  const old=structuredClone(f.batches);
  // Existing fixture builds complete short results; changed attempts stay new.
  await finishShort(f);
  for(const id of sessionPolicy(f.plan.gameId).abandon){
    const b=old.find(x=>x.value.id===id).value,seq=b.journaled+1;
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,seq)).value;
    r.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(r._id,structuredClone(r));
  }
}

test('formal needs four original resumptions, two distinct replacements and actual Demon bonus settlement',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f);
  const r=await f.operator.validate();assert.equal(r.fullReadback,364);assert.equal(r.originalPendingSettled,4);
  assert.equal(r.replacementAttemptsSettled,2);assert.equal(r.liveNaturalFeatureSettlementVerified,true);
  assert.equal((await f.operator.formal()).validationLimit,0);
});

test('reusing an abandoned attempt or dropping the retained special branch cannot pass short validation',async()=>{
  for(const mode of ['attempt','time','bonus','prefix']) {
    const f=await fixture();await f.operator.recover();await finish(f);
    const seq=mode==='bonus'||mode==='prefix'?432:115,r=f.docs.get('journal/'+receiptKey(f.plan.trialId,seq)).value;
    if(mode==='attempt')r.attempt='original-2';
    if(mode==='time')r.raw.steps[0].ts=new Date(f.now-1).toISOString();
    if(mode==='bonus')r.bonus=0;
    if(mode==='prefix')r.raw.steps[0].responsePayload='changed';
    f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate());
  }
});

test('unchanged original Foam chain and full 242-round readback are still required',async()=>{
  const f=await fixture(32836);await f.operator.recover();await finish(f);
  const r=await f.operator.validate();assert.equal(r.fullReadback,242);assert.equal(r.originalPendingSettled,1);
  assert.equal(r.replacementAttemptsSettled,0);assert.equal((await f.operator.formal()).validationLimit,0);
});

test('session profiles pin all reviewed code and workflow without changing old applied profiles',()=>{
  for(const name of ['demon','quarterback']) {
    const p=JSON.parse(fs.readFileSync(`config/session-${name}-20260929.json`,'utf8'));
    const files=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
    assert.deepEqual(files,p.adapterFiles);assert.equal(hash(files),p.adapterHash);
  }
});
