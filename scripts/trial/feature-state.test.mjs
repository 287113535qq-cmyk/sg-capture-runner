import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import * as runner from './feature-state.mjs';
const collector=createRequire(import.meta.url)('../../collector/feature-state.cjs');
for(const [name,{parseFeatureHistory:history,checkFeatureWallet:wallet,parseFeatureValues:values}] of [['runner',runner],['collector',collector]]){
 test(name+': fractional display values retain exact lexemes and sentinels require explicit scope',()=>{
  assert.deepEqual(values('0|1.5|3.00',{size:3}),['0','1.5','3.00']);
  assert.deepEqual(values('0|-100.0',{size:2,negativeSentinels:[-100]}),['0','-100.0']);
  for(const bad of ['NaN','1e3','01','1.0000001','1000000.000001','-1','-100','1\n','1|2','-0'])assert.throws(()=>values(bad,{size:1}));
  assert.throws(()=>values('1.5',{size:1,decimalPlaces:0}));
 });
 test(name+': ordered repeats preserve reviewed scope',()=>{
  assert.deepEqual(history('1|1|2|1|',[1,2]),[1,1,2,1]);
  assert.deepEqual(history('',[1],{allowEmpty:true}),[]);
  for(const bad of ['', '1||', '01|', '1|3', '1|'.repeat(101)])assert.throws(()=>history(bad,[1,2]));
 });
 test(name+': pending wins and settled wallet are separate',()=>{
  assert.deepEqual(wallet(144400,500,147900,143900,4000,{settled:false,responseBalance:143900}),{uncreditedWin:4000});
  assert.deepEqual(wallet(144400,500,147900,147900,4000,{settled:true,responseBalance:147900}),{uncreditedWin:0});
  assert.throws(()=>wallet(144400,500,147900,143900,4000,{settled:true}));
  for(const [args,opt]of [
   [[144400,500,147901,143900,4000],{settled:false}],
   [[144400,500,147900,144000,4000],{settled:false}],
   [[144400,500,147900,143900,4000],{settled:false,responseBalance:147900}],
   [[144400,500,147900,143900,4000],{}],
   [[144400,500,147900,143900,true],{settled:false}],
  ])assert.throws(()=>wallet(...args,opt));
 });
}
