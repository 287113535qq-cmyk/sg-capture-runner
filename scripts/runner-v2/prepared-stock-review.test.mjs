import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewPreparedStock,validatePreparedStockReview} from './prepared-stock-review.mjs';
test('published real stock is verified by capture selector but a parked campaign remains ineligible',async()=>{
 const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
 const publication=read('config/prepared-inventory.json'),plans=read('config/round-one-plans.json');
 const ids=publication.inventory.tasks.filter(t=>t.status==='prepared').map(t=>t.gameId);
 const expected=ids.filter(id=>publication.bindings[String(id)]?.group==='primary');
 const args={publication,plans,group:'primary',readEvidence:async f=>read(f),
  campaign:{games:ids.map(game_id=>({game_id,status:'parked-protocol'}))}};
 const task=await reviewPreparedStock(args);validatePreparedStockReview(task);
 assert.deepEqual(task.report.verifiedGames,expected);assert.equal(task.report.eligibleGame,null);
 assert.equal(task.report.newBetAllowance,0);assert.equal(task.report.activated,false);
 const ready=await reviewPreparedStock({...args,campaign:{games:ids.map(game_id=>({game_id,status:'ready'}))}});
 assert.equal(ready.report.eligibleGame,expected[0]??null);assert.equal(ready.report.newBetAllowance,0);
 if(expected.length)await assert.rejects(reviewPreparedStock({...args,readEvidence:async()=>null}),/STOCK_PROOF/);
 const changed=structuredClone(task);changed.report.newBetAllowance=1;assert.throws(()=>validatePreparedStockReview(changed));
});
