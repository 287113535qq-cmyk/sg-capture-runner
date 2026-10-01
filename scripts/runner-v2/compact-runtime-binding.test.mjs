import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {compactRuntimeBinding,compactLayoutBinding,compactControlInitializer} from './compact-runtime-binding.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {countControlPolicy} from './count-control-policy.mjs';
import {fourReadRecoveryName,fourReadRecoveryEntryName,fourReadRecoveryMinutes} from './four-read-recovery-runtime.mjs';
function fixture(){
 const profile=JSON.parse(fs.readFileSync('config/formal-sessions-rhino-two-20261001.json'));
 const revision=JSON.parse(fs.readFileSync('config/count-runtime-rhino-canary-entryfix-20261002.json'));
 const commit='a'.repeat(40),plan={gameId:32799,countAllocation:profile.activation};
 const receipt={schema:'sg-count-runtime-v2',commit,activation:plan.countAllocation,profileHash:hash(profile),revisionHash:hash(revision),sourceRequests:0,newBetAllowance:0};
 return {plan,profile,revision,receipt,commit};
}
test('four-read recovery reaches both count admission and the actual compact initializer',async()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-sessions-rhino-four-20261001.json'));
 const revision=JSON.parse(fs.readFileSync('config/count-runtime-rhino-four-read-recovery-20261002.json'));
 const commit='a'.repeat(40),plan={gameId:32799,trialId:'sg_r1_20261001_32799',countAllocation:profile.activation};
 const receipt={schema:'sg-count-runtime-v2',commit,activation:profile.activation,profileHash:hash(profile),revisionHash:hash(revision),initialReadFailureHash:revision.initialReadFailureHash,sourceRequests:0,newBetAllowance:0};
 for(const runtimeName of [fourReadRecoveryName,fourReadRecoveryEntryName]){
  for(const mode of ['refresh','admit'])assert(countControlPolicy(mode,profile,runtimeName).fourReadRecovery);
  assert.equal(fourReadRecoveryMinutes(profile,revision,receipt,commit),20);
  const control={};let reads=0;
  await compactControlInitializer({plan,runtimeName,commit,resourceReady:Promise.resolve(),readRevision:()=>revision,
   readProfile:()=>profile,readReceipt:async()=>{reads++;return receipt;},control})();
  assert.equal(reads,1);assert.equal(control.compact,true);
 }
 assert.throws(()=>compactRuntimeBinding({plan,profile,revision,receipt:{...receipt,initialReadFailureHash:null},commit}),/COMPACT_INITIAL_READ_FAILURE_BINDING/);
 assert.throws(()=>compactRuntimeBinding({plan,profile,revision:{...revision,captureMinutes:220},receipt,commit}));
 const entry=fs.readFileSync('scripts/runner-v2/campaign-worker.mjs','utf8');
 assert(entry.includes('[fourReadRecoveryName,fourReadRecoveryEntryName,'));assert(entry.includes('if(isFourReadRecoveryName(process.env.SG_COUNT_RUNTIME_PROFILE))'));
});
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
function layoutFixture(){
 const f=fixture();f.profile.sessionLayout.lanesPerHost=4;f.profile.controlReadMode='compact-worker-v1';f.profile.gatewayHash='c'.repeat(64);
 f.plan={...f.plan,trialId:'sg_r1_20261001_32799',target:300000,phase:1,buy:0};
 f.spec={schema:'sg-complete-count-v1',activation:f.plan.countAllocation,commit:f.commit,profileHash:hash(f.profile),planHash:hash(f.plan),trialId:f.plan.trialId,gameId:32799};
 f.complete={schema:'sg-complete-count-activation-v1',specHash:hash(f.spec),commit:f.commit,profileHash:hash(f.profile),planHash:hash(f.plan),trialId:f.plan.trialId,sourceRequests:0,newBetAllowance:0};return f;
}
test('new four-session window keeps compact reads through its applied layout receipt',()=>assert.equal(compactLayoutBinding(layoutFixture()),true));
for(const kind of ['incomplete-activation','wrong-commit','changed-profile','changed-plan','unbound-spec'])test('four-session compact layout rejects '+kind,()=>{
 const f=layoutFixture();if(kind==='incomplete-activation')f.complete=null;if(kind==='wrong-commit')f.commit='b'.repeat(40);
 if(kind==='changed-profile')f.profile.gatewayHash='d'.repeat(64);if(kind==='changed-plan')f.plan.target=300001;
 if(kind==='unbound-spec')f.complete.specHash='0'.repeat(64);assert.throws(()=>compactLayoutBinding(f));
});
test('initial four-session entry reads both activation documents once and checks full binding',async()=>{
 const f=layoutFixture(),control={},keys=[];
 const init=compactControlInitializer({...f,control,resourceReady:Promise.resolve(),readProfile:()=>f.profile,
   readReceipt:async key=>{keys.push(key);return key.endsWith(':complete')?f.complete:f.spec;}});
 await init();await init();assert.equal(keys.length,2);assert.equal(control.compact,true);
});
test('four-session continuous runtime retains compact mode with its own applied revision',()=>{
 const f=fixture();f.profile.sessionLayout.lanesPerHost=4;f.revision.purpose='continuous-four-count-v1';f.revision.profileHash=hash(f.profile);
 f.receipt.profileHash=hash(f.profile);f.receipt.revisionHash=hash(f.revision);assert.equal(compactRuntimeBinding(f),true);
});
for(const kind of ['wrong-game','wrong-allocation','unapplied','wrong-commit','changed-revision','unknown-mode','unknown-purpose','missing-gateway','new-quota'])test('reject '+kind,()=>{
 const f=fixture();if(kind==='wrong-game')f.plan.gameId=32718;if(kind==='wrong-allocation')f.plan.countAllocation='b'.repeat(64);
 if(kind==='unapplied')f.receipt=null;if(kind==='wrong-commit')f.commit='b'.repeat(40);if(kind==='changed-revision')f.revision.captureMinutes=31;
 if(kind==='unknown-mode')f.revision.controlReadMode='full-disabled';if(kind==='unknown-purpose')f.revision.purpose='arbitrary';
 if(kind==='missing-gateway')delete f.revision.gatewayHash;if(kind==='new-quota')f.revision.newBetAllowance=1;
 assert.throws(()=>compactRuntimeBinding(f));
});
