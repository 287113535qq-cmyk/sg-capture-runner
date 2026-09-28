import test from 'node:test';
import assert from 'node:assert/strict';
import {SourceControl} from './control.mjs';
test('a protocol-paused pool blocks further requests even while the group remains enabled',async()=>{
  const plan={trialId:'trial',gameId:32723};let pool={enabled:true,failure:null};
  const control=new SourceControl({plan,store:{writable:async()=>{},get:async(c,k)=>({value:k==='campaign'?{enabled:true,activeGame:32723}:pool})},
    transport:{request:async()=>[{value:{active:false}},{value:{active:false}}]},
    gate:{status:()=>({metrics:{diskFreeBytes:100*1024**3}})}});
  await control.allowed({newRound:true});pool={enabled:false,failure:'PROTOCOL_VALIDATION_FAILED'};
  await assert.rejects(control.allowed({newRound:true}),{code:'POOL_PAUSED'});
  await assert.rejects(control.allowed(),{code:'POOL_PAUSED'});
});
