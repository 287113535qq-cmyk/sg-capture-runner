import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
import {compactRepairBinding,compactControlInitializer} from './compact-runtime-binding.mjs';
function fixture(){
 const plan={gameId:32721,trialId:'sg_r1_20260928_32721',target:299850,buy:0,phase:1,countAllocation:'a'.repeat(64)};
 const profile={schema:'sg-formal-repair-pyramids-v5',gameId:32721,group:'secondary',activation:plan.countAllocation,
  controlReadMode:'compact-worker-v1',gatewayHash:'b'.repeat(64),stateWriteMode:'versioned-delta-v1',
  completePreserved:5000,remainingComplete:294850,historicalBaseline:150,totalTarget:300000,recordsHash:'c'.repeat(64)};
 const commit='d'.repeat(40),spec={schema:'sg-complete-count-v1',activation:plan.countAllocation,commit,profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,gameId:32721,target:299850,sourceRecordsHash:profile.recordsHash};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit,profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,sourceRequests:0,completePreserved:5000,remainingComplete:294850};return {plan,profile,commit,spec,complete};
}
test('new repaired allocation enables worker projection only through exact completed activation',async()=>{
 const f=fixture();assert.equal(compactRepairBinding(f),true);let reads=0;const control={};
 const init=compactControlInitializer({...f,control,resourceReady:Promise.resolve(),readProfile:()=>f.profile,readReceipt:async k=>{reads++;return k.endsWith(':complete')?f.complete:f.spec;}});
 await init();await init();assert.equal(reads,2);assert.equal(control.compact,true);
});
for(const kind of ['old-profile','foreign-game','quota','unapplied','wrong-runtime','changed-profile','different-records','partial-complete'])test('compact repaired allocation refuses '+kind,()=>{
 const f=fixture();if(kind==='old-profile')f.profile.schema='sg-formal-repair-pyramids-v4';
 if(kind==='foreign-game')f.plan.gameId=32799;if(kind==='quota')f.profile.remainingComplete++;
 if(kind==='unapplied')f.complete=null;if(kind==='wrong-runtime')f.commit='e'.repeat(40);
 if(kind==='changed-profile')f.profile.gatewayHash='f'.repeat(64);
 if(kind==='different-records')f.spec.sourceRecordsHash='0'.repeat(64);
 if(kind==='partial-complete')f.complete.completePreserved--;
 assert.throws(()=>compactRepairBinding(f));
});
