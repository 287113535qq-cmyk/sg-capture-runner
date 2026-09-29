import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fixture as baseFixture} from './demon-rebind-recovery.test.mjs';
import {finishShort} from './session-test-fixture.mjs';
import {DemonFeatureSessionRecovery,DEMON_FEATURE_SESSION as K} from './demon-feature-session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
const out=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample;print(json.dumps(sample()))"],{encoding:'utf8'});
assert.equal(out.status,0,out.stderr);const special=JSON.parse(out.stdout);
const featureValidation={shortPerWorker:10,newComplete:200,requireNewNaturalBonus:2,allowFormalWithoutEvidence:false,allowUnboundedProbe:false};

async function fixture(){
  const f=await baseFixture(),put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)}),get=f.get;
  const p=get('pool:'+f.plan.trialId),c=get('campaign'),old=structuredClone(f.batches);
  put('journal',K.oldPrefix+':before',{batches:old});put('journal',K.oldPrefix+':proof',{proofHash:K.previousProof});
  put('journal','demon-rebind:demon-unstarted-terminal-20260929:backup-complete',{});
  for(const {value:b} of old){
    const records=[...f.docs].filter(([k,d])=>k.startsWith('journal/receipt:') && d.value.batchId===b.id).map(([,d])=>d.value);
    put('journal',`${K.oldPrefix}:records:${b.id}`,{records});
    const v=get(`batch:${f.plan.trialId}:${b.id}`);if(v.pending)v.protocolResume.proofHash=K.previousProof;
  }
  const archived={proofHash:K.previousProof,worker:3,sessionHash:old[0].value.sessionHash,disposition:'source-invalid-session/abandon_without_replay',pending:old[0].value.pending};
  put('journal',K.oldPrefix+':abandoned:1',archived);get(`batch:${f.plan.trialId}:1`).pending=null;get(`batch:${f.plan.trialId}:1`).protocolResume=null;
  for(const [id,worker] of [[16,4],[17,5]]){
    const start=(id-1)*100+1,b={id,worker,start,end:start+99,sessionHash:String(worker).padStart(64,'0'),owner:null,epoch:3,leaseUntil:0,journaled:start-1,checkpoint:start-1,pending:null,failure:null};
    put('state',`batch:${f.plan.trialId}:${id}`,b);f.batches.push(f.docs.get('state/'+`batch:${f.plan.trialId}:${id}`));
    Object.assign(p.workers[worker],{activeBatch:{id,worker,start,end:b.end}});
  }
  for(const id of [7,8])p.workers[id]={sessionHash:String(id).padStart(64,'0'),leaseUntil:0,owner:null};
  for(const [id,n] of [[1,10],[15,10],[16,10],[17,1]]){
    const b=get(`batch:${f.plan.trialId}:${id}`);
    for(let i=0;i<n;i++){
      const sequence=++b.journaled,r={_id:hash({fixture:sequence}),contentHash:hash({sequence}),trialId:f.plan.trialId,sequence,batchId:id,shardId:b.worker,sourceSessionHash:b.sessionHash,fixtureOnly:false,buy:0,bonus:0,attempt:'new-'+sequence,raw:{steps:[{msgId:'BET',ts:new Date(f.now-1000).toISOString()}]}};
      put('journal',receiptKey(f.plan.trialId,sequence),r);if(id!==17)f.rounds.set(r._id,structuredClone(r));
    }
    if(id!==17)b.checkpoint=b.journaled;
  }
  const rejected=get(`batch:${f.plan.trialId}:5`);rejected.protocolResume=null;
  rejected.pending.raw.steps.push({msgId:'FREE_GAME',sourceRejected:true,requestPayload:rejected.pending.raw.steps.at(-1).requestPayload,
    responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
  Object.assign(p,{protocolRecovery:K.previousProof,nextBatchId:18,nextSequence:1701});
  Object.assign(c.protocolValidation,{proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey});
  f.holds[0].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:5,trialId:f.plan.trialId,cooldownUntil:0}};put('state','global-hold',f.holds[0].value);
  const snapshot=()=>({campaign:f.docs.get('state/campaign'),pool:f.docs.get('state/pool:'+f.plan.trialId),batches:Array.from({length:p.nextBatchId-1},(_,i)=>f.docs.get(`state/batch:${f.plan.trialId}:${i+1}`))});
  const records=[...f.docs].filter(([key])=>key.startsWith('journal/receipt:')).map(([,d])=>d.value).sort((a,b)=>a.sequence-b.sequence);
  const profile={schema:'sg-demon-feature-session-v1',id:K.id,group:'primary',gameId:32739,complete:195,checkpoint:194,pending:3,createdAt:f.now,
    planHash:hash(f.plan),campaignHash:hash(c),poolHash:hash(p),priorHash:hash({batches:old}),featureValidation,
    primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),recordsHash:hash(records),archive9Hash:hash(archived),replacement9Hash:hash(records.find(x=>x.sequence===9)),
    batches:snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const op=f.operator,request=op.transport.request.bind(op.transport);
  op.transport.request=async(type,r)=>{
    if(type==='global_holds'){const h=structuredClone(f.holds);h[0].value=structuredClone(get('global-hold'));return h;}
    if((type==='cas' && (r.key.startsWith('batch:') || r.key==='global-hold')) || type==='rounds_insert')assert(f.docs.has('journal/demon-feature-session:'+K.id+':backup-complete'));
    return request(type,r);
  };
  f.operator=new DemonFeatureSessionRecovery({...op,profile,commit:'f'.repeat(40)});f.profile=profile;f.snapshot=snapshot;f.events.length=0;return f;
}
test('new feature-session profile pins current implementation and fixed bounded evidence requirement',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-feature-session-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);assert.deepEqual(p.featureValidation,featureValidation);
});
test('backup195, flush1 and archive only rejected432, preserving806/902 and settled replacement9',async()=>{
  const f=await fixture(),before=structuredClone(f.snapshot()),r=await f.operator.recover();
  assert.equal(r.count,195);assert.equal(r.committed,195);assert.equal(r.flushed,1);assert.equal(f.rounds.size,195);assert.equal(r.originalPendingPreserved,2);
  for(const {value:b} of before.batches){const after=f.get(`batch:${f.plan.trialId}:${b.id}`);
    if(b.id===5)assert.equal(after.pending,null);else assert.deepEqual(after.pending,b.pending);assert.equal(after.checkpoint,b.journaled);}
  const grant=f.docs.get('journal/protocol-resume:'+r.proofHash).value;assert.equal(grant.batches.length,2);assert.equal(f.get('global-hold').active,false);
  assert(f.events.indexOf('journal/'+f.operator.prefix+':backup-complete')<f.events.indexOf('rounds-write'));
  await assert.rejects(f.operator.recover());
});
test('reject unseen rejection, altered XML/request/prefix, unknown, leases, other hold and drift without mutation',async()=>{
  for(const mode of ['other','xml','request','prefix','unknown','lease','hold','secondary','busy','expired','record','archive']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:5`);
    if(mode==='other')f.get(`batch:${f.plan.trialId}:9`).pending.raw.steps.push({sourceRejected:true});
    if(mode==='xml')b.pending.raw.steps.at(-1).responseXml='<bad/>';
    if(mode==='request')b.pending.raw.steps.at(-1).requestPayload+='&PID=other';
    if(mode==='prefix')b.pending.raw.steps[0].responsePayload+='changed';
    if(mode==='unknown')b.pending.awaiting={MSGID:'FREE_GAME'};
    if(mode==='lease')b.leaseUntil=f.now+1;if(mode==='hold')f.get('global-hold').details.batchId=9;
    if(mode==='secondary')f.holds[1].value.active=true;if(mode==='busy')f.block();if(mode==='expired')f.profile.createdAt=f.now-7200000;
    if(mode==='record')f.docs.get('journal/'+receiptKey(f.plan.trialId,9)).value.attempt='original-1';
    if(mode==='archive')f.docs.get('journal/'+K.oldPrefix+':abandoned:1').value.disposition='other';
    f.profile.batches=f.snapshot().batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}));
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);
  }
});
test('partial private backup prevents flushing, discard and hold clearing; no blind retry',async()=>{
  const f=await fixture(),request=f.operator.transport.request;
  f.operator.transport.request=async(op,r)=>{if(op==='create' && r.key.endsWith(':abandoned:5'))throw Error('BACKUP_FAILED');return request(op,r);};
  await assert.rejects(f.operator.recover(),/BACKUP_FAILED/);assert.equal(f.rounds.size,194);assert(f.get(`batch:${f.plan.trialId}:5`).pending);assert(f.get('global-hold').active);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});
async function finish(f,{feature=true}={}){
  const p=f.get('pool:'+f.plan.trialId);for(const [id,w] of Object.entries(p.workers))if(!w.activeBatch)delete p.workers[id];
  await finishShort(f);
  const replacement=f.docs.get('journal/'+receiptKey(f.plan.trialId,432)).value;
  replacement.raw.steps[0].ts=new Date(f.now+1000).toISOString();f.rounds.set(replacement._id,structuredClone(replacement));
  if(feature){const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,433)).value;r.raw=structuredClone(special);r.bonus=2;f.rounds.set(r._id,structuredClone(r));}
}
test('395 complete and two old continuations are insufficient without a newly settled natural Demon feature',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f,{feature:false});await assert.rejects(f.operator.validate(),/LIVE_DEMON_FEATURE_EVIDENCE_REQUIRED/);
  assert(!f.docs.has('journal/'+f.operator.prefix+':validation'));await assert.rejects(f.operator.formal());assert.equal(f.get('campaign').validationLimit,10);
});
test('395 full, distinct432 replacement, two original continuations and new independent bonus2 allow formal',async()=>{
  const f=await fixture();await f.operator.recover();await finish(f);const v=await f.operator.validate();
  assert.equal(v.fullReadback,395);assert.equal(v.originalPendingSettled,2);assert.equal(v.oldRejectedPendingSettled,0);assert.equal(v.liveDemonFeature.sequence,433);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('reject replayed432, stale replacement, altered original806, fake bonus2 and unfinished feature',async()=>{
  for(const mode of ['attempt','time','prefix','fake','unfinished']){
    const f=await fixture();await f.operator.recover();await finish(f);
    const sequence=mode==='prefix'?806:['fake','unfinished'].includes(mode)?433:432,r=f.docs.get('journal/'+receiptKey(f.plan.trialId,sequence)).value;
    if(mode==='attempt')r.attempt='original-5';if(mode==='time')r.raw.steps[0].ts=new Date(f.now-1).toISOString();
    if(mode==='prefix')r.raw.steps[0].responsePayload+='changed';if(mode==='fake')r.raw={steps:[{msgId:'BET'}]};if(mode==='unfinished')r.raw.steps.pop();
    f.rounds.set(r._id,structuredClone(r));await assert.rejects(f.operator.validate());
  }
});
