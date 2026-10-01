import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {compactRuntimeBinding,compactControlInitializer} from './compact-runtime-binding.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const profile=JSON.parse(fs.readFileSync('config/formal-sessions-rhino-two-20261001.json'));
 const revision=JSON.parse(fs.readFileSync('config/count-runtime-rhino-canary-entryfix-20261002.json'));
 const commit='a'.repeat(40),plan={gameId:32799,countAllocation:profile.activation};
 const receipt={schema:'sg-count-runtime-v2',commit,activation:plan.countAllocation,profileHash:hash(profile),revisionHash:hash(revision),sourceRequests:0,newBetAllowance:0};
 return {plan,profile,revision,receipt,commit};
}
test('compact applies only after immutable applied runtime binds this plan',()=>assert.equal(compactRuntimeBinding(fixture()),true));
test('legacy runtimes retain full control reads',()=>assert.equal(compactRuntimeBinding({revision:{}}),false));
test('independent long runtime may preserve optimization without minting quota',()=>{
 const f=fixture();f.revision.purpose='continuous-count-v1';f.revision.captureMinutes=220;f.receipt.revisionHash=hash(f.revision);assert.equal(compactRuntimeBinding(f),true);
});

test('concurrent entry paths share one immutable receipt read after resource handoff',async()=>{
 const f=fixture(),control={};f.plan.trialId='test';let reads=0,release;
 const resourceReady=new Promise(r=>{release=r;});
 const initialize=compactControlInitializer({...f,runtimeName:'bound.json',resourceReady,control,
   readRevision:()=>f.revision,readProfile:()=>f.profile,readReceipt:async key=>{reads++;assert.equal(key,`count-runtime:test:${f.plan.countAllocation}:${f.commit}`);return f.receipt;}});
 const a=initialize(),b=initialize();assert.equal(a,b);assert.equal(reads,0);assert.equal(control.compact,undefined);
 release();await Promise.all([a,b]);assert.equal(reads,1);assert.equal(control.compact,true);await initialize();assert.equal(reads,1);
});
test('missing applied receipt stays rejected across entry calls without retry or fallback',async()=>{
 const f=fixture(),control={};let reads=0;
 const initialize=compactControlInitializer({...f,runtimeName:'bound.json',resourceReady:Promise.resolve(),control,
   readRevision:()=>f.revision,readProfile:()=>f.profile,readReceipt:async()=>{reads++;return null;}});
 await assert.rejects(initialize(),/COMPACT_RUNTIME_RECEIPT/);await assert.rejects(initialize(),/COMPACT_RUNTIME_RECEIPT/);
 assert.equal(reads,1);assert.equal(control.compact,undefined);
});
test('legacy long runtime does not add immutable journal reads',async()=>{
 const f=fixture(),control={};let reads=0;
 const initialize=compactControlInitializer({...f,runtimeName:'legacy.json',control,readRevision:()=>({}),
   readProfile:()=>{throw Error('unexpected');},readReceipt:async()=>{reads++;}});
 await initialize();assert.equal(reads,0);assert.equal(control.compact,undefined);
});
for(const kind of ['wrong-game','wrong-allocation','unapplied','wrong-commit','changed-revision','unknown-mode','unknown-purpose','missing-gateway','new-quota'])test('reject '+kind,()=>{
 const f=fixture();if(kind==='wrong-game')f.plan.gameId=32718;if(kind==='wrong-allocation')f.plan.countAllocation='b'.repeat(64);
 if(kind==='unapplied')f.receipt=null;if(kind==='wrong-commit')f.commit='b'.repeat(40);if(kind==='changed-revision')f.revision.captureMinutes=31;
 if(kind==='unknown-mode')f.revision.controlReadMode='full-disabled';if(kind==='unknown-purpose')f.revision.purpose='arbitrary';
 if(kind==='missing-gateway')delete f.revision.gatewayHash;if(kind==='new-quota')f.revision.newBetAllowance=1;
 assert.throws(()=>compactRuntimeBinding(f));
});
