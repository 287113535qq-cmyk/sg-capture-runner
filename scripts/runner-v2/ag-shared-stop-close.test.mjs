import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/demo-next-game.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {interruptedScene,readInterruptedClosure} from './demo-interrupted-close.mjs';
import {closeReviewedAdapterStop} from './ag-shared-stop-close.mjs';

async function stopped(){
 const f=await fixture(true),basePlan=f.args.plans[32820],plan={...basePlan,demoGeneration:f.args.profile.sourceGeneration};
 const parent=f.docs.get('journal/'+f.parentKey).value,pool=f.docs.get('state/pool:'+plan.trialId).value,c=f.docs.get('state/campaign').value;
 const top=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
 parent.activationStage={key:top,profileHash:'e'.repeat(64)};pool.demoGeneration.specHash=hash(parent);
 f.docs.get('journal/'+f.parentKey+':complete').value.specHash=hash(parent);
 f.docs.set('journal/'+top+':complete',{value:{schema:'sg-next-demo-game-complete-v1',profileHash:'e'.repeat(64),commit:parent.commit,run:parent.run,generation:plan.demoGeneration,newBetAllowance:100,sourceRequests:0}});
 Object.assign(c.protocolValidation,{commit:parent.commit,generation:plan.demoGeneration,demoFresh:hash(parent)});
 for(let w=0;w<20;w++){
  const b=f.docs.get(`state/batch:${plan.trialId}:${w+1}`).value,count=w===0?2:0;
  Object.assign(b,{epoch:0,owner:'10:1:worker'+w,journaled:b.start+count-1,checkpoint:b.start+(w===0?1:0)-1});
  pool.workers[w]={owner:b.owner,leaseUntil:0,sessionHash:b.sessionHash,activeBatch:{id:b.id}};
  for(let n=b.start;n<b.start+5;n++){
   const key='journal/'+receiptKey(plan.trialId,n);
   if(n>b.journaled)f.docs.delete(key);
   else {const r=f.docs.get(key).value;Object.assign(r,{_id:hash('source'+n),contentHash:hash('content'+n),fixtureOnly:false,buy:0});if(n<=b.checkpoint)f.mongo.set(r._id,structuredClone(r));}
  }
 }
 const bad=f.docs.get(`state/batch:${plan.trialId}:1`).value;
 bad.pending={sequence:3,awaiting:null,raw:{steps:[{msgId:'BET',responsePayload:'FID=1',responseXml:'<synthetic/>'}]}};
 bad.failure='RESPONSE_VALIDATION_REQUIRES_REVIEW';
 const hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{trialId:plan.trialId,batchId:1,code:'HUFF_UNREVIEWED_FEATURE_SLOTS',category:'source_protocol',cooldownUntil:0}};
 f.docs.set('state/global-hold',{value:hold});
 f.args.store.cas=async(col,k,doc,value)=>{if(hash(f.get(col,k)?.value)!==hash(doc.value))return null;f.docs.set(col+'/'+k,{value:structuredClone(value)});return true;};
 const profile={schema:'sg-ag-shared-stop-close-v1',planHash:hash(plan),sourceSpecHash:hash(parent),sourceProfileHash:'e'.repeat(64),sourceRunKey:'capture-run:10:1',sourceCommit:parent.commit,
  usedByWorker:[3,...Array(19).fill(0)],completeByWorker:[2,...Array(19).fill(0)],completePreserved:2,newBetAllowance:0,createdAt:0,expiresAt:7200000,
  code:hold.details.code,batchId:1,pendingHash:hash(bad.pending),holdHash:hash(hold),sceneHash:hash(await interruptedScene(f.args.store,plan))};
 const parser={call:async r=>{if(r.op==='next')throw Object.assign(Error(profile.code),{code:profile.code});return f.args.parser.call(r);}};
 const args={...f.args,basePlan,plan,profile,parser,run:'20:1'};
 return {...f,args,bad,hold,rebind:async()=>{profile.sceneHash=hash(await interruptedScene(args.store,plan));profile.pendingHash=hash(bad.pending);}};
}

test('reviewed adapter stop flushes backlog, preserves evidence, closes unused quota and releases only that hold',async()=>{
 const f=await stopped(),pendingHash=hash(f.bad.pending),r=await closeReviewedAdapterStop(f.args);
 assert.equal(r.used,3);assert.equal(r.foregone,97);assert.equal(r.completePreserved,2);assert.equal(r.sourceRequests,0);
 const b=f.get('state','batch:synthetic-source:1').value;assert.equal(b.pending,null);assert.equal(b.checkpoint,b.journaled);
 assert.equal(hash(f.get('journal',b.abandonedDemo).value.pending),pendingHash);
 assert.equal(f.get('state','global-hold').value.active,false);assert.equal(f.get('state','pool:synthetic-source').value.enabled,false);
 const key='closed-demo-pilot:synthetic-source:'+f.args.plan.demoGeneration,closed=f.get('journal',key+':complete').value;
 const scene=await interruptedScene(f.args.store,f.args.plan),profile=f.get('journal','ag-shared-stop:synthetic-source:'+f.args.plan.demoGeneration+':closure-profile').value;
 await readInterruptedClosure({store:f.args.store,plan:f.args.plan,profile:{...profile,sourceClosureHash:hash(closed)},scene:{campaign:scene.campaign,fromPool:scene.pool,sourceBatches:scene.batches},closed,before:f.get('journal',key+':before').value});
 assert.equal(f.get('state',closed.repairKey).value.sourceAllowance,0);await assert.rejects(closeReviewedAdapterStop(f.args));
});

test('changed snapshot, unknown response, another partial and unrelated active lease retain the shared hold',async()=>{
 for(const cause of ['snapshot','awaiting','other','lease','diagnosis']){
  const f=await stopped();
  if(cause==='snapshot')f.hold.details.code='SOURCE_REJECTED';
  if(cause==='awaiting'){f.bad.pending.awaiting='unconfirmed';await f.rebind();}
  if(cause==='other'){f.docs.get('state/batch:synthetic-source:2').value.pending={awaiting:null};await f.rebind();}
  if(cause==='lease'){const b=f.docs.get('state/batch:synthetic-source:2').value;b.owner='other';b.leaseUntil=1000;await f.rebind();}
  if(cause==='diagnosis')f.args.parser.call=async()=>{throw Object.assign(Error('money'),{code:'INVALID_SOURCE_MONEY'});};
  await assert.rejects(closeReviewedAdapterStop(f.args));assert.equal(f.get('state','global-hold').value.active,true);assert(f.get('state','batch:synthetic-source:1').value.pending);
 }
});

test('Mongo conflict or a new hold refuses release without source requests',async()=>{
 for(const cause of ['mongo','hold']){
  const f=await stopped();
  if(cause==='mongo')f.mongo.get(hash('source1')).contentHash='changed';
  else {const cas=f.args.store.cas;f.args.store.cas=async(c,k,d,v)=>k==='global-hold'?null:cas(c,k,d,v);}
  await assert.rejects(closeReviewedAdapterStop(f.args));assert.equal(f.get('state','global-hold').value.active,true);
 }
});
