import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkPrimaryLeases} from './lease-boundary.mjs';
const plans=Object.fromEntries(Array.from({length:25},(_,i)=>[i,{gameId:i,trialId:'trial'+i}]));
test('real configured plan inventory is completely inspected without a fixed plan count',async()=>{
  const actual=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),seen=[];
  await checkPrimaryLeases({plans:actual,store:{getMany:async(c,keys)=>{seen.push(...keys);return keys.map(()=>null);}}});
  assert.deepEqual(seen.sort(),Object.values(actual).map(p=>'pool:'+p.trialId).sort());
  assert.equal(new Set(seen).size,Object.keys(actual).length);
});
test('duplicate or empty plan scope cannot silently omit lease checks',async()=>{
  for(const bad of [{},{1:{trialId:'same'},2:{trialId:'same'}},{1:{}}])
    await assert.rejects(checkPrimaryLeases({plans:bad,store:{getMany(){throw Error('UNEXPECTED_READ');}}}),/PLAN_COVERAGE_CHANGED/);
});

function fake(mode){
  return {get:async()=>({value:{games:[{game_id:0,status:'active'},{game_id:1,status:'complete'}]}}),
    getMany:async(c,keys)=>keys.map(k=>{
      if(k==='pool:trial0')return {_id:'primary/'+k,value:{nextBatchId:3,workers:{0:{leaseUntil:mode==='worker'?200:0}}}};
      if(k==='pool:trial1')return {_id:'primary/'+k,value:{nextBatchId:3001,workers:{0:{leaseUntil:0}}}};
      if(k.startsWith('pool:'))return null;
      assert(k.startsWith('batch:trial0:'),'COMPLETED_GAME_REREAD');
      return mode==='missing'?null:{value:{leaseUntil:mode==='batch'?200:0}};
    })};
}
test('all configured pools and non-complete batches covered without rescanning complete game',async()=>{
  assert.deepEqual(await checkPrimaryLeases({store:fake(),plans,now:()=>100}),{pools:2,workers:2,batches:2});
});
for(const mode of ['worker','batch','missing'])test('lease read rejects '+mode,async()=>{
  await assert.rejects(checkPrimaryLeases({store:fake(mode),plans,now:()=>100}));
});
