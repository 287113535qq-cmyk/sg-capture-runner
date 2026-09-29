import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {operatorFixture,finishShort} from './session-test-fixture.mjs';
import {DemonRebindRecovery,DEMON_REBIND as K} from './demon-rebind-recovery.mjs';
import {protocolHash as hash,reviewProtocolResume} from './protocol-resume.mjs';
import {protocolGrant,requireShortRun} from './protocol-recovery-core.mjs';
import {receiptKey} from './durable-queue.mjs';

const output=spawnSync(process.env.PYTHON||'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_demon_fields import sample;print(json.dumps(sample()))"],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const raw=JSON.parse(output.stdout);

test('applied Demon rebind profile remains frozen and rejects newer runtime',()=>{
  const p=JSON.parse(fs.readFileSync('config/demon-rebind-20260929.json','utf8'));
  const actual=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
  assert.equal(hash(p),'58107696d60afd756f2f7bc4b6665b421a6440e0ce271e6b5d489b0db02e12d3');
  assert.equal(hash(p.adapterFiles),p.adapterHash);assert.notEqual(hash(actual),p.adapterHash);
});

export async function fixture(){
  const f=await operatorFixture(32739),put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'primary/'+k,version:1,value:structuredClone(v)});
  // The shared fake transport also checks its original fixture backup marker.
  put('journal','protocol:demon-32739-20260929:backup-complete',{});
  f.now=9000000;
  for(const {value:b} of f.batches){
    b.checkpoint=b.journaled;b.failure=null;b.leaseUntil=0;b.epoch=9;
    const target=K.pending[b.id];
    b.pending=target?{sequence:target.sequence,attempt:'original-'+b.id,awaiting:null,raw:{...structuredClone(raw),steps:structuredClone(raw.steps.slice(0,target.frames))}}:null;
    b.protocolResume=b.pending?{proofHash:K.proof,pendingHash:hash(b.pending)}:null;
    put('state',`batch:${f.plan.trialId}:${b.id}`,b);
    const rows=[...f.docs].filter(([key,d])=>key.startsWith('journal/receipt:') && d.value.batchId===b.id).map(([,d])=>d.value);
    for(const r of rows)f.rounds.set(r._id,structuredClone(r));
    put('journal',K.prefix+':records:'+b.id,{records:rows});
  }
  Object.assign(f.pool,{enabled:true,failure:null,protocolRecovery:K.proof});
  for(const id of [4,5])f.pool.workers[id]={sessionHash:String(id).padStart(64,'0'),owner:null,leaseUntil:0};
  Object.assign(f.campaign,{enabled:true,reason:null,audit:null,activeGame:32739,validationLimit:10,
    protocolValidation:{phase:'short',proofHash:K.proof,commit:K.commit,runKey:null}});
  f.campaign.games.find(x=>x.game_id===32739).status='active';
  put('state','pool:'+f.plan.trialId,f.pool);put('state','campaign',f.campaign);
  const prior={batches:structuredClone(f.batches)},grant=protocolGrant({plan:f.plan,batches:f.batches,proofHash:K.proof,commit:K.commit,now:100000});
  const result={proofHash:K.proof,count:164,committed:164,originalPendingPreserved:4,sourceRequests:0,validRecordsDeleted:0};
  put('journal',K.prefix+':before',prior);put('journal',K.prefix+':reconciled',result);put('journal','protocol-resume:'+K.proof,grant);
  put('journal','historical-abandoned:2',{mustRemain:true});put('journal','historical-abandoned:4',{mustRemain:true});
  f.profile={schema:'sg-demon-unstarted-rebind-v1',id:K.id,group:'primary',gameId:32739,createdAt:f.now,complete:164,checkpoint:164,pending:4,
    planHash:hash(f.plan),campaignHash:hash(f.campaign),poolHash:hash(f.pool),previousResultHash:hash(result),previousBeforeHash:hash(prior),previousGrantHash:hash(grant),
    batches:f.batches.map(({value:b})=>({id:b.id,hash:hash(b),pendingHash:b.pending?hash(b.pending):null,recordsHash:hash(f.docs.get('journal/'+K.prefix+':records:'+b.id).value.records)}))};
  const transport=f.operator.transport,request=transport.request.bind(transport);
  transport.request=async(op,r)=>{if(op==='cas' && r.key.startsWith('batch:'))assert(f.docs.has('journal/demon-rebind:'+K.id+':backup-complete'));return request(op,r);};
  f.operator=new DemonRebindRecovery({store:f.store,transport,gate:f.operator.gate,parser:f.operator.parser,plan:f.plan,profile:f.profile,
    githubIdle:f.operator.githubIdle,owner:'rebind',commit:f.commit,now:()=>f.now,sleep:async()=>{}});
  f.get=k=>f.docs.get('state/'+k).value;return f;
}

test('expired old grant is not usable; full backup yields fresh single-use continuation without deleting any original',async()=>{
  const f=await fixture(),old=structuredClone([...f.docs]),b=f.get(`batch:${f.plan.trialId}:5`),grant=f.docs.get('journal/protocol-resume:'+K.proof).value;
  assert.throws(()=>reviewProtocolResume({plan:f.plan,batch:b,grant,worker:0,sessionHash:b.sessionHash,commit:K.commit,now:f.now}),/RESUME_PROOF_STALE/);
  const result=await f.operator.recover();assert.equal(result.count,164);assert.equal(result.committed,164);assert.equal(result.sourceRequests,0);
  for(const [key,value] of old)if(key.startsWith('journal/receipt:') || key.startsWith('journal/historical-') || key==='journal/protocol-resume:'+K.proof)assert.deepEqual(f.docs.get(key),value);
  for(const [key,value] of old)if(key.startsWith('state/batch:'))assert.deepEqual(f.docs.get(key).value.pending,value.value.pending);
  const fresh=f.docs.get('journal/protocol-resume:'+result.proofHash).value,after=f.get(`batch:${f.plan.trialId}:5`);
  assert.equal(fresh.batches.length,4);assert.deepEqual(reviewProtocolResume({plan:f.plan,batch:after,grant:fresh,worker:0,sessionHash:after.sessionHash,commit:f.commit,now:f.now}),b.pending);
  assert.throws(()=>reviewProtocolResume({plan:f.plan,batch:after,grant:fresh,worker:0,sessionHash:after.sessionHash,commit:K.commit,now:f.now}),/RESUME_CODE_CHANGED/);
  const c=f.get('campaign');assert(requireShortRun(c,'capture-run:555:1',f.commit));assert.throws(()=>requireShortRun(c,'capture-run:556:1',f.commit));
  await assert.rejects(f.operator.recover());
});

test('new rejection, consumed marker, any previously started short, active lease, unknown and evidence drift cannot rebind',async()=>{
  for(const mode of ['rejected','consumed','run','lease','awaiting','bootstrap','prefix','records','grant','busy','hold']){
    const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:5`);
    if(mode==='rejected')b.pending.raw.steps.at(-1).sourceRejected=true;
    if(mode==='consumed')b.protocolResume=null;
    if(mode==='run')f.get('campaign').protocolValidation.runKey='capture-run:1:1';
    if(mode==='lease')b.leaseUntil=f.now+1;
    if(mode==='awaiting')b.pending.awaiting={MSGID:'FREE_GAME'};
    if(mode==='bootstrap')b.bootstrapAwaiting={MSGID:'INIT'};
    if(mode==='prefix')b.pending.raw.steps[0].responsePayload+='&CHANGED=1';
    if(mode==='records')f.docs.get('journal/'+receiptKey(f.plan.trialId,1)).value.attempt='changed';
    if(mode==='grant')f.docs.get('journal/protocol-resume:'+K.proof).value.batches.pop();
    if(mode==='busy')f.block();if(mode==='hold')f.holds[1].value.active=true;
    f.profile.batches[4].hash=hash(b);f.profile.batches[4].pendingHash=hash(b.pending);f.profile.campaignHash=hash(f.get('campaign'));
    await assert.rejects(f.operator.recover());assert.equal(f.get('pool:'+f.plan.trialId).protocolRecovery,K.proof);
  }
});

test('backup failure leaves original rounds and grants untouched and prevents blind rerun',async()=>{
  const f=await fixture(),b=structuredClone(f.get(`batch:${f.plan.trialId}:5`)),create=f.store.create.bind(f.store);
  f.store.create=async(c,k,v,o)=>{if(k.endsWith(':backup-complete'))throw Error('BACKUP_FAILED');return create(c,k,v,o);};
  await assert.rejects(f.operator.recover(),/BACKUP_FAILED/);assert.deepEqual(f.get(`batch:${f.plan.trialId}:5`),b);
  await assert.rejects(f.operator.recover(),/RECOVERY_ALREADY_STARTED/);
});

async function complete(f){
  // The source allocator creates a batch for existing idle workers too.
  const pool=f.get('pool:'+f.plan.trialId);for(const [id,w] of Object.entries(pool.workers))if(!w.activeBatch)delete pool.workers[id];
  await finishShort(f);f.get('campaign').protocolValidation.commit=f.commit;
}
test('requires 364 full records, four original continuations and actual Demon432 bonus2 before formal',async()=>{
  const f=await fixture();await f.operator.recover();await assert.rejects(f.operator.formal());await complete(f);
  const r=await f.operator.validate();assert.equal(r.fullReadback,364);assert.equal(r.originalPendingSettled,4);assert(r.liveFidOneSettlementVerified);
  assert.equal((await f.operator.formal()).validationLimit,0);
});
test('changed original identity, replayed BET, missing Demon bonus or stale final proof prevents formal',async()=>{
  for(const mode of ['attempt','bet','bonus','stale']){
    const f=await fixture();await f.operator.recover();await complete(f);
    const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,432)).value;
    if(mode==='attempt')r.attempt='changed';if(mode==='bet')r.raw.steps.push(r.raw.steps[0]);if(mode==='bonus')r.bonus=0;
    f.rounds.set(r._id,structuredClone(r));
    if(mode==='stale'){await f.operator.validate();f.now+=900001;}else await assert.rejects(f.operator.validate());
    await assert.rejects(f.operator.formal());
  }
});
