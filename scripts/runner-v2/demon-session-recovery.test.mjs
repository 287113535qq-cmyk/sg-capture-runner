import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture as rebindFixture} from './demon-rebind-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {DemonSessionRecovery,DEMON_SESSION as K} from './demon-session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

async function fixture(){
  const f=await rebindFixture(),get=f.get,put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
  const c=get('campaign'),p=get('pool:'+f.plan.trialId);p.protocolRecovery=K.previousProof;
  Object.assign(c.protocolValidation,{proofHash:K.previousProof,runKey:K.runKey,commit:K.previousCommit});
  const previous={batches:structuredClone(f.batches)};
  put('journal',K.previousPrefix+':before',previous);put('journal',K.previousPrefix+':proof',{proofHash:K.previousProof});
  // The fake transport checks the previous operator's marker as well.
  put('journal',K.previousPrefix+':backup-complete',{});
  for(const {value:old} of f.batches){
    const b=get(`batch:${f.plan.trialId}:${old.id}`);b.protocolRecovery=K.previousProof;
    if(b.pending)b.protocolResume.proofHash=K.previousProof;
    const records=[...f.docs].filter(([key,d])=>key.startsWith('journal/receipt:') && d.value.batchId===b.id).map(([,d])=>d.value);
    put('journal',K.previousPrefix+':records:'+b.id,{records});
    if(b.id===1){b.protocolResume=null;b.pending.raw.steps.push({msgId:'FREE_GAME',requestPayload:b.pending.raw.steps.at(-1).requestPayload,
      sourceRejected:true,responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',
      responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});}
  }
  f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',trialId:f.plan.trialId,batchId:1,cooldownUntil:0}};
  put('state','global-hold',f.holds[0].value);
  const snapshot=()=>({campaign:f.docs.get('state/campaign'),pool:f.docs.get('state/pool:'+f.plan.trialId),batches:f.batches.map(({value:b})=>f.docs.get(`state/batch:${f.plan.trialId}:${b.id}`))});
  const profile={schema:'sg-demon-session-incident-v1',id:K.id,group:'primary',gameId:32739,createdAt:f.now,complete:164,pending:4,abandon:[1],
    previousCommit:K.previousCommit,previousSnapshotHash:hash(previous),planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),
    primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),batches:snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const oldop=f.operator,request=oldop.transport.request.bind(oldop.transport);
  oldop.transport.request=async(op,r)=>{
    if(op==='global_holds'){const h=structuredClone(f.holds);h[0].value=structuredClone(get('global-hold'));return h;}
    if(op==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold'))assert(f.docs.has('journal/demon-session:'+K.id+':backup-complete'));
    return request(op,r);
  };
  f.operator=new DemonSessionRecovery({...oldop,profile,commit:'e'.repeat(40)});f.profile=profile;f.snapshot=snapshot;f.events.length=0;return f;
}

test('applied Demon session profile remains frozen and rejects newer runtime',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-session-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.equal(hash(p),'7a11cc97db8574dc651112cb23c7646b811e44bb4cc4d21a6a7dd2b73ddaf879');assert.equal(hash(p.adapterFiles),p.adapterHash);assert.notEqual(hash(actual),p.adapterHash);
});
test('archive exactly rejected seq9; retain 164 records and three original continuations',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),r=await f.operator.recover();
  assert.equal(r.count,164);assert.equal(r.abandonedAttempts,1);assert.equal(r.originalPendingPreserved,3);assert.equal(r.sourceRequests,0);
  for(const {value:b} of before.batches){const after=f.get(`batch:${f.plan.trialId}:${b.id}`);
    if(b.id===1){assert.equal(after.pending,null);assert.deepEqual(f.docs.get('journal/'+f.operator.prefix+':abandoned:1').value.pending,b.pending);}
    else assert.deepEqual(after.pending,b.pending);
    assert.equal(after.sessionHash,b.sessionHash);
  }
  assert.equal(f.get('global-hold').active,false);assert.equal(f.rounds.size,164);
  await assert.rejects(f.operator.recover());
});
test('unrequested rejection, changed XML/PID/prefix, unknown, other hold and active runner fail before mutation',async()=>{
  for(const mode of ['other','xml','pid','prefix','awaiting','lease','hold','secondary','github','expired','records']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:1`);
    if(mode==='other')f.get(`batch:${f.plan.trialId}:5`).pending.raw.steps.push({sourceRejected:true});
    if(mode==='xml')b.pending.raw.steps.at(-1).responseXml='<GDMRESPONSE><SUCCESS>false</SUCCESS></GDMRESPONSE>';
    if(mode==='pid')b.pending.raw.steps.at(-1).requestPayload+='&PID=other';
    if(mode==='prefix')b.pending.raw.steps[0].responsePayload+='changed';
    if(mode==='awaiting')b.pending.awaiting={MSGID:'FREE_GAME'};
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='hold')f.get('global-hold').details.code='OTHER';
    if(mode==='secondary')f.holds[1].value.active=true;
    if(mode==='github')f.block();
    if(mode==='expired')f.profile.createdAt=f.now-7200000;
    if(mode==='records')f.rounds.values().next().value.contentHash='changed';
    f.profile.batches=f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}));
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});
test('partial backup cannot discard attempts or clear hold, and blind retry is refused',async()=>{
  const f=await fixture(),request=f.operator.transport.request;
  f.operator.transport.request=async(op,r)=>{if(op==='create' && r.key.endsWith(':abandoned:1'))throw Error('BACKUP_FAILED');return request(op,r);};
  await assert.rejects(f.operator.recover(),/BACKUP_FAILED/);assert(f.get(`batch:${f.plan.trialId}:1`).pending);assert(f.get('global-hold').active);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});
async function finish(f){
  const pool=f.get('pool:'+f.plan.trialId);for(const [id,w] of Object.entries(pool.workers))if(!w.activeBatch)delete pool.workers[id];
  await finishShort(f);
  const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,9)).value;r.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(r._id,structuredClone(r));
}
test('364 full records, distinct replacement and three original settlements including432 required for formal',async()=>{
  const f=await fixture();await f.operator.recover();await assert.rejects(f.operator.formal());await finish(f);
  const r=await f.operator.validate();assert.equal(r.fullReadback,364);assert.equal(r.originalPendingSettled,3);assert.equal(r.replacementAttemptsSettled,1);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('old attempt reuse, premature replacement, altered prefix or missing Demon bonus never validate',async()=>{
  for(const mode of ['attempt','time','prefix','bonus']){
    const f=await fixture();await f.operator.recover();await finish(f);
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,['prefix','bonus'].includes(mode)?432:9)).value;
    if(mode==='attempt')r.attempt='original-1';if(mode==='time')r.raw.steps[0].ts=new Date(f.now-1).toISOString();
    if(mode==='prefix')r.raw.steps[0].responsePayload+='changed';if(mode==='bonus')r.bonus=0;
    f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate());
  }
});
