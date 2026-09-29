import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPrimaryLeases} from './lease-boundary.mjs';
const plans=Object.fromEntries(Array.from({length:178},(_,i)=>[i,{gameId:i,trialId:'trial'+i}]));
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
