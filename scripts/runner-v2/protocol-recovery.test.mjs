import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash,reviewProtocolResume} from './protocol-resume.mjs';
import {reviewParkedProtocol,protocolGrant,requireShortRun} from './protocol-recovery-core.mjs';
import {ProtocolRecovery} from './protocol-recovery.mjs';
import {RunnerState} from './state-store.mjs';
import {receiptKey} from './durable-queue.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

test('operator profile pins the reviewed implementation with a platform-independent file fingerprint',()=>{
  const p=JSON.parse(fs.readFileSync('config/protocol-demon-20260929.json','utf8'));
  assert.equal(p.adapterHashFormat,'utf8-lf-sha256');
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(path=>[path,
    createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.deepEqual(actual,p.adapterFiles);assert.equal(hash(actual),p.adapterHash);
});

function fixture(){
  const now=100000,commit='d'.repeat(40),plan={gameId:32739,trialId:'sg_r1_20260928_32739',target:299850,buy:0,phase:1};
  const progress=[8,14,12,32,31,36,9,12,5,1,2,1,1,0,0],workers=[3,1,14,6,0,17,16,19,13,2,15,12,11,9,10];
  const pendingIds=[1,2,4,5,9,10],pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',planHash:hash(plan),
    nextSequence:1501,nextBatchId:16,confirmed:0,workers:{}};
  const batches=progress.map((n,i)=>{
    const id=i+1,worker=workers[i],start=i*100+1,end=start+99,sessionHash=String(worker).padStart(64,'0');
    pool.workers[worker]={sessionHash,owner:'old',epoch:1,leaseUntil:0,resumeSafe:false,activeBatch:{id,worker,start,end}};
    const pending=pendingIds.includes(id)?{sequence:start+n,attempt:'original-'+id,awaiting:null,
      raw:{startBalanceRaw:10000,steps:[{msgId:'BET',requestPayload:'MSGID=BET&PID=fixture',responsePayload:'NFG=1'}]}}:null;
    return {_id:`primary/batch:${plan.trialId}:${id}`,version:1,value:{id,worker,start,end,sessionHash,owner:'old',epoch:1,
      leaseUntil:100,journaled:start+n-1,checkpoint:start-1,pending,failure:id===5?'PROTOCOL_VALIDATION_FAILED':null}};
  });
  const campaign={enabled:true,reason:null,activeGame:null,validationLimit:0,audit:null,
    games:[{game_id:32739,status:'parked-protocol',baseline:150},{game_id:32745,status:'complete',baseline:150}]};
  const holds=['primary','secondary'].map(g=>({_id:g+'/global-hold',value:{active:false}}));
  const parked={pool:structuredClone(pool),evidence:batches.map(d=>({key:`parked:${plan.trialId}:${d.value.id}`,hash:hash(d.value)}))};
  const profile={schema:'sg-parked-protocol-profile-v1',id:'demon-32739-20260929',group:'primary',gameId:32739,
    planHash:hash(plan),poolHash:hash(pool),complete:164,checkpoint:0,pending:6,adapterHash:'a'.repeat(64),
    batches:batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null}))};
  return {now,commit,plan,campaign,pool,batches,parked,holds,profile};
}

test('parked recovery verifies all ranges, old records and known continuations without counting them as complete',()=>{
  const f=fixture();assert.deepEqual(reviewParkedProtocol(f),{complete:164,checkpoint:0,pending:6});
});
test('active or ready games take priority; recovery cannot interrupt their collection or final audit',()=>{
  for(const change of [f=>f.campaign.activeGame=32745,f=>f.campaign.games[1].status='ready',f=>f.campaign.audit={until:200000},f=>f.campaign.enabled=false]){
    const f=fixture();change(f);assert.throws(()=>reviewParkedProtocol(f));
  }
});
test('changed pending, unexpected failures, allocation, source unknown and active leases never pass',()=>{
  for(const change of [f=>f.batches[0].value.pending.awaiting='MSGID=BET',f=>f.batches[0].value.bootstrapAwaiting={},
    f=>f.batches[0].value.failure='SOURCE_NETWORK_OUTCOME_UNKNOWN',f=>f.batches[0].value.pending.raw.steps.push({msgId:'BET'}),
    f=>f.batches[0].value.sessionHash='b'.repeat(64),f=>f.batches[0].value.leaseUntil=200000,
    f=>f.pool.workers[3].leaseUntil=200000,f=>f.pool.nextSequence++,f=>f.holds[1].value.active=true,
    f=>f.parked.evidence.pop(),f=>f.batches.pop()]){
    const f=fixture();change(f);assert.throws(()=>reviewParkedProtocol(f));
  }
});
test('a one-time resume grant binds plan, original pending, fixed worker, session and fresh evidence',()=>{
  const f=fixture(),proofHash='b'.repeat(64),grant=protocolGrant({...f,proofHash}),batch=structuredClone(f.batches[0].value);
  batch.failure=null;batch.protocolResume={proofHash,pendingHash:hash(batch.pending)};
  const args={plan:f.plan,batch,grant,commit:f.commit,worker:batch.worker,sessionHash:batch.sessionHash,now:f.now};
  assert.deepEqual(reviewProtocolResume(args),batch.pending);
  for(const change of [a=>a.commit='e'.repeat(40),a=>a.now=grant.expiresAt,a=>a.worker=19,a=>a.sessionHash='other',a=>a.plan.target++,
    a=>a.batch.protocolResume=null,a=>a.batch.pending.awaiting='MSGID=FREE_GAME',a=>a.batch.pending.raw.steps[0].responsePayload='changed',
    a=>a.batch.bootstrapAwaiting={},a=>a.grant.proofHash='c'.repeat(64)]){
    const a=structuredClone(args);change(a);assert.throws(()=>reviewProtocolResume(a));
  }
});
test('one short-run binding allows delayed shards but prevents scheduler or rerun adding more rounds before review',()=>{
  const c={activeGame:32739,validationLimit:10,protocolValidation:{phase:'short',gameId:32739,commit:'d'.repeat(40),runKey:null}};
  assert.equal(requireShortRun(c,'capture-run:123:1','d'.repeat(40)),true);
  assert.equal(requireShortRun(c,'capture-run:123:1','d'.repeat(40)),false);
  assert.throws(()=>requireShortRun(c,'capture-run:123:2','d'.repeat(40)),/PROTOCOL_SHORT_REVIEW_REQUIRED/);
  assert.throws(()=>requireShortRun(c,'capture-run:124:1','d'.repeat(40)),/PROTOCOL_SHORT_REVIEW_REQUIRED/);
  assert.equal(requireShortRun({validationLimit:0},'capture-run:125:1'),false);
});

async function operatorFixture(){
  const f=fixture(),docs=new Map(),rounds=new Map(),events=[];let idle=true;
  const put=(c,k,v)=>docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
  put('state','campaign',f.campaign);put('state','pool:'+f.plan.trialId,f.pool);put('state','write-permits',{limit:1,slots:{}});
  put('journal','parked-pool:'+f.plan.trialId,f.parked);
  for(const {value:b} of f.batches){
    put('state',`batch:${f.plan.trialId}:${b.id}`,b);
    put('journal',`parked:${f.plan.trialId}:${b.id}`,{batch:b,poolPlanHash:f.profile.planHash});
    for(let sequence=b.start;sequence<=b.journaled;sequence++)put('journal',receiptKey(f.plan.trialId,sequence),{
      _id:hash({fixture:sequence}),trialId:f.plan.trialId,sequence,batchId:b.id,shardId:b.worker,sourceSessionHash:b.sessionHash,
      fixtureOnly:false,buy:0,contentHash:hash({sequence}),raw:{steps:[{msgId:'BET'}]},normalized:{bonus:0},bonus:0});
  }
  const transport={async request(op,r){
    if(op==='resources')return {};
    if(op==='global_holds')return structuredClone(f.holds);
    if(op==='read')return structuredClone(docs.get(r.collection+'/'+r.key)||null);
    if(op==='read_many')return r.keys.map(k=>docs.get(r.collection+'/'+k)).filter(Boolean).map(x=>structuredClone(x));
    if(op==='create'){const k=r.collection+'/'+r.key;if(docs.has(k))return {created:false};put(r.collection,r.key,r.value);events.push(k);return {created:true};}
    if(op==='cas'){
      const k=r.collection+'/'+r.key,old=docs.get(k);if(old.version!==r.version)return {replaced:false};
      // Verify durable backup was completed BEFORE the first target mutation.
      if(k.startsWith('state/batch:'))assert(docs.has('journal/protocol:'+f.profile.id+':backup-complete'));
      docs.set(k,{...old,version:r.version+1,value:structuredClone(r.value)});events.push(k);return {replaced:true,version:r.version+1};
    }
    if(op==='rounds_read')return r.ids.filter(id=>rounds.has(id)).map(id=>structuredClone(rounds.get(id)));
    if(op==='rounds_insert'){for(const x of r.records)rounds.set(x._id,structuredClone(x));events.push('rounds-write');return {};}
    if(op==='rounds_scan')return [...rounds.values()].filter(x=>x.sequence>r.after).sort((a,b)=>a.sequence-b.sequence).slice(0,100);
    throw Error('UNEXPECTED_TRANSPORT');
  }};
  const gate={observe(){},status:()=>({allowed:true,maxBatchSize:100,metrics:{diskFreeBytes:100*1024**3}})};
  const store=new RunnerState({transport,gate,now:()=>f.now,sleep:async()=>{}});
  const parser={async call(r){if(r.op==='next')return {MSGID:'FREE_GAME'};assert.equal(r.op,'verify');return {verified:true};}};
  const operator=new ProtocolRecovery({store,transport,gate,parser,plan:f.plan,profile:f.profile,
    githubIdle:async()=>assert(idle,'OTHER_RUN_ACTIVE'),commit:f.commit,owner:'maintenance',now:()=>f.now,sleep:async()=>{}});
  return {...f,docs,rounds,events,operator,store,block(){idle=false;}};
}

test('operator backs up first, reconciles all old records and preserves six original pending attempts without SG',async()=>{
  const f=await operatorFixture(),original=structuredClone(f.batches);
  const result=await f.operator.recover();assert.equal(result.count,164);assert.equal(result.oldPendingPreserved,6);
  assert.equal(result.sourceRequests,0);assert.equal(f.rounds.size,164);
  for(const {value:b} of original){
    const after=(await f.store.get('state',`batch:${f.plan.trialId}:${b.id}`)).value;
    assert.deepEqual(after.pending,b.pending);assert.equal(after.checkpoint,b.journaled);
    assert.equal(after.sessionHash,b.sessionHash);assert.equal(after.start,b.start);assert.equal(after.end,b.end);
  }
  const c=(await f.store.get('state','campaign')).value;assert.equal(c.activeGame,32739);assert.equal(c.validationLimit,10);
  assert.deepEqual(c.games[1],f.campaign.games[1]);assert.deepEqual(f.holds,fixture().holds);
  await assert.rejects(f.operator.recover());
  await assert.rejects(f.operator.formal()); // Offline replay is not a live settlement proof.
});
test('unresolved GitHub activity or an unsupported pending prevents any recovery write',async()=>{
  for(const mode of ['jobs','protocol','changed']){
    const f=await operatorFixture();
    if(mode==='jobs')f.block();
    if(mode==='protocol')f.operator.parser.call=async()=>{throw Error('UNKNOWN_TRIAL_FEATURE');};
    if(mode==='changed')f.docs.get('state/batch:'+f.plan.trialId+':5').value.pending.attempt='changed';
    await assert.rejects(f.operator.recover());assert.equal(f.events.length,0);assert.equal(f.rounds.size,0);
  }
});
test('a backup or reconciliation failure leaves the original parked game unavailable and blocks blind reapplication',async()=>{
  const f=await operatorFixture(),request=f.operator.transport.request;
  f.operator.transport.request=async(op,r)=>{if(op==='rounds_insert')throw Error('WRITE_FAILED');return request(op,r);};
  await assert.rejects(f.operator.recover(),/MONGO_ACK_UNKNOWN/);
  const c=(await f.store.get('state','campaign')).value,p=(await f.store.get('state','pool:'+f.plan.trialId)).value;
  assert.equal(c.activeGame,null);assert.equal(c.games[0].status,'parked-protocol');assert.equal(p.enabled,false);
  assert(f.docs.has('journal/protocol:'+f.profile.id+':backup-complete'));
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});

async function finishShort(f){
  const pool=f.docs.get('state/pool:'+f.plan.trialId).value;
  for(let worker=0;worker<20;worker++){
    let w=pool.workers[worker];
    if(!w){
      const id=pool.nextBatchId++,start=pool.nextSequence,end=start+99;pool.nextSequence=end+1;
      w=pool.workers[worker]={sessionHash:String(worker).padStart(64,'0'),activeBatch:{id,worker,start,end},epoch:1};
      f.docs.set('state/batch:'+f.plan.trialId+':'+id,{_id:'primary/batch:'+f.plan.trialId+':'+id,version:1,
        value:{id,worker,start,end,sessionHash:w.sessionHash,journaled:start-1,checkpoint:start-1,pending:null,failure:null,epoch:1}});
    }
    const b=f.docs.get('state/batch:'+f.plan.trialId+':'+w.activeBatch.id).value,pending=b.pending;
    for(let n=0;n<10;n++){
      const sequence=b.journaled+1,raw=n===0 && pending?structuredClone(pending.raw):{startBalanceRaw:10000,steps:[]};
      raw.steps.push({msgId:pending && n===0?'FREE_GAME':'BET',responsePayload:'NFG=0'});
      const r={_id:hash({fixture:sequence}),contentHash:hash({complete:sequence}),trialId:f.plan.trialId,
        sequence,attempt:pending && n===0?pending.attempt:'new-'+sequence,batchId:b.id,shardId:worker,
        sourceSessionHash:w.sessionHash,fixtureOnly:false,buy:0,bonus:b.id===5 && pending && n===0?2:0,raw};
      f.docs.set('journal/'+receiptKey(f.plan.trialId,sequence),{_id:'primary/'+receiptKey(f.plan.trialId,sequence),version:1,value:r});
      f.rounds.set(r._id,structuredClone(r));b.journaled=sequence;b.checkpoint=sequence;
    }
    Object.assign(b,{pending:null,protocolResume:null,leaseUntil:0,owner:'short'});
    Object.assign(w,{owner:'short',epoch:b.epoch,leaseUntil:0,resumeSafe:true});
  }
  f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:999:1';
}
test('only full short readback, six unchanged original prefixes and actual special settlement allow formal stage',async()=>{
  const f=await operatorFixture();await f.operator.recover();await finishShort(f);
  const result=await f.operator.validate();assert.equal(result.fullReadback,364);assert.equal(result.originalPendingSettled,6);
  assert.equal(result.liveFidOneSettlementVerified,true);
  const final=await f.operator.formal();assert.equal(final.validationLimit,0);
  assert.equal(f.docs.get('state/campaign').value.protocolValidation,null);
  await assert.rejects(f.operator.formal());
});
test('short validation rejects changed original prefix, attempt, special mapping and an untouched worker',async()=>{
  for(const mode of ['prefix','attempt','bonus','worker']){
    const f=await operatorFixture();await f.operator.recover();await finishShort(f);
    const row=f.docs.get('journal/'+receiptKey(f.plan.trialId,432)).value;
    if(mode==='prefix')row.raw.steps[0].responsePayload='changed';
    if(mode==='attempt')row.attempt='different';
    if(mode==='bonus')row.bonus=0;
    if(mode==='worker')f.docs.get('state/batch:'+f.plan.trialId+':5').value.journaled--;
    f.rounds.set(row._id,structuredClone(row));
    await assert.rejects(f.operator.validate());
    assert(!f.docs.has('journal/protocol:'+f.profile.id+':validation'));
  }
});
