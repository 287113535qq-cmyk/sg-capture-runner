import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {activateFormalCount} from './formal-count-activation.mjs';
import {pilotCloseScene} from './demo-pilot-close.mjs';
import {receiptKey} from './durable-queue.mjs';
import {pearlFixture} from '../trial/pearl-fixture.mjs';
import {rhinoFixture} from '../trial/rhino-fixture.mjs';
import {loadCountPermission} from './complete-count.mjs';
// All records are synthetic. Live pilot preservation is separately replayed
// from the private original data with the independent Python verifier.
async function fixture(gameId=32795,repaired=false){
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[gameId];
 const generation=repaired?'a8bbaf0c5f2522764d73a5111acb42eceed9076d276f5b077f8bc1c6eabcfc0d':'d'.repeat(64),activation='a'.repeat(64),commit=repaired?'65d870c75d77022b2de8deaca2755f5cd55e1528':'c'.repeat(40),fromPlan={...base,demoGeneration:generation},plan={...base,countAllocation:activation};
 const sourceProfileHash=repaired?'d03dc36c60fa3bf208126fe7592d70ab16a74a32afe39844817fa160ac565433':'e'.repeat(64),first=repaired?17:1,sourceRunKey=repaired?'capture-run:36826318464:1':'capture-run:2:1';
 const key=`demo-generation:${base.trialId}:${generation}`,top=`next-demo-game:${base.trialId}:${generation}`;
 const parent={schema:'sg-demo-generation-v1',generation,trialId:base.trialId,planHash:hash(fromPlan),commit,run:'1:1',workers:20,perWorker:5,newBetAllowance:100,firstBatchId:first,
  activationStage:{key:top,profileHash:sourceProfileHash}};
 const docs=new Map(),mongo=new Map(),put=(c,k,v)=>docs.set(c+'/'+k,{value:structuredClone(v)});
 put('journal',key,parent);put('journal',key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(parent),commit,run:'1:1'});
 put('journal',top+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:sourceProfileHash,generation,commit,run:'1:1',newBetAllowance:100,sourceRequests:0});
 const pool={enabled:true,failure:null,planHash:hash(fromPlan),confirmed:repaired?51:0,nextBatchId:first+20,nextSequence:(first+19)*100+1,workers:{},demoGeneration:{id:generation,specHash:hash(parent)}};
 const records=[];
 let repairedBaseline;
 if(repaired){
  const oldBatches=[];
  for(let id=1;id<17;id++){
   const count=id===16?6:3,start=(id-1)*100+1,b={id,worker:0,start,end:start+99,checkpoint:start+count-1,journaled:start+count-1,sessionHash:'0'.repeat(64),pending:null,leaseUntil:0,...(id===16?{failure:'PROTOCOL_VALIDATION_FAILED'}:{})};
   put('state',`batch:${base.trialId}:${id}`,b);oldBatches.push(b);
   for(let i=0;i<count;i++){const r={_id:String(start+i),trialId:base.trialId,batchId:id,shardId:0,sequence:start+i,sourceSessionHash:b.sessionHash,raw:rhinoFixture(),normalized:{bonus:0},fixtureOnly:false,buy:0};put('journal',receiptKey(base.trialId,r.sequence),r);mongo.set(r._id,r);records.push(r);}
  }
  const k=`repaired-demo-candidate:${base.trialId}:${generation}`,recordsHash=hash(records),before={scene:{batches:oldBatches,recordsHash,closed:{recordsHash}}},done={schema:'sg-repaired-demo-candidate-complete-v1',profileHash:sourceProfileHash,completePreserved:51,recordsHash,sourceRequests:0,newBetAllowance:0};
  put('journal',k+':before',before);put('journal',k+':complete',done);pool.repairedCandidate={key:k};
  repairedBaseline={key:k,beforeHash:hash(before),completeHash:hash(done),completePreserved:51};
 }

 for(let w=0;w<20;w++){
  const sessionHash=String(w+1).padStart(64,'0'),start=(w+first-1)*100+1;
  const b={id:w+first,worker:w,start,end:start+99,checkpoint:start+4,journaled:start+4,sessionHash,pending:null,leaseUntil:0};
  put('state',`batch:${base.trialId}:${b.id}`,b);pool.workers[w]={sessionHash,leaseUntil:0,activeBatch:{id:b.id}};
  for(let n=0;n<5;n++){
   const r={_id:String(start+n),trialId:base.trialId,batchId:b.id,shardId:w,sequence:start+n,sourceSessionHash:sessionHash,raw:gameId===32799?rhinoFixture(w===0&&n<1?8:0):pearlFixture(),normalized:{bonus:w===0&&n<(gameId===32799?1:2)?1:0},fixtureOnly:false,buy:0};
   put('journal',receiptKey(base.trialId,r.sequence),r);mongo.set(r._id,r);records.push(r);
  }
 }
 put('state','pool:'+base.trialId,pool);put('state','campaign',{enabled:true,activeGame:gameId,validationLimit:5,protocolValidation:{runKey:sourceRunKey,commit,generation}});
 const store={writable:async()=>{},get:async(c,k)=>structuredClone(docs.get(c+'/'+k)??null),getMany:async(c,ks)=>ks.map(k=>structuredClone(docs.get(c+'/'+k)??null)),
  create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);},update:async(c,k,fn)=>{put(c,k,fn(structuredClone(docs.get(c+'/'+k).value)));}};
 const transport={request:async(op,p)=>{assert.equal(op,'rounds_read');return p.ids.map(id=>structuredClone(mongo.get(id))).filter(Boolean);}};
 const profile={schema:repaired?'sg-formal-count-rhino-v2':gameId===32799?'sg-formal-count-rhino-v1':'sg-formal-count-profile-v1',gameId,activation,basePlanHash:hash(base),planHash:hash(plan),completePreserved:repaired?151:100,remainingComplete:repaired?299849:299900,...(repaired?{repairedBaseline}:{}),
  maxSequence:600000,sessionRotation:'closed-batches-v1',sourceGeneration:generation,sourceSpecHash:hash(parent),sourceProfileHash,sourceCommit:commit,sourceRunKey,
  recordsHash:hash(records),sceneHash:hash(await pilotCloseScene(store,fromPlan)),createdAt:1000,expiresAt:7201000};
 const args={store,transport,parser:{call:async r=>{assert.equal(r.op,'verify');return {verified:true};}},plans,profile,boundary:async()=>{},commit,run:'3:1',now:()=>2000};
 return {args,store,docs,mongo,base,plan,poolKey:'state/pool:'+base.trialId};
}
test('formal activation preserves 100 receipts and batches, grants only remaining complete count',async()=>{
 const f=await fixture(),before=new Map([...f.docs].filter(([k])=>!['state/campaign',f.poolKey].includes(k)).map(([k,v])=>[k,hash(v)]));
 const result=await activateFormalCount(f.args);assert.equal(result.completePreserved,100);assert.equal(result.remainingComplete,299900);assert.equal(result.sourceRequests,0);
 for(const [k,h] of before)assert.equal(hash(f.docs.get(k)),h);
 const pool=f.docs.get(f.poolKey).value;assert.equal(pool.confirmed,100);assert.equal(pool.nextSequence,2001);
 await loadCountPermission({store:f.store,plan:f.plan,pool,commit:f.args.commit});
 await assert.rejects(activateFormalCount(f.args));
});
test('Rhino independently activates remaining complete count with preserved synthetic pilot receipts',async()=>{
 const f=await fixture(32799),before=hash([...f.docs].filter(([k])=>k.startsWith('journal/receipt:')));
 const result=await activateFormalCount(f.args);assert.equal(result.remainingComplete,299900);assert.equal(result.sourceRequests,0);
 const pool=f.docs.get(f.poolKey).value;await loadCountPermission({store:f.store,plan:f.plan,pool,commit:f.args.commit});
 assert.equal(pool.confirmed,100);assert.equal(pool.nextSequence,2001);assert.equal(hash([...f.docs].filter(([k])=>k.startsWith('journal/receipt:'))),before);
});
test('Rhino cannot activate with no verified free rounds or borrowed Pearl profile',async()=>{
 for(const bad of ['free','profile']){
  const f=await fixture(32799);
  if(bad==='profile')f.args.profile.schema='sg-formal-count-profile-v1';
  else{
   const records=[];
   for(let w=0;w<20;w++)for(let n=w*100+1;n<w*100+6;n++){
    const r=f.docs.get('journal/'+receiptKey(f.base.trialId,n)).value;r.normalized.bonus=0;f.mongo.set(r._id,structuredClone(r));records.push(r);
   }
   f.args.profile.recordsHash=hash(records);
  }
  const before=hash([...f.docs]);await assert.rejects(activateFormalCount(f.args),bad==='free'?/NATURAL_FREE/:/PROFILE_SCOPE/);assert.equal(hash([...f.docs]),before);
 }
});
for(const bad of ['mongo','scene','spent','expiry','activation-write','campaign-write'])test('formal activation fails closed on '+bad,async()=>{
 const f=await fixture();
 if(bad==='mongo')f.mongo.delete('1');
 if(bad==='scene')f.args.profile.sceneHash='f'.repeat(64);
 if(bad==='spent')f.docs.get(f.poolKey).value.workers[0].leaseUntil=999999;
 if(bad==='expiry')f.args.profile.expiresAt=1999;
 if(bad==='activation-write'){
  const create=f.store.create;f.store.create=async(c,k,v)=>{if(k.startsWith('complete-count:')&&!k.endsWith(':before'))throw Error('INJECTED_WRITE');return create(c,k,v);};
 }
 if(bad==='campaign-write'){
  const update=f.store.update;f.store.update=async(c,k,fn)=>{if(k==='campaign')throw Error('INJECTED_CAS');return update(c,k,fn);};
 }
 await assert.rejects(activateFormalCount(f.args));
 const pool=f.docs.get(f.poolKey).value;
 await assert.rejects(loadCountPermission({store:f.store,plan:f.plan,pool,commit:f.args.commit}));
 assert.equal([...f.docs.keys()].some(k=>k.startsWith('journal/complete-count:')&&k.endsWith(':complete')),false);
});

test('repaired Rhino activation preserves all 51 old and 100 new records with old failed range frozen',async()=>{
 const f=await fixture(32799,true),before=new Map([...f.docs].filter(([k])=>k.startsWith('journal/')||k.startsWith('state/batch:')).map(([k,v])=>[k,hash(v)]));
 const out=await activateFormalCount(f.args);assert.equal(out.completePreserved,151);assert.equal(out.remainingComplete,299849);
 for(const [k,h]of before)assert.equal(hash(f.docs.get(k)),h);
 assert.equal(f.docs.get(f.poolKey).value.confirmed,151);assert.equal(f.docs.get(f.poolKey).value.nextSequence,3601);
 await loadCountPermission({store:f.store,plan:f.plan,pool:f.docs.get(f.poolKey).value,commit:f.args.commit});
});
for(const bad of ['baseline-proof','old-record','old-batch','borrowed-source','count-reset'])test('repaired Rhino count rejects '+bad,async()=>{
 const f=await fixture(32799,true);
 if(bad==='baseline-proof')f.args.profile.repairedBaseline.completeHash='0'.repeat(64);
 if(bad==='old-record')f.mongo.delete('1');
 if(bad==='old-batch')f.docs.get('state/batch:'+f.base.trialId+':16').value.failure=null;
 if(bad==='borrowed-source')f.args.profile.sourceRunKey='capture-run:36821539926:1';
 if(bad==='count-reset')f.args.profile.completePreserved=100;
 const before=hash([...f.docs]);await assert.rejects(activateFormalCount(f.args));assert.equal(hash([...f.docs]),before);
});
