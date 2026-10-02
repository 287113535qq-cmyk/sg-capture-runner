import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {DemoFresh} from './demo-fresh.mjs';import {rebindVeryFruityZero} from './veryfruity-zero-source.mjs';import {demoRuntimeCommit} from './demo-runtime.mjs';
const original=JSON.parse(fs.readFileSync('config/demo-pilot-veryfruity-action-revision3-20261003.json'));
const plan=applyDemoPilot(JSON.parse(fs.readFileSync('config/round-one-plans.json')),original)[32812];
function fixture(){
 const commit='1ce222b8b42ac0da116f599e0ea931b9fa8ec309',generation=plan.demoGeneration,now=()=>original.createdAt+1000;
 const activation=`next-demo-game:${plan.trialId}:${generation}`,key=`demo-generation:${plan.trialId}:${generation}`;
 const spec={schema:'sg-demo-generation-v1',trialId:plan.trialId,gameId:32812,generation,group:'secondary',workerOffset:20,commit,run:'37042250269:1',planHash:hash(plan),newBetAllowance:100,perWorker:5,workers:20,completePreserved:0,firstBatchId:1,createdAt:original.createdAt,expiresAt:original.expiresAt,oldSessions:[],activationStage:{key:activation,profileHash:hash(original)}};
 const campaign={group:'secondary',activeGame:32812,enabled:true,validationLimit:5,games:[{game_id:32812,status:'active'}],protocolValidation:{phase:'short',commit,generation,runKey:'capture-run:37043477601:1',demoFresh:hash(spec)}};
 const pool={enabled:true,failure:null,planHash:hash(plan),demoGeneration:{specHash:hash(spec)},nextSequence:1,nextBatchId:1,confirmed:0,workers:{}};
 const docs=new Map([['state/campaign',campaign],['state/pool:'+plan.trialId,pool],['journal/'+key,spec],['journal/'+key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit,run:spec.run}],['journal/'+activation+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:hash(original),generation,commit,run:spec.run,newBetAllowance:100,sourceRequests:0}]]);
 const evidence=Array.from({length:20},(_,i)=>({shardId:20+i,trialId:plan.trialId,gameId:32812,runtimeGameId:33172,sourceRequests:0,paidRoundRequests:0,completedThisRun:0,error:'DEMO_FRESH_GROUP_CHANGED',logHash:hash(i)}));
 const profile={schema:'sg-veryfruity-zero-source-runtime-v1',gameId:32812,group:'secondary',sourceRunKey:campaign.protocolValidation.runKey,originalCommit:commit,sourceProfileHash:hash(original),generation,planHash:hash(plan),expiresAt:original.expiresAt,createdAt:original.createdAt,evidenceHash:hash(evidence),newBetAllowance:0,retainedBetAllowance:100,sceneHash:hash({campaign,pool})};
 const store={get:async(c,k)=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null,getMany:async(c,keys)=>Promise.all(keys.map(k=>store.get(c,k))),create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,structuredClone(v));},update:async(c,k,fn)=>docs.set(c+'/'+k,fn(structuredClone(docs.get(c+'/'+k))))};
 return {docs,store,transport:{request:async()=>[]},plan,profile,original,evidence,boundary:async()=>{},commit:'a'.repeat(40),run:'999:1',now};
}
test('zero-source entry correction preserves spec and 100 budget then admits all twenty secondary workers',async()=>{
 const f=fixture(),key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`,before=hash(f.docs.get('journal/'+key));
 await rebindVeryFruityZero(f);const c=f.docs.get('state/campaign'),s=f.docs.get('journal/'+key);
 assert.equal(hash(s),before);assert.equal(await demoRuntimeCommit({store:f.store,plan,spec:s,campaign:c}),f.commit);
 c.protocolValidation.runKey='capture-run:1000:1';
 for(let worker=20;worker<40;worker++){
  const fresh=new DemoFresh({store:f.store,plan,stage:'fresh',runKey:c.protocolValidation.runKey,now:f.now});
  assert.deepEqual(await fresh.admit({shardId:worker,commitSha:f.commit,sessionHash:hash(worker)},worker),{stage:'fresh',limit:5});
 }
 assert.equal(f.docs.get('state/pool:'+plan.trialId).nextBatchId,1);
 await assert.rejects(rebindVeryFruityZero(f));
});
test('paid requests, missing workers, changed scene and existing records never allow zero-source correction',async()=>{
 for(const mutate of [f=>f.evidence[0].sourceRequests=1,f=>f.evidence.pop(),f=>f.docs.get('state/pool:'+plan.trialId).confirmed=1,f=>f.transport.request=async()=>[{}]]){
  const f=fixture();mutate(f);f.profile.evidenceHash=hash(f.evidence);await assert.rejects(rebindVeryFruityZero(f));
  assert(![...f.docs.keys()].some(k=>k.includes('rebind:')));
 }
});
