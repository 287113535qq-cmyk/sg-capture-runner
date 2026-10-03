import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {reviewPreparedCountScene} from './prepared-count-scene.mjs';
import {activatePreparedCount} from './prepared-count-activation.mjs';
import {loadCountPermission} from './complete-count.mjs';
import {admitPreparedCountRun} from './prepared-count-admission.mjs';

// Synthetic state exercises admission/CAS failures. Real retained records are
// independently reviewed privately; these fixtures do not prove live routing.
async function fixture(){
 const plans=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),base=plans[32714];
 const publication=structuredClone(JSON.parse(fs.readFileSync('config/prepared-inventory.json','utf8')));
 const docs=new Map(),writes=[],mongo=new Map(),put=(c,k,v)=>docs.set(c+'/'+k,structuredClone(v));
 const repairKey='game-repair:'+base.trialId+':'+ 'a'.repeat(64),key='closed-demo-pilot:'+base.trialId+':'+ 'b'.repeat(64);
 const repair={schema:'sg-game-repair-v1',gameId:base.gameId,trialId:base.trialId,sourceAllowance:0,
  requiresNewSession:true,archiveKey:'archive'},archive={immutable:true};
 put('state',repairKey,repair);put('journal','archive',archive);
 publication.inventory.tasks[0].failureEvidenceHash=hash({repairKey,repair,archiveHash:hash(archive)});
 const b={id:1,worker:0,start:1,end:100,journaled:2,checkpoint:2,sessionHash:'c'.repeat(64),leaseUntil:0,pending:null};
 put('state','batch:'+base.trialId+':1',b);
 const records=[1,2].map(sequence=>({_id:'synthetic-'+sequence,gameId:base.gameId,trialId:base.trialId,
  sequence,batchId:1,shardId:0,sourceSessionHash:b.sessionHash,buy:0,fixtureOnly:false,raw:{fixtureOnly:false}}));
 for(const r of records){put('journal',receiptKey(base.trialId,r.sequence),r);mongo.set(r._id,r);}
 put('journal',key+':complete',{sourceRequests:0,newBetAllowance:0,trialId:base.trialId,profileHash:'d'.repeat(64),
  repairKey,generation:'b'.repeat(64),completePreserved:2,recordsHash:hash(records)});
 put('state','pool:'+base.trialId,{enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',confirmed:2,
  nextBatchId:2,nextSequence:101,workers:{0:{leaseUntil:0,activeBatch:{id:1,start:1,end:100}}},
  demoPilotClosed:{key,profileHash:'d'.repeat(64),repairKey}});
 put('state','campaign',{enabled:true,activeGame:32714,validationLimit:5,
  games:[{game_id:32714,status:'parked-protocol',repairKey}]});
 const store={get:async(c,k)=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null,
  getMany:async(c,keys)=>Promise.all(keys.map(k=>store.get(c,k))),
  create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);writes.push(k);},
  update:async(c,k,fn)=>{put(c,k,fn(structuredClone(docs.get(c+'/'+k))));writes.push(k);}};
 const args={store,transport:{request:async(op,{ids})=>{assert.equal(op,'rounds_read');return ids.map(id=>mongo.get(id)).filter(Boolean);}},
  parser:{call:async r=>r.op==='plan'?{validated:true}:{verified:true}},base,plans,publication,group:'primary',
  readEvidence:async f=>JSON.parse(fs.readFileSync(f,'utf8')),now:()=>2000};
 const scene=await reviewPreparedCountScene(args),activation='e'.repeat(64);
 const profile={schema:'sg-prepared-count-profile-v1',gameId:base.gameId,trialId:base.trialId,group:'primary',
  basePlanHash:hash(base),activation,targetComplete:300000,completePreserved:2,remainingComplete:299998,
  maxSequence:600000,sessionRotation:'closed-batches-v1',newBetAllowance:0,requiresNewSession:true,
  createdAt:1000,expiresAt:7201000,preparationProofHash:scene.preparationProofHash,
  failureEvidenceHash:scene.failureEvidenceHash,sceneHash:hash(scene),recordsHash:scene.recordsHash,closureHash:hash(scene.closed),
  planHash:hash({...base,target:300000,countAllocation:activation})};
 const authorization={schema:'sg-prepared-count-authorization-v1',gameId:base.gameId,trialId:base.trialId,
  group:'primary',basePlanHash:hash(base),activation,profileHash:hash(profile)};
 return {args:{...args,profile,authorization,boundary:async()=>{},commit:'f'.repeat(40),run:'1:1'},docs,mongo,writes,base,repairKey};
}
test('prepared admission preserves settled historical pointers and complete receipts without gameplay classification',async()=>{
 const f=await fixture(),original=[...f.docs].filter(([k])=>k.startsWith('journal/receipt:')||k.startsWith('state/batch:'));
 const result=await activatePreparedCount(f.args);assert.equal(result.remainingComplete,299998);assert.equal(result.sourceRequests,0);
 for(const [k,v] of original)assert.equal(hash(f.docs.get(k)),hash(v));
 const pool=f.docs.get('state/pool:'+f.base.trialId),plan={...f.base,target:300000,countAllocation:f.args.profile.activation};
 await loadCountPermission({store:f.args.store,plan,pool,commit:f.args.commit});
 assert.equal(pool.confirmed,2);assert.deepEqual(pool.workers,{});
 await assert.rejects(activatePreparedCount(f.args),/ALREADY_STARTED/);
});
for(const bad of ['live-lease','foreign-game','foreign-pointer','pending','mongo','receipt-sequence','receipt-session','parser','proof','scene'])
 test('prepared admission rejects '+bad+' before any write',async()=>{
  const f=await fixture(),pool=f.docs.get('state/pool:'+f.base.trialId),b=f.docs.get('state/batch:'+f.base.trialId+':1');
  if(bad==='live-lease')pool.workers[0].leaseUntil=999999;
  if(bad==='foreign-game')f.docs.get('state/campaign').activeGame=32718;
  if(bad==='foreign-pointer')pool.workers[0].activeBatch.id=9;
  if(bad==='pending')b.pending={sequence:3};
  if(bad==='mongo')f.mongo.delete('synthetic-1');
  if(bad==='receipt-sequence')f.docs.get('journal/'+receiptKey(f.base.trialId,1)).sequence=99;
  if(bad==='receipt-session')f.docs.get('journal/'+receiptKey(f.base.trialId,1)).sourceSessionHash='0'.repeat(64);
  if(bad==='parser')f.args.parser.call=async r=>r.op==='plan'?{validated:true}:{verified:false};
  if(bad==='proof')f.args.publication.inventory.tasks[0].proofHash='0'.repeat(64);
  if(bad==='scene')f.args.profile.sceneHash='0'.repeat(64);
  await assert.rejects(activatePreparedCount(f.args));assert.equal(f.writes.length,0);
 });
test('partial activation never becomes a source permit and cannot be blindly replayed',async()=>{
 const f=await fixture(),update=f.args.store.update;
 f.args.store.update=async(c,k,fn)=>{if(k==='campaign')throw Error('INJECTED_CAS');return update(c,k,fn);};
 await assert.rejects(activatePreparedCount(f.args),/INJECTED_CAS/);
 const plan={...f.base,target:300000,countAllocation:f.args.profile.activation},pool=f.docs.get('state/pool:'+f.base.trialId);
 await assert.rejects(loadCountPermission({store:f.args.store,plan,pool,commit:f.args.commit}));
 await assert.rejects(activatePreparedCount(f.args),/ALREADY_STARTED/);
 assert(!f.docs.has('journal/complete-count:'+f.base.trialId+':'+f.args.profile.activation+':complete'));
});
test('prepared stock selects the preserved ledger and admits exactly one new run',async()=>{
 const f=await fixture();await activatePreparedCount(f.args);
 const plan={...f.base,target:300000,countAllocation:f.args.profile.activation};
 const args={...f.args,plan,run:'2:1'};
 const result=await admitPreparedCountRun(args);
 assert.equal(result.completeBefore,2);assert.equal(result.remainingComplete,299998);
 assert.equal(f.docs.get('state/campaign').activeGame,32714);
 assert.equal(f.docs.get('journal/count-run:'+plan.trialId+':2:1').preparationProofHash,f.args.profile.preparationProofHash);
 await assert.rejects(admitPreparedCountRun(args),/ALREADY_ADMITTED/);
});
for(const bad of ['proof-revoked','other-game','live-worker','changed-code','unknown-write'])
 test('new run admission refuses '+bad,async()=>{
  const f=await fixture();await activatePreparedCount(f.args);
  const plan={...f.base,target:300000,countAllocation:f.args.profile.activation},args={...f.args,plan,run:'2:1'};
  if(bad==='proof-revoked')args.publication.inventory.tasks[0].status='blocked';
  if(bad==='other-game')f.docs.get('state/campaign').activeGame=32718;
  if(bad==='live-worker')f.docs.get('state/pool:'+plan.trialId).workers[0]={leaseUntil:999999};
  if(bad==='changed-code')args.commit='0'.repeat(40);
  if(bad==='unknown-write')f.args.store.create=async()=>{throw Error('UNKNOWN_ACK');};
  await assert.rejects(admitPreparedCountRun(args));
  assert(!f.docs.has('journal/count-run:'+plan.trialId+':2:1'));
 });
