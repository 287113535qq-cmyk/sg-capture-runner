// Portable synthetic source and parser; real retirement, rollover and admission.
import test from 'node:test';import assert from 'node:assert/strict';
import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';import {DemoFresh} from './demo-fresh.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
import {closeDemoPilot,pilotCloseScene} from './demo-pilot-close.mjs';
import {fixture} from './fixtures/demo-next-game.mjs';
test('next game flushes old complete, abandons partial, preserves spent source and grants only20x5',async()=>{
 const f=await fixture(),source=hash(f.get('state','batch:synthetic-source:1').value),r=await nextDemoGame(f.args);
 assert.equal(r.completePreserved,2);assert.equal(r.abandonedAttempts,1);assert.equal(r.sourceRequests,0);assert.equal(f.mongo.size,2);
 assert.equal(f.get('state','pool:synthetic-source').value.enabled,false);assert.equal(hash(f.get('state','batch:synthetic-source:1').value),source);
 assert.equal(f.get('state','batch:synthetic-demo:1').value.pending,null);assert.equal((await f.admit()).limit,5);
 await assert.rejects(nextDemoGame(f.args));
});
test('partial top completion refuses source even after generation and campaign writes',async()=>{
 const f=await fixture();f.fail(f.key+':complete');await assert.rejects(nextDemoGame(f.args),/INJECTED/);
 assert(f.get('journal',`demo-generation:${f.plan.trialId}:${f.plan.demoGeneration}:complete`));await assert.rejects(f.admit(),/NEXT_GAME_NOT_COMPLETE/);
});
test('source unspent budget, changed proof, stale profile and new lease refuse before any write',async()=>{
 for(const cause of ['budget','proof','stale','lease']){const f=await fixture();
  if(cause==='budget')f.docs.get('state/batch:synthetic-source:1').value.journaled=1;
  if(cause==='proof')f.docs.get('journal/'+f.parentKey+':complete').value.commit='e'.repeat(40);
  if(cause==='stale')f.args.now=()=>7200001;
  if(cause==='lease')f.docs.get('state/batch:synthetic-source:1').value.leaseUntil=1000;
  f.args.profile.sceneHash=hash(await nextDemoScene(f.args.store,f.args.plans[32835],f.args.plans[32820]));
  const before=hash([...f.docs]);await assert.rejects(nextDemoGame(f.args));assert.equal(hash([...f.docs]),before);
 }
});
test('Mongo or archive failure never creates a fresh generation or clears the old partial',async()=>{
 for(const cause of ['mongo','archive']){const f=await fixture();if(cause==='mongo')f.corrupt();else f.fail('retired-demo:synthetic-demo:'+hash(f.get('state','pool:synthetic-demo').value).slice(0,16)+':analysis');
  await assert.rejects(nextDemoGame(f.args));assert(f.get('state','batch:synthetic-demo:1').value.pending);assert(!f.get('journal',f.key+':complete'));await assert.rejects(f.admit());
 }
});

test('completed v1 pilot takes actual nextGame retirement, rollover and fresh admission path',async()=>{
 const f=await fixture(true),sourceBefore=hash([...f.docs].filter(([k])=>k.startsWith('state/batch:synthetic-source:')));
 const result=await nextDemoGame(f.args);assert.equal(result.newBetAllowance,100);assert.equal(result.sourceRequests,0);assert.equal((await f.admit()).limit,5);
 assert.equal(hash([...f.docs].filter(([k])=>k.startsWith('state/batch:synthetic-source:'))),sourceBefore);assert.equal(f.get('state','pool:synthetic-source').value.enabled,false);
});

test('imported pool requires same profile runtime run and final import receipt before retirement',async()=>{
 for(const cause of ['missing','commit','run','profile','spec','pool']){
  const f=await fixture(true),p=f.args.profile,pool=f.docs.get('state/pool:'+f.plan.trialId).value;
  p.legacyImport={schema:'sg-parked-import-v1',fixture:true};pool.legacyImport={key:'import-fixture',specHash:hash(p.legacyImport)};
  p.sceneHash=hash(await nextDemoScene(f.args.store,f.args.plans[32835],f.args.plans[32820]));
  const receipt={schema:'sg-parked-import-complete-v1',specHash:hash(p.legacyImport),profileHash:hash(p),commit:f.args.commit,run:f.args.run,newBetAllowance:0,sourceRequests:0};
  if(cause!=='missing')f.docs.set('journal/import-fixture:complete',{value:receipt});
  if(cause==='commit')receipt.commit='f'.repeat(40);if(cause==='run')receipt.run='999:1';if(cause==='profile')receipt.profileHash='0'.repeat(64);if(cause==='spec')receipt.specHash='0'.repeat(64);if(cause==='pool')delete pool.legacyImport;
  const before=hash([...f.docs]);await assert.rejects(nextDemoGame(f.args),/NEXT_GAME_IMPORT_INCOMPLETE/);assert.equal(hash([...f.docs]),before);
 }
});

test('closed95 pilot can enter actual nextGame retirement rollover and fresh admission without borrowing5',async()=>{
 const f=await fixture(true),fromBase=f.args.plans[32820],fromPlan={...fromBase,demoGeneration:f.args.profile.sourceGeneration};
 const parent=f.docs.get('journal/'+f.parentKey).value,source=f.docs.get('state/pool:'+fromPlan.trialId).value,c=f.docs.get('state/campaign').value;
 source.nextBatchId=20;source.workers={};f.docs.delete('state/batch:'+fromPlan.trialId+':20');
 for(let n=1901;n<=1905;n++)f.docs.delete('journal/'+receiptKey(fromPlan.trialId,n));
 for(let w=0;w<19;w++){
  const b=f.docs.get('state/batch:'+fromPlan.trialId+':'+(w+1)).value;source.workers[w]={sessionHash:b.sessionHash,leaseUntil:0};
  for(let n=b.start;n<=b.journaled;n++){const r=f.docs.get('journal/'+receiptKey(fromPlan.trialId,n)).value;r._id=hash('source'+n);f.mongo.set(r._id,structuredClone(r));}
 }
 const top=`next-demo-game:${fromPlan.trialId}:${fromPlan.demoGeneration}`;parent.activationStage={key:top,profileHash:'e'.repeat(64)};
 source.demoGeneration.specHash=hash(parent);f.docs.get('journal/'+f.parentKey+':complete').value.specHash=hash(parent);
 f.docs.set('journal/'+top+':complete',{value:{schema:'sg-next-demo-game-complete-v1',profileHash:'e'.repeat(64),commit:parent.commit,run:parent.run,generation:fromPlan.demoGeneration,newBetAllowance:100,sourceRequests:0}});
 Object.assign(c.protocolValidation,{commit:parent.commit,generation:fromPlan.demoGeneration,demoFresh:hash(parent)});
 f.args.store.cas=async(col,k,doc,value)=>{const before=f.get(col,k);if(hash(before.value)!==hash(doc.value))return null;f.docs.set(col+'/'+k,{value:structuredClone(value)});return f.get(col,k);};
 const p={schema:'sg-demo-pilot-close-v1',planHash:hash(fromPlan),sourceSpecHash:hash(parent),sourceProfileHash:'e'.repeat(64),sourceRunKey:'capture-run:10:1',sourceCommit:parent.commit,usedByWorker:[...Array(19).fill(5),0],completePreserved:95,newBetAllowance:0,createdAt:0,expiresAt:7200000,sceneHash:hash(await pilotCloseScene(f.args.store,fromPlan))};
 const closed=await closeDemoPilot({...f.args,basePlan:fromBase,plan:fromPlan,profile:p,run:'20:1'});
 Object.assign(f.args.profile,{sourceSpecHash:hash(parent),sourceCommit:parent.commit,sourceProfileHash:p.sourceProfileHash,sourceClosureHash:hash(closed)});
 f.args.profile.sceneHash=hash(await nextDemoScene(f.args.store,f.args.plans[32835],fromPlan));
 const r=await nextDemoGame(f.args);assert.equal(r.newBetAllowance,100);assert.equal(r.sourceRequests,0);assert.equal((await f.admit()).limit,5);
 assert.equal(closed.used,95);assert.equal(closed.foregone,5);assert.equal(f.get('state','pool:'+fromPlan.trialId).value.enabled,false);
});
