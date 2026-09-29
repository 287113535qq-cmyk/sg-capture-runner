import test from 'node:test';import assert from 'node:assert/strict';
import {groupBetWindows} from './bet-window.mjs';
const frame=(msg,end=false)=>({msg,session:'offline-only',success:true,end});
const options={validateFrame:f=>f.success===true,sessionOf:f=>f.session,isOrdinaryBet:f=>f.msg==='BET',terminal:steps=>steps.at(-1).end};
test('one successful ordinary BET owns all feature and free continuations',()=>{
 const frames=[frame('BET'),frame('FEATURE_START'),frame('FEATURE_PICK'),frame('FREE_GAME',true),frame('BET',true)];
 const old=structuredClone(frames),r=groupBetWindows(frames,options);
 assert.deepEqual(r.rounds.map(x=>x.steps),[frames.slice(0,4),frames.slice(4)]);assert.deepEqual(r.pending,[]);assert.deepEqual(frames,old);
 assert.equal(r.rounds[0].nextBetIndex,4);assert.equal(r.rounds[1].boundary,'explicit-terminal');
});
test('EOF without explicit terminal remains pending instead of being discarded',()=>{
 const frames=[frame('BET'),frame('FREE_GAME')];const r=groupBetWindows(frames,options);assert.equal(r.rounds.length,0);assert.deepEqual(r.pending,frames);
});
test('next BET cannot bless an unsettled previous round',()=>{assert.throws(()=>groupBetWindows([frame('BET'),frame('BET',true)],options),/NOT_SETTLED/);});
for(const [name,frames,pattern] of [
 ['mixed session',[frame('BET',true),{...frame('BET',true),session:'other'}],/MIXED_SESSION/],
 ['source rejection',[{...frame('BET'),success:false}],/UNVALIDATED_FRAME/],
 ['orphan continuation',[frame('FREE_GAME',true)],/ORPHAN_CONTINUATION/]
])test(name,()=>assert.throws(()=>groupBetWindows(frames,options),pattern));
test('unknown terminal value is not truthy authorization',()=>{const f={...frame('BET'),end:'unknown'};assert.equal(groupBetWindows([f],options).rounds.length,0);});
