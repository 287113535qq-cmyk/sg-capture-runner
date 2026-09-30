import assert from 'node:assert/strict';import test from 'node:test';
import {protocolHash as hash} from './protocol-resume.mjs';import {reviewFormalSource,readPoolBatches} from './formal-source-review.mjs';
import {formalSourceFixture as fixture} from './fixtures/formal-source.mjs';
test('completed count source review paginates3000 closed batches without writes or allowance',async()=>{
 const f=fixture();const batches=await readPoolBatches(f.args.store,f.args.plan,f.args.scene.fromPool);assert.equal(batches.length,3000);
 assert.deepEqual(await reviewFormalSource(f.args),{kind:'complete',completePreserved:300000,sourceRequests:0,newBetAllowance:0,proofHash:f.args.profile.sourceFormal.proofHash});assert.equal(f.sizes.length,90);
});
test('formal source cannot hand off while active, unaudited, reserved, altered or partially missing',async()=>{
 for(const mode of ['active','proof','reserved','missing','pending','changed']){
  const f=fixture(),{campaign,fromPool:pool}=f.args.scene;
  if(mode==='active')campaign.activeGame=32795;
  if(mode==='proof')f.docs.delete('journal/game-audit:'+f.args.plan.trialId);
  if(mode==='reserved')pool.countAllocation.reserved=100;
  if(mode==='missing')f.docs.delete(`state/batch:${f.args.plan.trialId}:2501`);
  if(mode==='pending')f.args.scene.sourceBatches[2500].pending={unresolved:true};
  if(mode==='changed')f.docs.get(`state/batch:${f.args.plan.trialId}:2501`).checkpoint--;
  await assert.rejects(reviewFormalSource(f.args));
 }
});
test('explicitly retired formal source keeps remaining count unavailable while permitting independent preparation',async()=>{
 const f=fixture(),{campaign,fromPool:pool,sourceBatches}=f.args.scene,ref=f.args.profile.sourceFormal;
 const plan=f.args.plan,b=sourceBatches.at(-1),item=pool.countAllocation.batches[b.id];b.journaled=b.checkpoint=b.start-1;pool.confirmed-=100;item.complete=0;
 const settlement=f.docs.get('journal/'+item.settlementKey);item.evidenceHash=hash(settlement);
 pool.enabled=false;pool.failure='PROTOCOL_VALIDATION_FAILED';pool.retiredCount='retired-count:synthetic:fixed';
 const repairKey='game-repair:synthetic:fixed',repair={sourceAllowance:0,requiresNewSession:true,status:'reviewing-adapter'};
 const game=campaign.games[0];game.status='parked-protocol';game.repairKey=repairKey;game.confirmed=pool.confirmed;
 const proofKey='formal-stopped-retire:synthetic:fixed:complete',proof={schema:'sg-formal-stopped-retire-v1',trialId:plan.trialId,sourceCommit:ref.commit,completePreserved:pool.confirmed,sourceRequests:0,newBetAllowance:0,repairKey};
 f.docs.set('state/'+repairKey,repair);f.docs.set('journal/'+proofKey,proof);f.docs.set('journal/'+pool.retiredCount+':complete',{schema:'sg-retired-count-result-v1',completePreserved:pool.confirmed,sourceRequests:0,newBetAllowance:0});
 Object.assign(ref,{kind:'retired',poolHash:hash(pool),campaignHash:hash(campaign),proofKey,proofHash:hash(proof),repairHash:hash(repair)});
 const result=await reviewFormalSource(f.args);assert.equal(result.completePreserved,299900);assert.equal(result.newBetAllowance,0);
 repair.sourceAllowance=1;await assert.rejects(reviewFormalSource(f.args));
});
