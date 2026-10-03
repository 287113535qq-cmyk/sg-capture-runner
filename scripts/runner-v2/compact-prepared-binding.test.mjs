import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {compactPreparedBinding,PREPARED_COMPACT_GATEWAY_HASH} from './compact-prepared-binding.mjs';
import {compactControlInitializer} from './compact-runtime-binding.mjs';
import {preparedCountPlan} from './prepared-count-plan.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';

function fixture(){
 const profile=JSON.parse(fs.readFileSync('config/formal-prepared-count-32714-8a3dd824426749d275ee65dce3ca398a34aeadef53f0d0505bc0ed687b0ff7aa.json','utf8'));
 profile.controlReadMode='compact-worker-v1';profile.gatewayHash=PREPARED_COMPACT_GATEWAY_HASH;
 const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))[32714];
 const auth=JSON.parse(fs.readFileSync('config/prepared-count-authorizations.json','utf8')).profiles[
  'formal-prepared-count-32714-8a3dd824426749d275ee65dce3ca398a34aeadef53f0d0505bc0ed687b0ff7aa.json'];
 auth.profileHash=hash(profile);const plan=preparedCountPlan(base,profile,auth),commit='a'.repeat(40);
 const spec={schema:'sg-complete-count-v1',commit,activation:plan.countAllocation,profileHash:hash(profile),
  planHash:hash(plan),trialId:plan.trialId,gameId:plan.gameId,sourceRecordsHash:profile.recordsHash,
  preparationProofHash:profile.preparationProofHash};
 const complete={schema:'sg-complete-count-activation-v1',commit,specHash:hash(spec),profileHash:hash(profile),
  planHash:hash(plan),trialId:plan.trialId,sourceRequests:0,newBetAllowance:0};
 return {profile,plan,commit,spec,complete};
}

test('Huff projection requires its reviewed profile, exact installed native file and completed allocation',()=>{
 const f=fixture();assert.equal(compactPreparedBinding(f),true);
});
for(const cause of ['legacy','native','game','plan','proof','unapplied','commit','quota'])test('Huff projection refuses '+cause,()=>{
 const f=fixture();if(cause==='legacy')delete f.profile.controlReadMode;
 if(cause==='native')f.profile.files['service/mongo_only_gateway.py']='b'.repeat(64);
 if(cause==='game')f.plan.gameId=32799;if(cause==='plan')f.plan.target=300001;
 if(cause==='proof')f.spec.preparationProofHash='b'.repeat(64);if(cause==='unapplied')f.complete=null;
 if(cause==='commit')f.commit='b'.repeat(40);if(cause==='quota')f.profile.newBetAllowance=1;
 assert.throws(()=>compactPreparedBinding(f));
});

test('initial prepared projection waits for resources and reads both immutable acknowledgements once',async()=>{
 const f=fixture(),control={},keys=[];let release;
 const ready=new Promise(r=>{release=r;});
 const init=compactControlInitializer({...f,control,resourceReady:ready,readProfile:()=>f.profile,
  readReceipt:async key=>{keys.push(key);return key.endsWith(':complete')?f.complete:f.spec;}});
 const pending=init();assert.equal(control.compact,undefined);assert.equal(keys.length,0);
 release();await pending;await init();assert.equal(keys.length,2);assert.equal(control.compact,true);
});

test('registered healthy runtime retains projection through its own receipt without a new allocation',async()=>{
 const f=fixture(),revision={schema:'sg-prepared-settled-runtime-v1',revisionId:'d'.repeat(64),
  activation:f.profile.activation,profileHash:hash(f.profile),gameId:32714,sourceRequests:0,newBetAllowance:0};
 const runtimeName=`count-prepared-runtime-32714-${revision.revisionId}.json`,commit='b'.repeat(40);
 const receipt={schema:'sg-count-runtime-v2',commit,activation:f.profile.activation,specHash:hash(f.spec),
  planHash:hash(f.plan),profileHash:hash(f.profile),revisionHash:hash(revision),sourceRequests:0,newBetAllowance:0};
 for(const corrupt of [false,true]){
  const control={},keys=[];
  const init=compactControlInitializer({...f,commit,runtimeName,control,resourceReady:Promise.resolve(),
   readProfile:()=>f.profile,readRevision:()=>revision,readReceipt:async key=>{
    keys.push(key);return key.startsWith('count-runtime:')?(corrupt?null:receipt):key.endsWith(':complete')?f.complete:f.spec;}});
  if(corrupt){await assert.rejects(init(),/RUNTIME_RECEIPT/);await assert.rejects(init());assert.equal(control.compact,undefined);}
  else {await init();assert.equal(control.compact,true);}
  assert.equal(keys.length,3);
 }
});

test('previous prepared runtimes retain full reads and perform no extra receipt requests',async()=>{
 const f=fixture(),control={};delete f.profile.controlReadMode;let reads=0;
 await compactControlInitializer({...f,runtimeName:'count-prepared-runtime-32714-legacy.json',control,
  readProfile:()=>f.profile,readRevision:()=>({}),readReceipt:async()=>{reads++;}})();
 assert.equal(reads,0);assert.equal(control.compact,undefined);
});
