import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fixture as baseFixture} from './demon-feature-session-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {DemonPendingSessionRecovery,DEMON_PENDING_SESSION as K} from './demon-pending-session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
const out=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample;print(json.dumps(sample()))"],{encoding:'utf8'});
assert.equal(out.status,0,out.stderr);const special=JSON.parse(out.stdout);
async function fixture(){
  const f=await baseFixture();await f.operator.recover();
  const put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)}),get=f.get;
  const oldOp=f.operator,p=get('pool:'+f.plan.trialId),c=get('campaign'),old=structuredClone(f.snapshot());
  put('journal',K.oldPrefix+':proof',{proofHash:K.previousProof});
  put('journal',K.oldPrefix+':before',old);
  put('journal',K.oldPrefix+':reconciled',{at:f.now,proofHash:K.previousProof});
  const archive=f.docs.get('journal/'+K.oldPrefix+':abandoned:5').value;archive.proofHash=K.previousProof;
  for(const {value:b} of old.batches){
    const records=[...f.docs].filter(([key,d])=>key.startsWith('journal/receipt:') && d.value.batchId===b.id).map(([,d])=>d.value);
    put('journal',`${K.oldPrefix}:records:${b.id}`,{records});
  }
  for(const [id,worker] of [[18,7],[19,8]]){
    const start=(id-1)*100+1,b={id,worker,start,end:start+99,sessionHash:String(worker).padStart(64,'0'),owner:null,epoch:3,leaseUntil:0,journaled:start-1,checkpoint:start-1,pending:null,failure:null};
    put('state',`batch:${f.plan.trialId}:${id}`,b);p.workers[worker].activeBatch={id,worker,start,end:b.end};
  }
  p.workers[18]={sessionHash:String(18).padStart(64,'0'),leaseUntil:0,owner:null};
  for(const [id,n,written] of [[2,2,2],[5,2,0],[18,5,5],[1,10,10],[3,10,10],[4,10,3],[19,12,0]]){
    const b=get(`batch:${f.plan.trialId}:${id}`),before=b.journaled;
    for(let i=0;i<n;i++){
      const sequence=++b.journaled,r={_id:hash({fixture:sequence}),contentHash:hash({sequence}),trialId:f.plan.trialId,sequence,batchId:id,shardId:b.worker,sourceSessionHash:b.sessionHash,fixtureOnly:false,buy:0,bonus:0,attempt:'new-'+sequence,raw:{steps:[{msgId:'BET',ts:new Date(f.now+1000).toISOString()}]}};
      put('journal',receiptKey(f.plan.trialId,sequence),r);if(i<written)f.rounds.set(r._id,structuredClone(r));
    }
    b.checkpoint=before+written;
  }
  for(const [id,n] of [[2,1],[5,3],[18,1]]){
    const b=get(`batch:${f.plan.trialId}:${id}`);b.pending={sequence:b.journaled+1,attempt:'pending-new-'+id,awaiting:null,raw:{...structuredClone(special),steps:structuredClone(special.steps.slice(0,n))}};b.protocolResume=null;
  }
  get(`batch:${f.plan.trialId}:10`).protocolResume.proofHash=K.previousProof;
  const b=get(`batch:${f.plan.trialId}:9`);b.protocolResume=null;
  b.pending.raw.steps.push({msgId:'FREE_GAME',sourceRejected:true,requestPayload:b.pending.raw.steps.at(-1).requestPayload,
    responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
  Object.assign(p,{protocolRecovery:K.previousProof,nextBatchId:20,nextSequence:1901});
  Object.assign(c.protocolValidation,{proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey});
  f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:9,trialId:f.plan.trialId,cooldownUntil:0}};put('state','global-hold',f.holds[0].value);
  const snapshot=()=>({campaign:f.docs.get('state/campaign'),pool:f.docs.get('state/pool:'+f.plan.trialId),batches:Array.from({length:p.nextBatchId-1},(_,i)=>f.docs.get(`state/batch:${f.plan.trialId}:${i+1}`))});
  const records=[...f.docs].filter(([key])=>key.startsWith('journal/receipt:')).map(([,d])=>d.value).sort((a,b)=>a.sequence-b.sequence);
  const profile={schema:'sg-demon-pending-session-v1',id:K.id,group:'primary',gameId:32739,complete:246,checkpoint:225,pending:5,createdAt:f.now,
    planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),priorHash:hash(old),
    primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),recordsHash:hash(records),archive432Hash:hash(archive),replacement432Hash:hash(records.find(x=>x.sequence===432)),
    batches:snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const request=oldOp.transport.request.bind(oldOp.transport);
  oldOp.transport.request=async(type,r)=>{
    if((type==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold')) || type==='rounds_insert')assert(f.docs.has('journal/demon-pending-session:'+K.id+':backup-complete'));
    return request(type,r);
  };
  f.operator=new DemonPendingSessionRecovery({...oldOp,profile,commit:'a'.repeat(40)});f.profile=profile;f.snapshot=snapshot;f.events.length=0;return f;
}
test('pending-session profile binds new runtime, finite staged owners and live bonus2 requirement',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-pending-session-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
  assert.deepEqual(p.pendingFirst,{resumeWorkers:[0,1,2,7],captureWorkers:20,newBetsBeforeOriginalSettlement:false});
  assert.equal(p.featureValidation.requireNewNaturalBonus,2);assert.equal(p.featureValidation.allowFormalWithoutEvidence,false);
});
test('backup246, flush21 and archive only806; immutable staged plan preserves all four original attempts',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),r=await f.operator.recover();
  assert.equal(r.count,246);assert.equal(r.committed,246);assert.equal(r.oldPreserved,246);assert.equal(r.flushed,21);assert.equal(f.rounds.size,246);
  for(const {value:b} of before.batches){const after=f.get(`batch:${f.plan.trialId}:${b.id}`);assert.equal(after.checkpoint,b.journaled);
    if(b.id===9)assert.equal(after.pending,null);else assert.deepEqual(after.pending,b.pending);}
  const c=f.get('campaign'),spec=f.docs.get('journal/pending-first:'+r.proofHash).value;
  assert.equal(c.protocolValidation.pendingFirst,hash(spec));assert.equal(c.protocolValidation.runKey,null);
  assert.deepEqual(spec.entries.map(e=>e.worker).sort((a,b)=>a-b),[0,1,2,7]);
  assert.equal(Object.values(spec.baseline).reduce((a,b)=>a+b,0),246);
  assert.equal(f.get('global-hold').active,false);assert.equal(r.sourceRequests,0);
  await assert.rejects(f.operator.recover());
});
test('changed rejection XML/prefix/request, normal pending rejection, active leases, unknown and other hold reject before mutation',async()=>{
  for(const mode of ['xml','prefix','request','otherReject','lease','unknown','hold','records']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:9`);
    if(mode==='xml')b.pending.raw.steps.at(-1).responseXml='<GDMRESPONSE/>';
    if(mode==='prefix')b.pending.raw.steps[0].responsePayload+='changed';
    if(mode==='request')b.pending.raw.steps.at(-1).requestPayload+='changed';
    if(mode==='otherReject')f.get(`batch:${f.plan.trialId}:5`).pending.raw.steps[0].sourceRejected=true;
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='unknown')f.get(`batch:${f.plan.trialId}:18`).pending.awaiting='unknown';
    if(mode==='hold')f.holds[1].value.active=true;
    if(mode==='records')f.rounds.values().next().value.contentHash='changed';
    f.profile.batches=f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}));
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});
test('interrupted full backup leaves all original pending and records untouched; rerun refuses',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),create=f.operator.store.create.bind(f.operator.store);
  f.operator.store.create=async(c,k,...args)=>{if(k===f.operator.prefix+':records:10')throw Error('BACKUP_INTERRUPTED');return create(c,k,...args);};
  await assert.rejects(f.operator.recover(),/BACKUP_INTERRUPTED/);
  assert.deepEqual(f.snapshot(),before);assert.equal(f.rounds.size,225);assert(f.get('global-hold').active);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});
async function finish(f,{feature=true}={}){
  const before=structuredClone(f.snapshot());f.get('campaign').protocolValidation.runKey='capture-run:222:1';
  delete f.get('pool:'+f.plan.trialId).workers[18];
  await finishShort(f);
  for(const {value:b} of before.batches){
    if(!b.pending)continue;const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,b.pending.sequence)).value;
    // Synthetic complete protocol with the exact original prefix, checked by
    // the real independent Runner in the stage verifier.
    r.raw=structuredClone(special);r.bonus=2;f.rounds.set(r._id,structuredClone(r));
  }
  const replacement=f.docs.get('journal/'+receiptKey(f.plan.trialId,806)).value;
  replacement.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(replacement._id,structuredClone(replacement));
  if(!feature){
    // Keep all originals genuinely settled but ordinary FID0, rather than
    // removing the special evidence gate from validation.
    for(const {value:b} of before.batches){if(!b.pending)continue;
      const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,b.pending.sequence)).value;
      r.raw.steps=[...structuredClone(b.pending.raw.steps),structuredClone(special.steps.at(-1))];
      const last=r.raw.steps.at(-1);last.responsePayload=last.responsePayload.replace('FID=1|0|','FID=0|');
      last.responseXml=last.responseXml.replace('FID=1|0|','FID=0|');r.bonus=1;f.rounds.set(r._id,structuredClone(r));
    }
  }
}
test('446 full records, original continuations and distinct806 replacement still require new natural bonus2',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f,{feature:false});
  await assert.rejects(f.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);await assert.rejects(f.operator.formal());
});
test('446 full with four original settlements, independent806 and genuine bounded feature evidence permits formal',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f);const v=await f.operator.validate();
  assert.equal(v.fullReadback,446);assert.equal(v.oldPreserved,246);assert.equal(v.originalPendingSettled,4);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('staged evidence mutation, replayed806 and altered original434 prevent final validation',async()=>{
  for(const mode of ['spec','replay','prefix']){
    const f=await fixture();const r=await f.operator.recover();await finish(f);
    if(mode==='spec')f.docs.get('journal/pending-first:'+r.proofHash).value.baseline[0]++;
    else{const row=f.docs.get('journal/'+receiptKey(f.plan.trialId,mode==='replay'?806:434)).value;
      if(mode==='replay')row.attempt='original-9';else row.raw.steps[0].responsePayload+='changed';f.rounds.set(row._id,structuredClone(row));}
    await assert.rejects(f.operator.validate());
  }
});
