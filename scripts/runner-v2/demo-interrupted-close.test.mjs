import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/demo-next-game.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
import {closeInterruptedPilot,interruptedScene} from './demo-interrupted-close.mjs';
import {reviewSpentDemoGeneration} from './demo-spent-generation.mjs';
import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';
import {DemoFresh} from './demo-fresh.mjs';
import {advanceAgPilot} from './ag-pilot-transition.mjs';

async function interrupted(){
 const f=await fixture(true),basePlan=f.args.plans[32820],plan={...basePlan,demoGeneration:f.args.profile.sourceGeneration};
 const parent=f.docs.get('journal/'+f.parentKey).value,pool=f.docs.get('state/pool:'+plan.trialId).value,c=f.docs.get('state/campaign').value;
 const complete=[5,0,0,5,1,5,0,5,0,5,1,0,2,0,0,0,0,4,5,0],used=complete.map((n,w)=>n+(w===8?1:0));
 const top=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
 parent.activationStage={key:top,profileHash:'e'.repeat(64)};pool.demoGeneration.specHash=hash(parent);
 f.docs.get('journal/'+f.parentKey+':complete').value.specHash=hash(parent);
 f.docs.set('journal/'+top+':complete',{value:{schema:'sg-next-demo-game-complete-v1',profileHash:'e'.repeat(64),commit:parent.commit,run:parent.run,generation:plan.demoGeneration,newBetAllowance:100,sourceRequests:0}});
 pool.enabled=false;pool.failure='PROTOCOL_VALIDATION_FAILED';pool.drainingProtocol=true;
 c.games[0].status='parking-protocol';Object.assign(c.protocolValidation,{commit:parent.commit,generation:plan.demoGeneration,demoFresh:hash(parent)});
 for(let w=0;w<20;w++){
  const b=f.docs.get(`state/batch:${plan.trialId}:${w+1}`).value;b.journaled=b.checkpoint=b.start+complete[w]-1;
  pool.workers[w]={leaseUntil:0,sessionHash:b.sessionHash,activeBatch:{id:b.id}};
  for(let n=b.start;n<b.start+5;n++){
   const key='journal/'+receiptKey(plan.trialId,n);if(n>b.journaled)f.docs.delete(key);
   else{const r=f.docs.get(key).value;r._id=hash('source'+n);f.mongo.set(r._id,structuredClone(r));}
  }
 }
 const b=f.docs.get(`state/batch:${plan.trialId}:9`).value;
 const pending={sequence:b.start,awaiting:null,raw:{steps:[{msgId:'BET',responseXml:'<synthetic-bet/>',responsePayload:'FID=2'},{msgId:'FREE_GAME',responseXml:'<synthetic-free/>',responsePayload:'FID=1|2'}]}};
 b.abandonedDemo=`abandoned-demo:${plan.trialId}:${b.id}:${hash(pending)}`;
 f.docs.set('journal/'+b.abandonedDemo,{value:{schema:'sg-abandoned-demo-v1',trialId:plan.trialId,batchId:b.id,reason:'UNKNOWN_TRIAL_FEATURE',disposition:'interrupted-abandoned-without-replay',pending,pendingOriginal:null,sourceRequests:0}});
 c.games[0].pendingReview={batchId:b.id,sequence:pending.sequence,rawHash:hash(pending.raw)};
 f.args.store.cas=async(col,k,doc,value)=>{if(hash(f.get(col,k).value)!==hash(doc.value))return null;f.docs.set(col+'/'+k,{value:structuredClone(value)});return true;};
 const profile={schema:'sg-demo-pilot-close-v2',planHash:hash(plan),sourceSpecHash:hash(parent),sourceProfileHash:'e'.repeat(64),sourceRunKey:'capture-run:10:1',sourceCommit:parent.commit,usedByWorker:used,completeByWorker:complete,completePreserved:38,newBetAllowance:0,createdAt:0,expiresAt:7200000,sceneHash:hash(await interruptedScene(f.args.store,plan))};
 const args={...f.args,basePlan,plan,profile,run:'20:1'};
 const source=async closed=>{const s=await interruptedScene(args.store,plan);return {store:args.store,parser:args.parser,basePlan,fromPlan:plan,profile:{...profile,sourceClosureHash:closed&&hash(closed)},scene:{campaign:s.campaign,fromPool:s.pool,sourceBatches:s.batches},now:args.now};};
 const bindNext=async closed=>{Object.assign(f.args.profile,{sourceSpecHash:hash(parent),sourceCommit:parent.commit,sourceProfileHash:profile.sourceProfileHash,sourceClosureHash:hash(closed)});f.args.profile.sceneHash=hash(await nextDemoScene(args.store,f.args.plans[32835],plan));};
 return {...f,closeArgs:args,source,bindNext,abandonedKey:b.abandonedDemo,key:`closed-demo-pilot:${plan.trialId}:${plan.demoGeneration}`,repairKey:`game-repair:${plan.trialId}:${plan.demoGeneration}`};
}

test('AG partial pilot closes39/61, preserves38 complete and abandoned raw, transitions while repair stays pending',async()=>{
 const f=await interrupted(),old=new Map([...f.docs].map(([k,v])=>[k,hash(v.value)])),closed=await closeInterruptedPilot(f.closeArgs);
 assert.equal(closed.used,39);assert.equal(closed.newComplete,38);assert.equal(closed.abandoned,1);assert.equal(closed.foregone,61);
 for(const [k,h] of old)if(k!=='state/pool:'+f.closeArgs.plan.trialId)assert.equal(hash(f.docs.get(k).value),h);
 const spent=await reviewSpentDemoGeneration(await f.source(closed));assert.equal(spent.spent,39);assert.equal(spent.verified,38);
 await assert.rejects(new DemoFresh({store:f.args.store,plan:f.closeArgs.plan,stage:'fresh',runKey:'capture-run:10:1',now:f.args.now}).admit({shardId:8,sessionHash:'new-session',commitSha:f.closeArgs.profile.sourceCommit},8));
 await f.bindNext(closed);const next=await nextDemoGame(f.args);assert.equal(next.newBetAllowance,100);assert.equal(next.sourceRequests,0);
 const c=f.get('state','campaign').value,repair=f.get('state',f.repairKey).value;
 assert.equal(c.activeGame,32835);assert.equal(c.games[0].repairKey,f.repairKey);assert.equal(repair.status,'pending-adapter');assert.equal(repair.sourceAllowance,0);
 // Repair progress is independent after transition; it cannot consume any of
 // the new game's20x5 quota or restore the old game's unused61.
 f.docs.get('state/'+f.repairKey).value.status='reviewing-adapter';assert.equal((await f.admit()).limit,5);
 assert.equal(hash(f.get('journal',f.abandonedKey).value),old.get('journal/'+f.abandonedKey));
 await assert.rejects(closeInterruptedPilot(f.closeArgs));
});

test('unknown responses, live partials, missing receipts and false counts reject before any close write',async()=>{
 for(const cause of ['pending','awaiting','xml','bet','missing','mongo','lease','budget','registered','review']){
  const f=await interrupted(),b=f.docs.get('state/batch:synthetic-source:9').value,a=f.docs.get('journal/'+f.abandonedKey).value;
  if(cause==='pending')b.pending={awaiting:null};if(cause==='awaiting')a.pending.awaiting={msgId:'FREE_GAME'};
  if(cause==='xml')a.pending.raw.steps[1].responseXml='';if(cause==='bet')a.pending.raw.steps.push(a.pending.raw.steps[0]);
  if(cause==='missing')f.docs.delete('journal/'+receiptKey(f.closeArgs.plan.trialId,1));if(cause==='mongo')f.mongo.delete(hash('source1'));
  if(cause==='lease')b.leaseUntil=101;if(cause==='budget')f.closeArgs.profile.usedByWorker[8]=0;
  if(cause==='registered')f.docs.get('state/pool:synthetic-source').value.workers[8].sessionHash='wrong';
  if(cause==='review')f.docs.get('state/campaign').value.games[0].pendingReview.rawHash='wrong';
  f.closeArgs.profile.sceneHash=hash(await interruptedScene(f.args.store,f.closeArgs.plan));const before=hash([...f.docs]);
  await assert.rejects(closeInterruptedPilot(f.closeArgs));assert.equal(hash([...f.docs]),before);
 }
});

test('partial close stages and CAS races never authorize the next game',async()=>{
 for(const cause of ['before','repair','cas','complete','boundary']){
  const f=await interrupted();if(cause==='cas')f.closeArgs.store.cas=async()=>false;
  else if(cause==='boundary'){let n=0;f.closeArgs.boundary=async()=>{if(++n===2)f.docs.get('state/pool:synthetic-source').value.workers[0].leaseUntil=999;};}
  else f.fail(cause==='repair'?f.repairKey:f.key+':'+cause);
  await assert.rejects(closeInterruptedPilot(f.closeArgs));await assert.rejects(reviewSpentDemoGeneration(await f.source()));
  assert(!f.get('journal',f.key+':complete'));
 }
});

test('changed repair allowance, raw evidence or closure cannot release a new generation',async()=>{
 for(const cause of ['repair','raw','closure']){
  const f=await interrupted(),closed=await closeInterruptedPilot(f.closeArgs);
  if(cause==='repair')f.docs.get('state/'+f.repairKey).value.sourceAllowance=1;
  if(cause==='raw')f.docs.get('journal/'+f.abandonedKey).value.pending.raw.steps[0].responseXml='altered';
  if(cause==='closure')f.docs.get('journal/'+f.key+':complete').value.used--;
  await f.bindNext(closed);const before=hash([...f.docs]);await assert.rejects(nextDemoGame(f.args));assert.equal(hash([...f.docs]),before);
 }
});

test('AG coordinator parks immediately with no ready candidate and later advances without re-closing or waiting for repair',async()=>{
 const f=await interrupted(),first=await advanceAgPilot({closeArgs:f.closeArgs});
 assert.equal(first.action,'waiting-ready');assert.equal(first.newBetAllowance,0);assert.equal(first.closed.foregone,61);
 const closeHash=hash(f.get('journal',f.key+':complete').value);
 f.docs.get('state/'+f.repairKey).value.status='reviewing-adapter';
 const second=await advanceAgPilot({closeArgs:f.closeArgs,prepareNext:async({closed})=>{await f.bindNext(closed);return f.args;}});
 assert.equal(second.action,'next-ready');assert.equal(second.sourceRequests,0);assert.equal((await f.admit()).limit,5);
 assert.equal(hash(f.get('journal',f.key+':complete').value),closeHash);assert.equal(f.get('state',f.repairKey).value.status,'reviewing-adapter');
});
async function parkedInterrupted(){
 const f=await interrupted(),s=await interruptedScene(f.args.store,f.closeArgs.plan),trial=f.closeArgs.plan.trialId,h=hash(s.pool);
 const archiveKey=`parked-v2:${trial}:${h}`,key=`game-repair:${trial}:${h}`,evidence=[];
 for(const w of Object.values(s.pool.workers)){
  const b=s.batches.find(b=>b.id===w.activeBatch.id),k=`${archiveKey}:batch:${b.id}`;
  f.docs.set('journal/'+k,{value:{batch:structuredClone(b),poolPlanHash:s.pool.planHash}});evidence.push({key:k,hash:hash(b)});
 }
 const archive={pool:structuredClone(s.pool),evidence},repair={schema:'sg-game-repair-v1',gameId:f.closeArgs.plan.gameId,trialId:trial,status:'pending-adapter',archiveKey,evidence,sourceAllowance:0,requiresNewSession:true};
 f.docs.set('journal/'+archiveKey,{value:archive});f.docs.set('state/'+key,{value:repair});
 const c=f.docs.get('state/campaign').value;c.activeGame=null;c.games[0].status='parked-protocol';c.games[0].repairKey=key;
 f.closeArgs.profile.parkedRepair={key,hash:hash(repair),archiveKey,archiveHash:hash(archive)};
 f.closeArgs.profile.sceneHash=hash(await interruptedScene(f.args.store,f.closeArgs.plan));f.repairKey=key;return f;
}

test('already parked pilot reuses immutable AG evidence and repair, then retires and activates next game',async()=>{
 const f=await parkedInterrupted(),original=new Map([...f.docs].map(([k,v])=>[k,hash(v.value)])),closed=await closeInterruptedPilot(f.closeArgs);
 assert.equal(closed.used,39);assert.equal(closed.foregone,61);assert.equal(closed.repairKey,f.repairKey);
 for(const [k,h] of original)if(k!=='state/pool:'+f.closeArgs.plan.trialId)assert.equal(hash(f.docs.get(k).value),h);
 assert.equal([...f.docs.keys()].filter(k=>k.startsWith('state/game-repair:')).length,1);
 f.docs.get('state/'+f.repairKey).value.status='reviewing-adapter';
 await f.bindNext(closed);const next=await nextDemoGame(f.args);assert.equal(next.newBetAllowance,100);
 assert.equal(f.get('state','campaign').value.activeGame,32835);assert.equal((await f.admit()).limit,5);
 assert.equal(f.get('state',f.repairKey).value.status,'reviewing-adapter');
});

test('already parked close rejects changed repair, archive, batch, active pointer or omitted binding before writes',async()=>{
 for(const cause of ['quota','archive','batch','active','missing-binding','repair-key','repair-hash']){
  const f=await parkedInterrupted(),p=f.closeArgs.profile.parkedRepair;
  if(cause==='quota')f.docs.get('state/'+p.key).value.sourceAllowance=1;
  if(cause==='archive')f.docs.get('journal/'+p.archiveKey).value.pool.confirmed++;
  if(cause==='batch')f.docs.get('journal/'+p.archiveKey+':batch:1').value.batch.journaled--;
  if(cause==='active')f.docs.get('state/campaign').value.activeGame=32835;
  if(cause==='missing-binding')delete f.closeArgs.profile.parkedRepair;
  if(cause==='repair-key')p.key+='wrong';if(cause==='repair-hash')p.hash='0'.repeat(64);
  f.closeArgs.profile.sceneHash=hash(await interruptedScene(f.args.store,f.closeArgs.plan));const original=hash([...f.docs]);
  await assert.rejects(closeInterruptedPilot(f.closeArgs));assert.equal(hash([...f.docs]),original);
 }
});

test('parked closure cannot be used after its independent archive or repair allowance changes',async()=>{
 for(const cause of ['archive','quota']){
  const f=await parkedInterrupted(),closed=await closeInterruptedPilot(f.closeArgs),p=closed.parkedRepair;
  if(cause==='archive')f.docs.get('journal/'+p.archiveKey+':batch:1').value.batch.journaled--;
  else f.docs.get('state/'+p.key).value.sourceAllowance=1;
  await f.bindNext(closed);const original=hash([...f.docs]);await assert.rejects(nextDemoGame(f.args));assert.equal(hash([...f.docs]),original);
 }
});
