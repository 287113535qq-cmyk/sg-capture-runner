import test from 'node:test';
import assert from 'node:assert/strict';
import {stateWriteInitializer} from './state-write-binding.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

function fixture(){
 const commit='a'.repeat(40),activation='b'.repeat(64);
 const plan={trialId:'sg_r1_fixture_32799',gameId:32799,countAllocation:activation,buy:0,phase:1};
 const profile={gameId:32799,activation,stateWriteMode:'versioned-delta-v1'};
 const spec={schema:'sg-complete-count-v1',activation,commit,profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit,profileHash:hash(profile),planHash:hash(plan),trialId:plan.trialId};
 const hello={group:'primary',captureLogicOnServer:false,stateDeltaEnabled:true};
 const calls=[];const store={deltaCas:false,async get(collection,key){calls.push(key);return {value:key.endsWith(':complete')?complete:spec};},transport:{async request(op){calls.push(op);return hello;}}};
 return {plan,profile,spec,complete,hello,store,calls,commit,group:'primary',readProfile:()=>profile};
}
test('new immutable activation enables delta once after complete proof and capability, without writes',async()=>{
 const f=fixture(),init=stateWriteInitializer(f);assert.equal(await init(f.plan),true);assert(f.store.deltaCas);
 assert.equal(f.calls.length,3);await init(f.plan);assert.equal(f.calls.length,3);
 await init({...f.plan,countAllocation:undefined});assert.equal(f.store.deltaCas,false);
});
test('legacy profiles and non-count plans add no remote request',async()=>{
 const f=fixture();delete f.profile.stateWriteMode;const init=stateWriteInitializer(f);
 assert.equal(await init(f.plan),false);assert.equal(f.calls.length,0);assert.equal(f.store.deltaCas,false);
});
for(const kind of ['mode','allocation','profile','commit','plan','complete','capability','group'])test('delta activation refuses '+kind+' and caches rejection without writes',async()=>{
 const f=fixture();
 if(kind==='mode')f.profile.stateWriteMode='arbitrary';
 if(kind==='allocation')f.profile.activation='c'.repeat(64);
 if(kind==='profile')f.spec.profileHash='c'.repeat(64);
 if(kind==='commit')f.spec.commit='c'.repeat(40);
 if(kind==='plan')f.spec.planHash='c'.repeat(64);
 if(kind==='complete')f.complete.specHash='c'.repeat(64);
 if(kind==='capability')f.hello.stateDeltaEnabled=false;
 if(kind==='group')f.hello.group='secondary';
 const init=stateWriteInitializer(f);await assert.rejects(init(f.plan));const count=f.calls.length;
 await assert.rejects(init(f.plan));assert.equal(f.calls.length,count);assert.equal(f.store.deltaCas,false);
});
