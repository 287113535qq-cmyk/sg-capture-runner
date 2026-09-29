import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {operatorFixture,finishShort} from './session-test-fixture.mjs';
import {PickBonusRecovery,PICK_BONUS as K} from './pick-bonus-recovery.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
test('Pick A Ball recovery has a fresh exact code profile; old applied profile stays frozen',()=>{
 const p=JSON.parse(fs.readFileSync('config/pick-bonus-20260929.json','utf8'));
 const files=Object.fromEntries(Object.keys(p.adapterFiles).map(f=>[f,createHash('sha256').update(fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
 assert.deepEqual(files,p.adapterFiles);assert.equal(hash(files),p.adapterHash);
});
async function fixture(){
 const f=await operatorFixture(32836);f.docs.clear();f.rounds.clear();
 const put=(c,k,v)=>f.docs.set(c+'/'+k,{_id:'secondary/'+k,version:1,value:structuredClone(v)});
 put('state','write-permits',{limit:1,slots:{}});put('journal','protocol:'+f.profile.id+':backup-complete',{});
 const counts=[30,22,15,14,20,10,7,15,1,10,7,12,3,11,0,1,10,2],committed=[30,22,9,14,20,10,7,15,0,10,5,12,3,11,0,0,10,0];
 const workers=[23,21,35,33,20,30,39,36,26,28,38,34,27,37,25,32,29,31];
 f.pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',planHash:hash(f.plan),protocolRecovery:K.previousProof,nextBatchId:19,nextSequence:1801,workers:{}};
 f.batches=counts.map((n,i)=>{
  const id=i+1,worker=workers[i],start=i*100+1,end=start+99,sessionHash=String(worker).padStart(64,'0');
  const b={id,worker,start,end,sessionHash,epoch:7,owner:'old',leaseUntil:0,journaled:start+n-1,checkpoint:start+committed[i]-1,
   failure:id===11?'PROTOCOL_VALIDATION_FAILED':null,protocolResume:null,pending:id===11?{sequence:1008,attempt:'original-pick',awaiting:null,raw:{startBalanceRaw:100000,steps:[{msgId:'BET',responsePayload:'FID=1|'}]}}:null};
  f.pool.workers[worker]={epoch:7,owner:'old',leaseUntil:0,sessionHash,activeBatch:{id,worker,start,end}};
  for(let seq=start;seq<=b.journaled;seq++){
   const r={_id:hash({seq}),sequence:seq,attempt:'old-'+seq,contentHash:hash({seq}),trialId:f.plan.trialId,batchId:id,shardId:worker,sourceSessionHash:sessionHash,fixtureOnly:false,buy:0,bonus:seq===20?2:0,raw:{steps:[{msgId:'BET'}]}};
   put('journal',receiptKey(f.plan.trialId,seq),r);if(seq<=b.checkpoint)f.rounds.set(r._id,structuredClone(r));
  }
  put('state',`batch:${f.plan.trialId}:${id}`,b);return f.docs.get('state/'+`batch:${f.plan.trialId}:${id}`);
 });
 f.campaign={enabled:true,reason:null,audit:null,activeGame:32836,validationLimit:10,games:[{game_id:32836,status:'parking-protocol',pendingReview:{batchId:11,sequence:1008,rawHash:hash(f.batches[10].value.pending.raw)}}],protocolValidation:{phase:'short',proofHash:K.previousProof,commit:K.previousCommit,runKey:K.runKey}};
 put('state','campaign',f.campaign);put('state','pool:'+f.plan.trialId,f.pool);
 put('journal','foam-session:foam-session-36499471583:reconciled',{proofHash:K.previousProof,count:118,committed:118});
 f.profile={schema:'sg-pick-bonus-resume-v1',id:K.id,group:'secondary',gameId:32836,createdAt:f.now,complete:190,checkpoint:178,pending:1,
  planHash:hash(f.plan),campaignHash:hash(f.campaign),poolHash:hash(f.pool),pendingHash:hash(f.batches[10].value.pending),batches:f.batches.map(x=>({id:x.value.id,hash:hash(x.value)}))};
 const transport=f.operator.transport,request=transport.request.bind(transport);
 transport.request=async(op,r)=>{if(op==='cas' && r.key.startsWith('batch:'))assert(f.docs.has('journal/pick-bonus:'+K.id+':backup-complete'),'BACKUP_FIRST');return request(op,r);};
 const parser={async call(r){if(r.op==='next')return {MSGID:'FEATURE_START',CFG:'1'};assert.equal(r.op,'verify');return {verified:true};}};
 f.operator=new PickBonusRecovery({store:f.store,transport,gate:f.operator.gate,parser,plan:f.plan,profile:f.profile,githubIdle:f.operator.githubIdle,owner:'new',commit:f.commit,now:()=>f.now,sleep:async()=>{}});
 f.get=k=>f.docs.get('state/'+k).value;return f;
}
test('backs up all190, flushes12 and preserves the successful BET plus one bound continuation grant',async()=>{
 const f=await fixture(),q=structuredClone(f.batches[10].value.pending),old=[...f.docs].filter(([k])=>k.startsWith('journal/receipt:'));
 const r=await f.operator.recover();assert.equal(r.count,190);assert.equal(r.committed,190);assert.equal(r.oldPendingPreserved,1);assert.equal(r.sourceRequests,0);
 assert.deepEqual(f.get(`batch:${f.plan.trialId}:11`).pending,q);
 const grant=f.docs.get('journal/protocol-resume:'+r.proofHash).value;assert.equal(grant.batches.length,1);assert.equal(grant.batches[0].worker,38);assert.equal(grant.commit,f.commit);
 for(const [k,v] of old)assert.deepEqual(f.docs.get(k),v);
 await assert.rejects(f.operator.recover());await assert.rejects(f.operator.formal());
});
test('unknown outcome, refusal, active leases, changed prior short or extra pending all reject',async()=>{
 for(const kind of ['awaiting','rejection','worker','batch','run','prior','extra','stale','hold','busy']){
  const f=await fixture(),b=f.get(`batch:${f.plan.trialId}:11`);
  if(kind==='awaiting')b.pending.awaiting={MSGID:'BET'};
  if(kind==='rejection')b.pending.raw.steps[0].sourceRejected=true;
  if(kind==='worker')f.get('pool:'+f.plan.trialId).workers[38].leaseUntil=f.now+1;
  if(kind==='batch')b.leaseUntil=f.now+1;
  if(kind==='run')f.get('campaign').protocolValidation.runKey='capture-run:1:1';
  if(kind==='prior')f.docs.get('journal/foam-session:foam-session-36499471583:reconciled').value.count=0;
  if(kind==='extra')f.get(`batch:${f.plan.trialId}:2`).pending=structuredClone(b.pending);
  if(kind==='stale')f.profile.createdAt=f.now-7200001;
  if(kind==='hold')f.holds[0].value.active=true;if(kind==='busy')f.block();
  f.profile.poolHash=hash(f.get('pool:'+f.plan.trialId));f.profile.campaignHash=hash(f.get('campaign'));f.profile.pendingHash=hash(b.pending);
  f.profile.batches=f.batches.map(x=>({id:x.value.id,hash:hash(f.get(`batch:${f.plan.trialId}:${x.value.id}`))}));
  await assert.rejects(f.operator.recover());assert.equal(f.get('pool:'+f.plan.trialId).enabled,false);
 }
});
test('backup failure or conflicting complete record cannot enable the pool',async()=>{
 for(const kind of ['backup','mongo']){
  const f=await fixture();if(kind==='backup'){const create=f.store.create.bind(f.store);f.store.create=async(c,k,v,o)=>{if(k.endsWith(':backup-complete'))throw Error('BACKUP_FAILED');return create(c,k,v,o);};}
  else f.rounds.values().next().value.contentHash='changed';
  await assert.rejects(f.operator.recover());assert.equal(f.get('pool:'+f.plan.trialId).enabled,false);
 }
});
test('390 full records and original1008 identity/prefix/bonus3 required before formal',async()=>{
 const f=await fixture();await f.operator.recover();await finishShort(f);
 const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,1008)).value;r.bonus=3;f.rounds.set(r._id,structuredClone(r));
 const v=await f.operator.validate();assert.equal(v.fullReadback,390);assert.equal(v.originalPendingSettled,1);assert.equal(v.livePickABallSettlementVerified,true);
 assert.equal(v.liveFoamSettlementVerified,undefined);assert.equal((await f.operator.formal()).validationLimit,0);
});
test('replacement attempt, oldFoam mapping change or unconsumed grant prevents validation',async()=>{
 for(const kind of ['attempt','foam','grant']){
  const f=await fixture();await f.operator.recover();await finishShort(f);
  const r=f.docs.get('journal/'+receiptKey(f.plan.trialId,1008)).value;r.bonus=3;
  if(kind==='attempt')r.attempt='new';f.rounds.set(r._id,structuredClone(r));
  if(kind==='foam'){const x=f.docs.get('journal/'+receiptKey(f.plan.trialId,20)).value;x.bonus=3;f.rounds.set(x._id,structuredClone(x));}
  if(kind==='grant')f.get(`batch:${f.plan.trialId}:11`).protocolResume={unconsumed:true};
  await assert.rejects(f.operator.validate());await assert.rejects(f.operator.formal());
 }
});
