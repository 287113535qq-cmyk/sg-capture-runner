import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceControl} from './control.mjs';

test('the first global fault survives cascading peer shutdown errors',async()=>{
  let value={active:false,reason:null};
  const store={update:async(c,k,change)=>{value=change(structuredClone(value))||value;}};
  const control=new SourceControl({store});
  await control.halt('SOURCE_OR_STORAGE_REQUIRES_REVIEW',{code:'SOURCE_NETWORK_OUTCOME_UNKNOWN',batchId:81});
  const original=structuredClone(value);
  await control.halt('SOURCE_OR_STORAGE_REQUIRES_REVIEW',{code:'GLOBAL_SOURCE_STOPPED',batchId:185});
  assert.deepEqual(value,original);
});
test('a protocol-paused pool blocks further requests even while the group remains enabled',async()=>{
  const plan={trialId:'trial',gameId:32723};let pool={enabled:true,failure:null};
  const control=new SourceControl({plan,store:{writable:async()=>{},get:async(c,k)=>({value:k==='campaign'?{enabled:true,activeGame:32723}:pool})},
    transport:{request:async()=>[{_id:'primary/global-hold',value:{active:false}},{_id:'secondary/global-hold',value:{active:false}},
      {_id:'primary/campaign',value:{enabled:true,activeGame:32723}},{_id:'primary/pool:trial',value:pool}]},
    gate:{status:()=>({metrics:{diskFreeBytes:100*1024**3}})}});
  await control.allowed({newRound:true});pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED'};
  await assert.rejects(control.allowed({newRound:true}),{code:'POOL_PAUSED'});
  await assert.rejects(control.allowed(),{code:'POOL_PAUSED'});
});
