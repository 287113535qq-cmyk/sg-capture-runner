import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {operatorFixture,finishShort} from './session-test-fixture.mjs';
import {FoamSessionRecovery,FOAM_SESSION as K,reviewFoamSession} from './foam-session-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';

test('new exact incident profile pins reviewed code without changing prior applied profiles',()=>{
  const p=JSON.parse(fs.readFileSync('config/foam-session-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
});

async function fixture(){
  const f=await operatorFixture(32836),put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'secondary/'+k,version:1,value:structuredClone(v)});
  f.docs.clear();f.rounds.clear();put('state','write-permits',{limit:1,slots:{}});
  put('journal','protocol:'+f.profile.id+':backup-complete',{});
  const counts=[30,12,9,4,10,10,7,15,0,10,5,2,3,1,0,0],committed=[30,12,9,4,10,10,3,15,0,10,0,0,0,0,0,0];
  const workers=[23,21,35,33,20,30,39,36,26,28,38,34,27,37,25,32];
  const original={sequence:113,attempt:'original-113',awaiting:null,raw:{startBalanceRaw:1000,steps:[{msgId:'BET',responsePayload:'FID=2|'}]}};
  const rejected=structuredClone(original);rejected.raw.steps.push({msgId:'FEATURE_START',sourceRejected:true,responsePayload:'&MSGID=ERROR&EID=ERROR_INVALID_SESSION&',responseXml:'<GDMRESPONSE><SUCCESS>true</SUCCESS><PAYLOAD>&amp;MSGID=ERROR&amp;EID=ERROR_INVALID_SESSION&amp;</PAYLOAD></GDMRESPONSE>'});
  f.pool={enabled:true,failure:null,planHash:hash(f.plan),protocolRecovery:K.previousProof,nextBatchId:17,nextSequence:1601,workers:{}};
  f.batches=counts.map((count,i)=>{
    const id=i+1,start=i*100+1,worker=workers[i],sessionHash=String(worker).padStart(64,'0');
    const b={id,start,end:start+99,worker,sessionHash,epoch:6,owner:'old',leaseUntil:0,journaled:start+count-1,checkpoint:start+committed[i]-1,failure:null,pending:id===2?rejected:null,protocolResume:null};
    f.pool.workers[worker]={owner:'old',epoch:6,sessionHash,leaseUntil:0,activeBatch:{id,start,end:b.end,worker},resumeSafe:false};
    for(let sequence=start;sequence<=b.journaled;sequence++){
      const foam=sequence===20,raw={steps:(foam?['BET','FEATURE_START','FEATURE_PICK','FEATURE_END']:['BET']).map(msgId=>({msgId}))};
      const r={_id:hash({sequence}),contentHash:hash(raw),sequence,attempt:'old-'+sequence,trialId:f.plan.trialId,batchId:id,shardId:worker,sourceSessionHash:sessionHash,fixtureOnly:false,buy:0,bonus:foam?2:0,raw,normalized:{money:{betRaw:25,totalWinRaw:foam?350:0}}};
      put('journal',receiptKey(f.plan.trialId,sequence),r);if(sequence<=b.checkpoint)f.rounds.set(r._id,structuredClone(r));
      if(foam)put('journal','terminal-incident:foam-end-36495948701:terminal-record',{record:r});
    }
    put('state',`batch:${f.plan.trialId}:${id}`,b);return f.docs.get('state/'+`batch:${f.plan.trialId}:${id}`);
  });
  f.campaign={enabled:true,reason:null,audit:null,activeGame:32836,validationLimit:10,games:[{game_id:32836,status:'active'}],protocolValidation:{phase:'short',proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey}};
  put('state','campaign',f.campaign);put('state','pool:'+f.plan.trialId,f.pool);
  const prior={batches:[{value:{...structuredClone(f.batches[1].value),pending:original}}]};
  put('journal','terminal-incident:foam-end-36495948701:before',prior);
  put('journal','terminal-incident:foam-end-36495948701:proof',{proofHash:K.previousProof});
  f.holds[0].value={active:false};f.holds[1].value={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'SOURCE_REJECTED',batchId:2,trialId:f.plan.trialId}};
  put('state','global-hold',f.holds[1].value);
  const foam=f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value;
  f.profile={schema:'sg-foam-session-incident-v1',id:K.id,group:'secondary',gameId:32836,complete:118,createdAt:f.now,planHash:hash(f.plan),campaignHash:hash(f.campaign),poolHash:hash(f.pool),priorHash:hash(prior),pendingHash:hash(rejected),foamRecordHash:hash(foam),primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),batches:f.batches.map(({value:b})=>({id:b.id,hash:hash(b)}))};
  const transport=f.operator.transport,request=transport.request.bind(transport),prefix='foam-session:'+K.id;
  transport.request=async(op,r)=>{
    if(op==='cas' && r.key.startsWith('batch:'))assert(f.docs.has('journal/'+prefix+':backup-complete'),'BACKUP_FIRST');
    const result=await request(op,r);if(op==='cas' && r.key==='global-hold')f.holds[1].value=structuredClone(r.value);return result;
  };
  f.operator=new FoamSessionRecovery({store:f.store,transport,gate:f.operator.gate,parser:f.operator.parser,plan:f.plan,profile:f.profile,githubIdle:f.operator.githubIdle,owner:'new-maintenance',commit:f.commit,now:()=>f.now,sleep:async()=>{}});
  f.get=k=>f.docs.get('state/'+k).value;return f;
}
async function short(f){
  await finishShort(f);const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,113)).value;
  r.raw.steps[0].ts=new Date(f.now+1).toISOString();f.rounds.set(r._id,structuredClone(r));
}
test('flushes fifteen valid records before archiving only explicit113, preserving all118 and source-free evidence',async()=>{
  const f=await fixture(),old=[...f.docs].filter(([k])=>k.startsWith('journal/receipt:'));
  const r=await f.operator.recover();assert.equal(r.count,118);assert.equal(r.committed,118);assert.equal(r.flushed,15);assert.equal(r.sourceRequests,0);
  assert.equal(f.get(`batch:${f.plan.trialId}:2`).pending,null);assert.equal(f.get('global-hold').active,false);
  for(const [k,v] of old)assert.deepEqual(f.docs.get(k),v);
  assert.equal(f.docs.get('journal/foam-session:'+K.id+':abandoned:2').value.pending.raw.steps.length,2);
  await assert.rejects(f.operator.recover());await assert.rejects(f.operator.formal());
});
test('rejects unknown, partial/other rejection, extra pending, altered prefix, active lease and code/run drift',async()=>{
  for(const mode of ['awaiting','xml','error','extra','prefix','lease','commit','run','prior']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:2`),q=b.pending;
    if(mode==='awaiting')q.awaiting={MSGID:'FEATURE_START'};
    if(mode==='xml')q.raw.steps[1].responseXml='<GDMRESPONSE><SUCCESS>false</SUCCESS><PAYLOAD>bad</PAYLOAD></GDMRESPONSE>';
    if(mode==='error')q.raw.steps[1].responsePayload='&MSGID=ERROR&EID=ANOTHER_ERROR&';
    if(mode==='extra')f.get(`batch:${f.plan.trialId}:3`).pending=structuredClone(q);
    if(mode==='prefix')q.raw.steps[0].responsePayload='changed';
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='commit')f.get('campaign').protocolValidation.commit='b'.repeat(40);
    if(mode==='run')f.get('campaign').protocolValidation.runKey='capture-run:1:2';
    if(mode==='prior')f.docs.get('journal/terminal-incident:foam-end-36495948701:before').value.batches=[];
    f.profile.batches=f.batches.map(x=>({id:x.value.id,hash:hash(f.get(`batch:${f.plan.trialId}:${x.value.id}`))}));
    f.profile.pendingHash=hash(q);f.profile.campaignHash=hash(f.get('campaign'));
    await assert.rejects(f.operator.recover());assert.equal(f.get('global-hold').active,true);
  }
});
test('private backup failure never clears pending or hold and refuses blind rerun',async()=>{
  const f=await fixture(),create=f.store.create.bind(f.store);f.store.create=async(c,k,v,o)=>{if(k.endsWith(':backup-complete'))throw Error('BACKUP_FAILED');return create(c,k,v,o);};
  await assert.rejects(f.operator.recover(),/BACKUP_FAILED/);assert(f.get(`batch:${f.plan.trialId}:2`).pending);
  assert.equal(f.get('global-hold').active,true);await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});
test('conflicting Mongo or changed actual Foam evidence cannot authorize recovery',async()=>{
  for(const mode of ['mongo','foam','hold','busy']){
    const f=await fixture();if(mode==='mongo')f.rounds.values().next().value.contentHash='bad';
    if(mode==='foam')f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value.attempt='bad';
    if(mode==='hold')f.holds[0].value.active=true;if(mode==='busy')f.block();
    await assert.rejects(f.operator.recover());assert.equal(f.get('global-hold').active,true);
  }
});
test('requires318 full records, all20 workers, distinct replacement and immutable liveFoam before formal',async()=>{
  const f=await fixture();await f.operator.recover();await short(f);
  const r=await f.operator.validate();assert.equal(r.fullReadback,318);assert.equal(r.oldPendingSettled,0);assert.equal(r.replacementAttemptsSettled,1);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('replacement replay, evidence change and missing worker prevent validation',async()=>{
  for(const mode of ['attempt','time','foam','count']){
    const f=await fixture();await f.operator.recover();await short(f);
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,113)).value;
    if(mode==='attempt')r.attempt='original-113';if(mode==='time')r.raw.steps[0].ts=new Date(f.now-1).toISOString();
    f.rounds.set(r._id,structuredClone(r));
    if(mode==='foam')f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value.contentHash='bad';
    if(mode==='count')f.get(`batch:${f.plan.trialId}:2`).journaled--;
    await assert.rejects(f.operator.validate());await assert.rejects(f.operator.formal());
  }
});
