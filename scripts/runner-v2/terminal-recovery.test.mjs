import test from 'node:test';
import assert from 'node:assert/strict';
import {operatorFixture,finishShort} from './session-test-fixture.mjs';
import {TerminalRecovery,terminalPolicy,reviewTerminalIncident} from './terminal-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {protocolGrant} from './protocol-recovery-core.mjs';
import {receiptKey} from './durable-queue.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

test('terminal incident profiles bind all reviewed runtime and workflow files',()=>{
  for(const name of ['demon','quarterback']){
    const p=JSON.parse(fs.readFileSync(`config/terminal-${name}-20260929.json`,'utf8'));
    const files=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,
      createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
    assert.deepEqual(files,p.adapterFiles);assert.equal(hash(files),p.adapterHash);
  }
});

async function fixture(gameId=32836){
  const f=await operatorFixture(gameId),policy=terminalPolicy(gameId),group=policy.group;
  const put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:group+'/'+k,version:1,value:structuredClone(v)});
  f.docs.clear();f.rounds.clear();put('state','write-permits',{limit:1,slots:{}});
  // The shared fake transport also enforces the older fixture backup barrier.
  put('journal','protocol:'+f.profile.id+':backup-complete',{});
  const counts=gameId===32836?[19,12,9,4,10,10,3,5,0]:[8,14,12,32,31,36,9,12,5,1,2,1,1,0,0];
  const committed=gameId===32836?[17,12,9,4,10,10,0,0,0]:counts;
  const workers=gameId===32836?[23,21,35,33,20,30,39,36,26]:[3,1,14,6,0,17,16,19,13,2,15,12,11,9,10];
  const pendingIds=gameId===32836?[1,2]:[1,5,9,10];
  f.pool={enabled:true,failure:null,planHash:hash(f.plan),protocolRecovery:policy.previousProof,
    nextBatchId:counts.length+1,nextSequence:counts.length*100+1,workers:{}};
  f.batches=counts.map((count,i)=>{
    const id=i+1,start=i*100+1,worker=workers[i],sessionHash=String(worker).padStart(64,'0');
    const terminal=gameId===32836 && id===1;
    const pending=pendingIds.includes(id)?{sequence:start+count,attempt:'original-'+id,awaiting:null,
      raw:{startBalanceRaw:10000,steps:(terminal?['BET','FEATURE_START','FEATURE_PICK','FEATURE_END']:['BET']).map(msgId=>({msgId,responsePayload:msgId}))}}:null;
    const b={id,start,end:start+99,worker,sessionHash,epoch:4,owner:'old',leaseUntil:0,journaled:start+count-1,checkpoint:start+committed[i]-1,
      failure:terminal?'RESPONSE_VALIDATION_REQUIRES_REVIEW':null,pending,protocolResume:pending&&!terminal?{proofHash:policy.previousProof,pendingHash:hash(pending)}:null};
    f.pool.workers[worker]={owner:'old',epoch:4,sessionHash,leaseUntil:0,activeBatch:{id,start,end:b.end,worker},resumeSafe:false};
    for(let seq=start;seq<=b.journaled;seq++){
      const r={_id:hash({seq}),sequence:seq,attempt:'old-'+seq,trialId:f.plan.trialId,batchId:id,shardId:worker,sourceSessionHash:sessionHash,
        fixtureOnly:false,buy:0,bonus:0,raw:{steps:[{msgId:'BET'}]},contentHash:hash({seq})};
      put('journal',receiptKey(f.plan.trialId,seq),r);if(seq<=b.checkpoint)f.rounds.set(r._id,structuredClone(r));
    }
    put('state',`batch:${f.plan.trialId}:${id}`,b);return f.docs.get('state/'+`batch:${f.plan.trialId}:${id}`);
  });
  f.campaign={enabled:true,reason:null,audit:null,activeGame:gameId,validationLimit:10,games:[{game_id:gameId,status:'active'}],
    protocolValidation:{phase:'short',proofHash:policy.previousProof,commit:'a'.repeat(40),runKey:policy.runKey}};
  put('state','campaign',f.campaign);put('state','pool:'+f.plan.trialId,f.pool);
  const grant=protocolGrant({plan:f.plan,batches:f.batches.filter(x=>x.value.id!==policy.terminalBatch),proofHash:policy.previousProof,commit:'a'.repeat(40),now:f.now});
  put('journal','protocol-resume:'+policy.previousProof,grant);
  f.holds[0].value={active:false};f.holds[1].value=gameId===32836?{active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',
    details:{code:'FOAM_MISSING_END_COUNTERS',trialId:f.plan.trialId,batchId:1}}:{active:false,terminalRecoveryId:terminalPolicy(32836).id};
  put('state','global-hold',f.holds[gameId===32836?1:0].value);
  f.profile={schema:'sg-terminal-incident-v1',id:policy.id,group,gameId,createdAt:f.now,complete:policy.count,planHash:hash(f.plan),
    campaignHash:hash(f.campaign),poolHash:hash(f.pool),previousCommit:'a'.repeat(40),previousGrantHash:hash(grant),
    primaryHoldHash:hash(f.holds[0].value),secondaryHoldHash:hash(f.holds[1].value),
    terminalRawHash:gameId===32836?hash(f.batches[0].value.pending.raw):null,
    batches:f.batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  const transport=f.operator.transport,request=transport.request.bind(transport),prefix='terminal-incident:'+policy.id;
  transport.request=async(op,r)=>{
    if(op==='cas' && r.key.startsWith('batch:'))assert(f.docs.has('journal/'+prefix+':backup-complete'),'BACKUP_FIRST');
    const result=await request(op,r);
    if(op==='cas' && r.key==='global-hold')f.holds[gameId===32836?1:0].value=structuredClone(r.value);
    return result;
  };
  const normalize=()=>({money:{betRaw:25,totalWinRaw:350},bonus:2});
  const parser={async call(r){
    if(r.op==='next')return r.raw.steps.length===4?null:gameId===32836?{MSGID:'FEATURE_START',CFG:'2'}:{MSGID:'FREE_GAME'};
    if(r.op==='record')return {_id:hash({sequence:r.sequence}),trialId:f.plan.trialId,sequence:r.sequence,attempt:r.attempt,
      batchId:r.batchId,shardId:r.worker,sourceSessionHash:r.sessionHash,fixtureOnly:false,buy:0,bonus:2,normalized:r.normalized,raw:r.raw,contentHash:hash(r.raw)};
    assert.equal(r.op,'verify');return {verified:true};
  }};
  f.operator=new TerminalRecovery({store:f.store,transport,gate:f.operator.gate,parser,normalize,plan:f.plan,profile:f.profile,
    githubIdle:f.operator.githubIdle,owner:'new-maintenance',commit:f.commit,now:()=>f.now,sleep:async()=>{}});
  f.get=k=>f.docs.get('state/'+k).value;return f;
}

test('complete received END is reconciled once without source calls, preserving old records and original continuation',async()=>{
  const f=await fixture(),old=[...f.docs].filter(([k])=>k.startsWith('journal/receipt:'));
  const pending=structuredClone(f.get(`batch:${f.plan.trialId}:2`).pending),r=await f.operator.recover();
  assert.equal(r.count,73);assert.equal(r.committed,73);assert.equal(r.sourceRequests,0);assert.equal(r.terminalSettled,1);
  assert.equal(f.get(`batch:${f.plan.trialId}:1`).pending,null);assert.deepEqual(f.get(`batch:${f.plan.trialId}:2`).pending,pending);
  for(const [key,value] of old)assert.deepEqual(f.docs.get(key),value);
  const terminal=f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value;
  assert.equal(terminal.attempt,'original-1');assert.equal(terminal.raw.steps.length,4);assert.equal(f.get('global-hold').active,false);
  await assert.rejects(f.operator.recover());await assert.rejects(f.operator.formal());
});

test('unknown, rejection, changed END, other failure and active lease cannot enter reconciliation',async()=>{
  for(const mode of ['awaiting','rejected','end','failure','lease','commit','run','hold','grant']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:1`);
    if(mode==='awaiting')b.pending.awaiting='unknown';
    if(mode==='rejected')b.pending.raw.steps.at(-1).sourceRejected=true;
    if(mode==='end')b.pending.raw.steps.pop();
    if(mode==='failure')b.failure='STORAGE_ERROR';
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='commit')f.get('campaign').protocolValidation.commit='x';
    if(mode==='run')f.get('campaign').protocolValidation.runKey='capture-run:1:2';
    if(mode==='hold')f.holds[1].value.details.code='SOURCE_REJECTED';
    if(mode==='grant')f.docs.get('journal/protocol-resume:'+terminalPolicy(32836).previousProof).value.batches=[];
    // Exercise semantic guards too, rather than only the immutable hash guard.
    if(['awaiting','rejected','end','failure','lease'].includes(mode)){
      f.profile.batches[0].hash=hash(b);f.profile.batches[0].pendingHash=hash(b.pending);
    }
    await assert.rejects(f.operator.recover());assert.equal(f.get('global-hold').active,true);
    assert(!f.docs.has('journal/'+receiptKey(f.plan.trialId,20)));
  }
});

test('backup failure leaves received END intact, and partial recovery cannot blindly rerun',async()=>{
  const f=await fixture(),create=f.store.create.bind(f.store);f.store.create=async(c,k,v,o)=>{
    if(k.endsWith(':backup-complete'))throw Error('BACKUP_FAILED');return create(c,k,v,o);
  };
  await assert.rejects(f.operator.recover(),/BACKUP_FAILED/);assert(f.get(`batch:${f.plan.trialId}:1`).pending);
  assert.equal(f.get('global-hold').active,true);await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});

test('unconsumed Demon prefix is preserved and cannot be rebound while the Foam hold remains',async()=>{
  const f=await fixture(32739),old=f.batches.filter(x=>x.value.pending).map(x=>structuredClone(x.value.pending));
  const r=await f.operator.recover();assert.equal(r.count,164);assert.equal(r.terminalSettled,0);assert.equal(r.originalPendingPreserved,4);
  assert.deepEqual(f.batches.filter(x=>x.value.pending).map(x=>f.get(`batch:${f.plan.trialId}:${x.value.id}`).pending),old);
  const blocked=await fixture(32739);blocked.holds[1].value.active=true;await assert.rejects(blocked.operator.recover(),/GLOBAL_HOLD/);
});

test('273-row full readback and original Foam continuation are mandatory before formal',async()=>{
  const f=await fixture();await f.operator.recover();await finishShort(f);
  const result=await f.operator.validate();assert.equal(result.fullReadback,273);assert.equal(result.originalPendingSettled,1);
  assert.equal((await f.operator.formal()).validationLimit,0);
});

test('settled terminal identity cannot change during short capture',async()=>{
  const f=await fixture();await f.operator.recover();await finishShort(f);
  f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value.attempt='replacement';
  await assert.rejects(f.operator.validate(),/TERMINAL_RECORD_CHANGED/);
});

test('Demon validation requires fresh replacement identities as well as four original continuations',async()=>{
  for(const corrupt of [false,true]){
    const f=await fixture(32739);await f.operator.recover();await finishShort(f);
    for(const [id,sequence] of [[2,115],[4,333]]){
      f.docs.set('journal/session-incident:invalid-session-36492435648-20260929:abandoned:'+id,
        {value:{pending:{sequence,attempt:'abandoned-'+id}}});
      const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,sequence)).value;
      r.raw.steps[0].ts=new Date(f.now+1).toISOString();if(corrupt && id===2)r.attempt='abandoned-2';
      f.rounds.set(r._id,structuredClone(r));
    }
    if(corrupt)await assert.rejects(f.operator.validate(),/ABANDONED_ATTEMPT_REPLAYED/);
    else{const v=await f.operator.validate();assert.equal(v.fullReadback,364);assert.equal(v.originalPendingSettled,4);}
  }
});

test('all original records and Mongo contents must agree before the backup or any mutation',async()=>{
  const f=await fixture();const first=f.rounds.values().next().value;first.contentHash='changed';
  await assert.rejects(f.operator.recover(),/FULL_MONGO_MISMATCH/);
  assert(!f.docs.has('journal/terminal-incident:'+terminalPolicy(32836).id+':proof'));
  const busy=await fixture();busy.block();await assert.rejects(busy.operator.recover(),/OTHER_RUN_ACTIVE/);
});
