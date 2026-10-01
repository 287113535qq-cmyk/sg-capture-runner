import test from 'node:test';import assert from 'node:assert/strict';
import {BatchController} from './batch-controller.mjs';
import {sessionCanarySchedule} from './session-canary.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
function fixture(){
 const profile={schema:'sg-session-layout-rhino-v1',gameId:32799,sessionLayout:{lanesPerHost:2},activation:'a'.repeat(64),completePreserved:100};
 const revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'session-canary-v1',profileHash:hash(profile),activation:profile.activation,
  captureMinutes:32,resourceObservation:'sg-resource-observation-v1',hostResourceObservation:'sg-host-resource-observation-v1',newBetAllowance:0,completePreserved:200,remainingComplete:299800};
 const commit='b'.repeat(40),run='100:1',permit={schema:'sg-count-run-v1',commit,run,profileHash:hash(profile),activation:profile.activation,createdAt:1234,expiresAt:3000000};
 const receipt={schema:'sg-count-runtime-v2',commit,profileHash:hash(profile),activation:profile.activation,revisionHash:hash(revision),newBetAllowance:0,sourceRequests:0};
 const schedule=sessionCanarySchedule({profile,revision,receipt,permit,commit,run});
 const plan={gameId:32799,trialId:'fixture',countAllocation:profile.activation};let at=schedule.secondLaneStartMs,registered=0;
 const store={get:async(c,k)=>({value:k.startsWith('count-run:')?permit:{workers:{}}})};
 const c=new BatchController({store,transport:{},gate:{},analyzer:{},spool:{append(){},confirmed(){}},control:{allowed:async()=>{}},plan,group:'primary',commit,runKey:'capture-run:'+run,now:()=>at});
 c.canarySchedule=schedule;c.pool.countPermission=async()=>({runAdmission:'unique-github-run-v1',activation:profile.activation,profileHash:hash(profile)});
 c.pool.register=async()=>{registered++;return {epoch:1};};c.pendingFirst.admit=async()=>{};
 return {c,permit,schedule,plan,request:{planHash:hash(plan),commitSha:commit,shardId:40},at(v){at=v;},registered:()=>registered};
}
test('actual controller admits all delayed canary slots at the immutable second-lane start',async()=>{
 for(const slot of Array.from({length:20},(_,i)=>40+i)){const f=fixture();f.request.shardId=slot;
  assert.deepEqual(await f.c.rpc('register',f.request),{workerEpoch:1});assert.equal(f.registered(),1);}
});
for(const mode of ['early','late','first-lane','wrong-permit','wrong-commit','missing-schedule','outside-slots'])test('actual controller rejects delayed registration '+mode,async()=>{
 const f=fixture();if(mode==='early')f.at(f.schedule.secondLaneStartMs-1);
 if(mode==='late')f.at(f.schedule.secondLaneStartMs+180000);
 if(mode==='first-lane')f.request.shardId=0;if(mode==='outside-slots')f.request.shardId=80;
 if(mode==='wrong-permit')f.permit.createdAt++;if(mode==='wrong-commit')f.request.commitSha='c'.repeat(40);
 if(mode==='missing-schedule')delete f.c.canarySchedule;
 await assert.rejects(f.c.rpc('register',f.request));assert.equal(f.registered(),0);
});
