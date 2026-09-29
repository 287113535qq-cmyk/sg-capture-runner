import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fixture as baseFixture} from './demon-pending-session-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {DemonThreeRecovery,DEMON_THREE as K} from './demon-three-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
const out=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample;print(json.dumps(sample()))"],{encoding:'utf8'});
assert.equal(out.status,0,out.stderr);const special=JSON.parse(out.stdout);
async function fixture(){
  const f=await baseFixture();const result=await f.operator.recover();
  const oldOp=f.operator,get=f.get,put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
  const prefix=K.oldPrefix,prior=structuredClone(f.docs.get('journal/'+prefix+':before').value);
  put('journal',prefix+':proof',{proofHash:K.previousProof});
  const archive=f.docs.get('journal/'+prefix+':abandoned:9').value;archive.proofHash=K.previousProof;
  const reconciled=f.docs.get('journal/'+prefix+':reconciled').value;reconciled.proofHash=K.previousProof;
  const stage=structuredClone(f.docs.get('journal/pending-first:'+result.proofHash).value);
  stage.proofHash=K.previousProof;stage.commit=K.previousCommit;
  put('journal','pending-first:'+K.previousProof,stage);
  const p=get('pool:'+f.plan.trialId),c=get('campaign');p.protocolRecovery=K.previousProof;
  Object.assign(c.protocolValidation,{proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey,pendingFirst:hash(stage)});
  for(const {value:b} of f.snapshot().batches){
    b.protocolRecovery=K.previousProof;if(b.protocolResume)b.protocolResume.proofHash=K.previousProof;
    if(b.id===9)b.abandonedAttemptProof=K.previousProof;
  }
  const b=get(`batch:${f.plan.trialId}:5`);b.protocolResume=null;
  b.pending.raw.steps.push({msgId:'FREE_GAME',sourceRejected:true,requestPayload:b.pending.raw.steps.at(-1).requestPayload,
    responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
  f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:5,trialId:f.plan.trialId,cooldownUntil:0}};put('state','global-hold',f.holds[0].value);
  const records=f.snapshot().batches.flatMap(({value:b})=>Array.from({length:b.journaled-b.start+1},(_,i)=>f.docs.get('journal/'+receiptKey(f.plan.trialId,b.start+i)).value));
  const profile={schema:'sg-demon-three-v1',id:K.id,group:'primary',gameId:32739,complete:246,checkpoint:246,pending:4,createdAt:f.now,
    planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),priorHash:hash(prior),primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),
    recordsHash:hash(records),archive806Hash:hash(archive),previousReconciledHash:hash(reconciled),previousStageHash:hash(stage),
    batches:f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const request=oldOp.transport.request.bind(oldOp.transport);
  oldOp.transport.request=async(type,r)=>{
    if((type==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold')) || type==='rounds_insert')assert(f.docs.has('journal/demon-three:'+K.id+':backup-complete'));
    return request(type,r);
  };
  f.operator=new DemonThreeRecovery({...oldOp,profile,commit:'b'.repeat(40)});f.profile=profile;f.events.length=0;return f;
}
test('three-owner profile binds the current exact runtime and finite functional evidence gate',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-three-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
  assert.deepEqual(p.pendingFirst.resumeWorkers,[1,2,7]);assert.equal(p.featureValidation.requireNewNaturalBonus,2);
  assert.equal(p.featureValidation.allowFormalWithoutEvidence,false);
});
test('archive only434 after full246 backup, preserve three originals and older806 archive, no source work',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),old=structuredClone(f.docs.get('journal/'+K.oldPrefix+':abandoned:9'));
  const r=await f.operator.recover();assert.equal(r.count,246);assert.equal(r.flushed,0);assert.equal(r.sourceRequests,0);
  for(const {value:b} of before.batches)assert.deepEqual(f.get(`batch:${f.plan.trialId}:${b.id}`).pending,b.id===5?null:b.pending);
  assert.deepEqual(f.docs.get('journal/'+K.oldPrefix+':abandoned:9'),old);
  assert.deepEqual(f.docs.get('journal/pending-first:'+r.proofHash).value.entries.map(x=>x.worker).sort((a,b)=>a-b),[1,2,7]);
  assert.equal(f.rounds.size,246);await assert.rejects(f.operator.recover());
});
test('altered explicit refusal, unknown normal original, lease, old archive or prior stage refuses before mutation',async()=>{
  for(const mode of ['xml','request','prefix','unknown','lease','archive','stage','oldRecord','hold']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:5`);
    if(mode==='xml')b.pending.raw.steps.at(-1).responseXml='<GDMRESPONSE/>';
    if(mode==='request')b.pending.raw.steps.at(-1).requestPayload+='changed';
    if(mode==='prefix')b.pending.raw.steps[0].responsePayload+='changed';
    if(mode==='unknown')f.get(`batch:${f.plan.trialId}:2`).pending.awaiting='unknown';
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='archive')f.docs.get('journal/'+K.oldPrefix+':abandoned:9').value.disposition='changed';
    if(mode==='stage')f.docs.get('journal/pending-first:'+K.previousProof).value.entries.pop();
    if(mode==='oldRecord')f.rounds.values().next().value.contentHash='changed';
    if(mode==='hold')f.holds[1].value.active=true;
    f.profile.batches=f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}));
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});
test('partial backup never changes the four original pending and cannot be blindly repeated',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),create=f.operator.store.create.bind(f.operator.store);
  f.operator.store.create=async(c,k,...args)=>{if(k===f.operator.prefix+':records:10')throw Error('BACKUP_INTERRUPTED');return create(c,k,...args);};
  await assert.rejects(f.operator.recover(),/BACKUP_INTERRUPTED/);assert.deepEqual(f.snapshot(),before);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});
async function finish(f,{feature=true}={}){
  const before=structuredClone(f.snapshot());f.get('campaign').protocolValidation.runKey='capture-run:333:1';
  delete f.get('pool:'+f.plan.trialId).workers[18];await finishShort(f);
  for(const {value:b} of before.batches){if(!b.pending)continue;
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,b.pending.sequence)).value;
    r.raw=structuredClone(special);r.bonus=2;
    if(!feature){r.raw.steps=[...structuredClone(b.pending.raw.steps),structuredClone(special.steps.at(-1))];
      const last=r.raw.steps.at(-1);last.responsePayload=last.responsePayload.replace('FID=1|0|','FID=0|');last.responseXml=last.responseXml.replace('FID=1|0|','FID=0|');r.bonus=1;}
    f.rounds.set(r._id,structuredClone(r));
  }
  for(const sequence of [434,806]){const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,sequence)).value;r.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(r._id,structuredClone(r));}
}
test('446 with two independent replacements still refuses formal without true new natural bonus2',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f,{feature:false});
  await assert.rejects(f.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);await assert.rejects(f.operator.formal());
});
test('446 full verified with three original continuations, both independent replacements and bonus2 evidence accepts',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f);const v=await f.operator.validate();
  assert.equal(v.originalPendingSettled,3);assert.equal(v.replacementAttemptsSettled,2);assert.equal(v.fullReadback,446);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('old806 replay, old434 replay or mutation of a preserved original cannot pass validation',async()=>{
  for(const sequence of [806,434,117]){
    const f=await fixture();await f.operator.recover();await finish(f);const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,sequence)).value;
    if(sequence===806)r.attempt=f.docs.get('journal/'+K.oldPrefix+':abandoned:9').value.pending.attempt;
    else if(sequence===434)r.attempt=f.docs.get('journal/'+f.operator.prefix+':abandoned:5').value.pending.attempt;
    else r.raw.steps[0].responsePayload+='changed';
    f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate());
  }
});
