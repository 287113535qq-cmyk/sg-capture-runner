import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyFormalCount} from './formal-count-plan.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
import {ACTION_CONTINUOUS_RUNTIME,checkActionContinuousRevision,actionContinuousWindow} from './action-continuous-runtime.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';import {stateWriteInitializer} from './state-write-binding.mjs';
const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-20261002.json','utf8'));
const plan=applyFormalCount(JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),profile)[32721];
function fixture(){
 const commit='a'.repeat(40),previous='b'.repeat(40),revision={schema:'sg-count-runtime-refresh-profile-v1',purpose:'continuous-action-v1',
  gameId:32721,activation:profile.activation,profileHash:hash(profile),planHash:hash(plan),sourceRun:'77:1',fromCommit:previous,
  completePreserved:18913,remainingComplete:280937,newBetAllowance:0,sourceRequests:0,captureMinutes:15,maxWorkers:20,
  lanesPerHost:1,requiresNewSession:true,automaticRelay:false,actionContractHash:profile.actionContractHash,
  controlReadMode:profile.controlReadMode,stateWriteMode:profile.stateWriteMode,gatewayHash:profile.gatewayHash};
 const spec={schema:'sg-complete-count-v1',commit:'c'.repeat(40),activation:profile.activation,profileHash:hash(profile),
  planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId,target:plan.target,sourceRecordsHash:profile.recordsHash};
 const complete={schema:'sg-complete-count-activation-v1',specHash:hash(spec),commit:spec.commit,profileHash:hash(profile),
  planHash:hash(plan),trialId:plan.trialId,sourceRequests:0,completePreserved:16913,remainingComplete:282937};
 const receipt={schema:'sg-count-runtime-v2',commit,fromCommit:spec.commit,previousCommit:previous,specHash:hash(spec),
  profileHash:hash(profile),planHash:hash(plan),activation:profile.activation,revisionHash:hash(revision),sourceRun:'77:1',
  completePreserved:18913,remainingComplete:280937,sourceRequests:0,newBetAllowance:0};
 const key=`complete-count:${plan.trialId}:${profile.activation}`;
 const docs=new Map([[key,spec],[key+':complete',complete],[`count-runtime:${plan.trialId}:${profile.activation}:${commit}`,receipt]]);
 const calls=[],store={async get(c,k){return docs.has(k)?{value:docs.get(k)}:null;},transport:{async request(op){calls.push(op);return {group:'secondary',captureLogicOnServer:false,stateDeltaEnabled:true};}}};
 const permit={schema:'sg-count-run-v1',run:'88:1',commit,activation:profile.activation,profileHash:hash(profile),runtimeRevisionHash:hash(revision),
  completeBefore:18913,remainingComplete:280937,createdAt:1000,expiresAt:901000};
 return {plan,profile,revision,spec,complete,receipt,permit,commit,run:'88:1',docs,store,calls};
}
test('continuous mode uses original activation and new receipt in actual compact and delta initializers',async()=>{
 const f=fixture(),control={};
 await compactControlInitializer({plan,runtimeName:ACTION_CONTINUOUS_RUNTIME,commit:f.commit,resourceReady:Promise.resolve(),
  control,readRevision:()=>f.revision,readProfile:()=>profile,readReceipt:async k=>(await f.store.get('journal',k))?.value})();
 assert.equal(control.compact,true);
 assert.equal(await stateWriteInitializer({store:f.store,commit:f.commit,group:'secondary',runtimeName:ACTION_CONTINUOUS_RUNTIME,
  readProfile:()=>profile,readRevision:()=>f.revision})(plan),true);
 assert.deepEqual(f.calls,['hello']);
 assert.equal(actionContinuousWindow({...f,now:900999}).capture,true);
 assert.equal(actionContinuousWindow({...f,now:901000}).capture,false);
});
for(const [field,value]of Object.entries({newBetAllowance:1,sourceRequests:1,remainingComplete:300000,completePreserved:1,
 maxWorkers:40,lanesPerHost:4,requiresNewSession:false,automaticRelay:true,captureMinutes:240}))
 test('continuous runtime refuses altered '+field,()=>{
  const f=fixture();f.revision[field]=value;assert.throws(()=>checkActionContinuousRevision(f));
 });
test('unbound successor receipt cannot enable metadata writes or extend permit deadline',async()=>{
 const f=fixture();f.receipt.previousCommit='d'.repeat(40);
 await assert.rejects(stateWriteInitializer({store:f.store,commit:f.commit,group:'secondary',runtimeName:ACTION_CONTINUOUS_RUNTIME,
  readProfile:()=>profile,readRevision:()=>f.revision})(plan));
 assert.equal(f.calls.length,0);
 const g=fixture();g.permit.expiresAt++;
 assert.throws(()=>actionContinuousWindow({...g,now:1001}));
});
