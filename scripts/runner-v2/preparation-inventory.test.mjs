import test from 'node:test';import assert from 'node:assert/strict';
import {newInventory,claimPreparation,finishPreparation,selectPrepared,preparationGates,rejectPreparedRevision} from './preparation-inventory.mjs';
const games=[{gameId:1,name:'repair'},{gameId:2,name:'next'},{gameId:3,name:'done'}];
const proof=id=>({schema:'sg-reusable-preparation-v1',gameId:id,revisionHash:'a'.repeat(64),sourceAllowance:0,
  gates:Object.fromEntries(preparationGates.map(k=>[k,{verified:true,evidenceHash:'b'.repeat(64)}]))});
test('capture failure removes only its prepared revision and leaves other work runnable',async()=>{
  const q=newInventory(games),c=claimPreparation(q,{owner:'p',now:0});
  finishPreparation(q,c,{status:'prepared',proof:proof(1)},1);
  const failure={gameId:1,proofHash:q.tasks[0].proofHash,reason:'BOOTSTRAP_REENTRY_PENDING',evidenceHash:'c'.repeat(64),now:2};
  assert.equal(rejectPreparedRevision(q,{...failure,proofHash:'d'.repeat(64)}),false);
  assert.equal(rejectPreparedRevision(q,failure),true);
  assert.equal(q.tasks[0].status,'blocked');assert.equal(q.tasks[0].proof,null);
  assert.equal((await selectPrepared(q,{verifyReusable:async()=>assert.fail(),admitFresh:async()=>assert.fail()})).action,'waiting-prepared');
  assert.equal(claimPreparation(q,{owner:'p',now:3}).gameId,2);
  assert.equal(rejectPreparedRevision(q,failure),false);
});
test('independent repair worker does not wait for admission backlog',()=>{
  const q=newInventory(games,{1:'parked-protocol'});
  assert.equal(claimPreparation(q,{owner:'repair',now:0,lane:'repair'}).gameId,1);
  assert.equal(claimPreparation(q,{owner:'admission',now:0,lane:'admission'}).gameId,2);
});
test('admission tasks precede repairs; a blocked game does not stop the producer',()=>{
  const q=newInventory(games,{1:'parked-protocol',3:'complete'}),c=claimPreparation(q,{owner:'p',now:0});
  assert.equal(c.gameId,2);finishPreparation(q,c,{status:'blocked',reason:'MISSING_ROUTE'},1);
  assert.equal(claimPreparation(q,{owner:'p',now:2}).gameId,1);
  assert.equal(q.tasks[2].status,'complete');assert.equal(q.sourceAllowance,0);
});
test('missing Linux or native proof cannot produce a prepared item',()=>{
  const q=newInventory(games),c=claimPreparation(q,{owner:'p',now:0}),p=proof(1);delete p.gates.linux;
  assert.throws(()=>finishPreparation(q,c,{status:'prepared',proof:p},1),/GATE_MISSING/);
  assert.equal(q.tasks[0].status,'preparing');
});
test('capture consumes prepared items only after independent fresh admission',async()=>{
  const q=newInventory(games),c=claimPreparation(q,{owner:'p',now:0});finishPreparation(q,c,{status:'prepared',proof:proof(1)},1);
  let calls=0;
  assert.equal((await selectPrepared(q,{verifyReusable:async()=>true,admitFresh:async()=>{calls++;return {action:'hold'};}})).action,'waiting-prepared');
  assert.equal(calls,1);
  assert.equal((await selectPrepared(q,{verifyReusable:async()=>true,admitFresh:async()=>({action:'capture'})})).task.gameId,1);
});
test('changed evidence returns to preparation and interrupted commands are not replayed',async()=>{
  const q=newInventory(games),c=claimPreparation(q,{owner:'p',now:0});finishPreparation(q,c,{status:'prepared',proof:proof(1)},1);
  await selectPrepared(q,{verifyReusable:async()=>false,admitFresh:async()=>assert.fail('stale admission')});
  assert.equal(q.tasks[0].status,'queued');
  const d=claimPreparation(q,{owner:'p',now:3,leaseMs:1000});
  assert.equal(claimPreparation(q,{owner:'other',now:1004}).gameId,2);
  assert.throws(()=>finishPreparation(q,d,{status:'prepared',proof:proof(1)},1005),/CLAIM_CHANGED/);
});
