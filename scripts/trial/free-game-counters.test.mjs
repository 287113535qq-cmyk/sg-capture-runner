import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {advanceFreeGameCounters as runner} from './free-game-counters.mjs';
const {advanceFreeGameCounters:collector}=createRequire(import.meta.url)('../../collector/free-game-counters.cjs');
for(const [name,advance]of [['runner',runner],['collector',collector]]){
 test(name+' supports additions by default, consecutive awards and natural zero',()=>{
  let prior={total:6,remaining:6,played:0};
  for(const added of [0,3,0,2,0,0,0,0,0,0,0]){const current={total:prior.total+added,remaining:prior.remaining-1+added,played:prior.played+1};assert.deepEqual(advance(prior,current),{added,remaining:current.remaining});prior=current;}
  assert.equal(prior.remaining,0);assert.throws(()=>advance(prior,{total:12,remaining:0,played:12}));
 });
 test(name+' rejects inconsistent awards or progress and requires explicit intro',()=>{
  const a={total:10,remaining:4,played:6},b={total:15,remaining:8,played:7};
  assert.deepEqual(advance(a,b,{added:5}),{added:5,remaining:8});
  for(const opts of [{added:4},{consumed:2},{maximum:12}])assert.throws(()=>advance(a,b,opts));
  for(const current of [{...b,played:6},{...b,remaining:7},{...b,total:-1},{...b,remaining:true}])assert.throws(()=>advance(a,current));
  const c={total:6,remaining:6,played:0},d={total:9,remaining:9,played:0};assert.equal(advance(c,d,{consumed:0}).added,3);assert.throws(()=>advance(c,d));
 });
}
