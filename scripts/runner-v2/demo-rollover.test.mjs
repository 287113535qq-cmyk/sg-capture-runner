// Synthetic control fixture; parser is a test double, not SG feature evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {rolloverDemo} from './demo-rollover.mjs';import {DemoFresh} from './demo-fresh.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
export function fixture(){
 const oldPlan={gameId:32820,trialId:'synthetic-target',buy:0,phase:1,target:300000},plan={...oldPlan,demoGeneration:'a'.repeat(64)},fromPlan={gameId:32739,trialId:'synthetic-source'};
 const campaign={enabled:true,activeGame:32739,games:[{game_id:32739,status:'active'},{game_id:32820,status:'parked-protocol'}],protocolValidation:{runKey:'old-spent'}};
 const pool={enabled:false,planHash:hash(oldPlan),retiredDemo:'retired-demo:synthetic-target:original',nextBatchId:2,nextSequence:101,confirmed:0,workers:{7:{sessionHash:'old',leaseUntil:0,activeBatch:{id:1}}}};
 const fromPool={enabled:false,nextBatchId:1,workers:{},confirmed:446};
 const batch={id:1,worker:7,start:1,end:100,journaled:2,checkpoint:2,pending:null,sessionHash:'old',leaseUntil:0,retiredDemo:pool.retiredDemo};
 const retired={schema:'sg-retired-demo-result-v1',trialId:plan.trialId,sourceRequests:0,newBetAllowance:0,completePreserved:2};
 const docs=new Map([['state/campaign',{value:campaign}],['state/pool:'+plan.trialId,{value:pool}],['state/pool:'+fromPlan.trialId,{value:fromPool}],['state/batch:'+plan.trialId+':1',{value:batch}],['journal/'+pool.retiredDemo+':complete',{value:retired}]]),mongo=new Map();
 for(let sequence=1;sequence<=2;sequence++){const r={_id:hash(sequence),trialId:plan.trialId,sequence,batchId:1,shardId:7,sourceSessionHash:'old',raw:{synthetic:true}};docs.set('journal/'+receiptKey(plan.trialId,sequence),{value:r});mongo.set(r._id,r);}
 let failAt=null,busy=false,corrupt=false;const get=(c,k)=>structuredClone(docs.get(c+'/'+k));
 const store={get:async(c,k)=>get(c,k),getMany:async(c,ks)=>ks.map(k=>get(c,k)),create:async(c,k,v)=>{assert(k!==failAt,'INJECTED_FAILURE');assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,{value:structuredClone(v)});},update:async(c,k,fn)=>{assert(k!==failAt,'INJECTED_FAILURE');const v=await fn(get(c,k).value);if(v!==null)docs.set(c+'/'+k,{value:v});return get(c,k);}};
 const transport={request:async(op,p)=>{assert.equal(op,'rounds_read');return [...mongo.values()].filter(r=>p.ids.includes(r._id)).map(r=>corrupt?{...r,sequence:999}:structuredClone(r));}};
 const args={store,transport,parser:{call:async({record})=>({verified:record.raw.synthetic})},boundary:async()=>assert(!busy,'BUSY'),oldPlan,plan,fromPlan,expected:hash({campaign,pool,fromPool}),commit:'c'.repeat(40),run:'1:1',expiresAt:10000,now:()=>100};
 const key='demo-generation:'+plan.trialId+':'+plan.demoGeneration;
 const admission=async(worker=0)=>{docs.get('state/campaign').value.protocolValidation.runKey='capture-run:2:1';const fresh=new DemoFresh({store,plan,stage:'fresh',runKey:'capture-run:2:1',now:args.now});const identity={shardId:worker,sessionHash:'new-'+worker,commitSha:args.commit};return {fresh,identity,result:await fresh.admit(identity,worker)};};
 return {args,docs,mongo,batch,key,get,admission,fail:k=>failAt=k,busy:()=>busy=true,corrupt:()=>corrupt=true};
}
test('retired generation rolls over once, preserves completed batches and exposes only20x5',async()=>{
 const f=fixture(),old=hash(f.batch),r=await rolloverDemo(f.args);assert.equal(r.completePreserved,2);assert.equal(r.sourceRequests,0);assert.equal(hash(f.get('state','batch:'+f.args.plan.trialId+':1').value),old);
 const pool=f.get('state','pool:'+f.args.plan.trialId).value;assert.deepEqual(pool.workers,{});assert.equal(pool.confirmed,2);assert.equal(pool.nextSequence,101);
 let limit=0;for(let w=0;w<20;w++)limit+=(await f.admission(w)).result.limit;assert.equal(limit,100);
 assert.equal(f.get('journal',f.key+':parked-source').value.campaign.protocolValidation.runKey,'old-spent');
 await assert.rejects(rolloverDemo(f.args));
});
test('partial archive or campaign write cannot authorize capture',async()=>{
 for(const where of ['spec','campaign']){const f=fixture();f.fail(where==='spec'?f.key:'campaign');await assert.rejects(rolloverDemo(f.args),/INJECTED/);assert(!f.get('journal',f.key+':complete'));await assert.rejects(f.admission());}
});
test('Mongo conflict and busy boundary leave all control state untouched',async()=>{
 for(const cause of ['corrupt','busy']){const f=fixture(),old=hash([...f.docs]);f[cause]();await assert.rejects(rolloverDemo(f.args));assert.equal(hash([...f.docs]),old);}
});
test('old session, missing completion, expired permission and changed run are refused',async()=>{
 for(const kind of ['old','missing','expired','run']){const f=fixture();await rolloverDemo(f.args);const {fresh,identity}=await f.admission(7);
  if(kind==='old')identity.sessionHash='old';if(kind==='missing')f.docs.delete('journal/'+f.key+':complete');if(kind==='expired')fresh.now=()=>10001;if(kind==='run')fresh.runKey='capture-run:3:1';
  await assert.rejects(fresh.admit(identity,7));
 }
});
test('fifth new BET is allowed, sixth and old or extra batches are refused',async()=>{
 const f=fixture();await rolloverDemo(f.args);const {fresh}=await f.admission();assert.throws(()=>fresh.checkLease({id:1,start:1}));fresh.checkLease({id:2,start:101});for(let n=101;n<=105;n++)fresh.beforeBegin(n);assert.throws(()=>fresh.beforeBegin(106));assert.throws(()=>fresh.checkLease({id:3,start:201}));
});
test('retirement missing or old batch not fully flushed cannot roll over',async()=>{
 for(const kind of ['missing','pending','unflushed']){const f=fixture();if(kind==='missing')f.docs.delete('journal/'+f.batch.retiredDemo+':complete');if(kind==='pending')f.batch.pending={awaiting:'unknown'};if(kind==='unflushed')f.batch.checkpoint=1;await assert.rejects(rolloverDemo(f.args));assert(!f.get('journal',f.key+':before'));}
});

test('unchanged flushed history requires completed retirement before hash and remains auditable',async()=>{
 const {auditSessionOwner}=await import('./demo-session-audit.mjs');
 const f=fixture(),key='batch:'+f.args.plan.trialId+':1',b=f.docs.get('state/'+key).value;
 delete b.retiredDemo;
 const pool=f.get('state','pool:'+f.args.plan.trialId).value,before={schema:'sg-retired-demo-v1',plan:f.args.oldPlan,batches:[structuredClone(b)]};
 const done=f.docs.get('journal/'+pool.retiredDemo+':complete').value;done.beforeHash=hash(before);
 f.docs.set('journal/'+pool.retiredDemo+':before',{value:before});
 const original=hash(b);await rolloverDemo(f.args);
 assert.equal(hash(f.get('state',key).value),original);
 const record={batchId:1,shardId:7,sequence:1,sourceSessionHash:'old'};
 await auditSessionOwner({store:f.args.store,plan:f.args.plan,pool:f.get('state','pool:'+f.args.plan.trialId).value,record});
 before.batches[0].sessionHash='forged';
 await assert.rejects(auditSessionOwner({store:f.args.store,plan:f.args.plan,pool:f.get('state','pool:'+f.args.plan.trialId).value,record}),/RETIREMENT_PROOF/);
});
test('unmarked history without completed immutable before proof cannot roll over',async()=>{
 const f=fixture();delete f.docs.get('state/batch:'+f.args.plan.trialId+':1').value.retiredDemo;
 await assert.rejects(rolloverDemo(f.args),/RETIREMENT_PROOF/);
 assert(![...f.docs.keys()].some(k=>k.startsWith('journal/demo-generation:')));
});
