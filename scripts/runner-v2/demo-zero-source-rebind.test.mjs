import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';import {rebindZeroSource} from './demo-zero-source-rebind.mjs';import {DemoFresh} from './demo-fresh.mjs';
function fixture(){
 const plan={trialId:'synthetic-zero',gameId:32636,runtimeGameId:33085,demoGeneration:'a'.repeat(64)},commit='b'.repeat(40),runtime='c'.repeat(40),sourceRunKey='capture-run:10:1';
 const spec={schema:'sg-demo-generation-v1',trialId:plan.trialId,gameId:plan.gameId,generation:plan.demoGeneration,planHash:hash(plan),commit,run:'9:1',createdAt:0,expiresAt:7200000,firstBatchId:1,newBetAllowance:100,workers:20,perWorker:5,completePreserved:0,oldSessions:[]};
 const campaign={enabled:true,activeGame:plan.gameId,validationLimit:5,games:[{game_id:plan.gameId,status:'active'}],protocolValidation:{phase:'short',commit,runKey:sourceRunKey,generation:plan.demoGeneration,demoFresh:hash(spec)}};
 const pool={enabled:true,planHash:hash(plan),failure:null,nextSequence:1,nextBatchId:1,confirmed:0,workers:{},demoGeneration:{specHash:hash(spec)}};
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`,docs=new Map([['state/campaign',campaign],['state/pool:'+plan.trialId,pool],['journal/'+key,spec],['journal/'+key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit,run:'9:1'}]]);let failAt;
 const get=(c,k)=>{const v=docs.get(c+'/'+k);return v===undefined?null:{value:structuredClone(v)};},store={get:async(c,k)=>get(c,k),getMany:async(c,keys)=>keys.map(k=>get(c,k)),create:async(c,k,v)=>{assert(k!==failAt,'INJECTED_FAILURE');assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,structuredClone(v));},update:async(c,k,fn)=>docs.set(c+'/'+k,fn(structuredClone(docs.get(c+'/'+k))))};
 const evidence=Array.from({length:20},(_,shardId)=>({shardId,trialId:plan.trialId,gameId:plan.gameId,runtimeGameId:plan.runtimeGameId,sourceRequests:0,paidRoundRequests:0,completedThisRun:0,error:'ERR_ASSERTION'}));
 const profile={schema:'sg-demo-zero-source-rebind-v1',planHash:hash(plan),evidenceHash:hash(evidence),originalCommit:commit,sourceRunKey,createdAt:100,expiresAt:7200000,sceneHash:hash({campaign,pool})};
 const args={store,transport:{request:async()=>[]},plan,profile,evidence,boundary:async()=>{},commit:runtime,run:'11:1',now:()=>100};
 const admit=()=>new DemoFresh({store,plan,stage:'fresh',runKey:'capture-run:12:1',now:()=>100}).admit({shardId:0,sessionHash:'synthetic-new',commitSha:runtime},0);
 return {args,docs,plan,spec,key,admit,fail:k=>failAt=k};
}
test('zero-source runtime rebind preserves generation, original allowance and immutable spec',async()=>{
 const f=fixture(),before=hash(f.spec),result=await rebindZeroSource(f.args);assert.equal(result.newBetAllowance,0);assert.equal(result.retainedBetAllowance,100);assert.equal(hash(f.docs.get('journal/'+f.key)),before);
 f.docs.get('state/campaign').protocolValidation.runKey='capture-run:12:1';assert.equal((await f.admit()).limit,5);await assert.rejects(rebindZeroSource(f.args));
});
test('any prior activity, log disagreement, changed expiration or incomplete final proof refuses admission',async()=>{
 for(const reason of ['worker','batch','round','receipt','log','expiration','partial']){
  const f=fixture();
  if(reason==='worker')f.docs.get('state/pool:'+f.plan.trialId).workers={0:{leaseUntil:0}};
  if(reason==='batch')f.docs.set('state/batch:'+f.plan.trialId+':4',{});
  if(reason==='round'||reason==='receipt')f.args.transport.request=async op=>op===(reason==='round'?'rounds_scan':'scan')?[{}]:[];
  if(reason==='log'){f.args.evidence[0].sourceRequests=1;f.args.profile.evidenceHash=hash(f.args.evidence);}
  if(reason==='expiration')f.args.profile.expiresAt++;
  if(reason==='partial')f.fail(`demo-zero-source-rebind:${f.plan.trialId}:${f.plan.demoGeneration}:complete`);
  await assert.rejects(rebindZeroSource(f.args));f.docs.get('state/campaign').protocolValidation.runKey='capture-run:12:1';await assert.rejects(f.admit());
 }
});
test('tampered runtime proof cannot change quota, generation, original code or retained expiration',async()=>{
 for(const [field,value] of [['retainedBetAllowance',101],['newBetAllowance',100],['originalCommit','d'.repeat(40)],['generation','d'.repeat(64)],['expiresAt',7200001]]){
  const f=fixture();await rebindZeroSource(f.args);const p=f.docs.get('state/campaign').protocolValidation;p.runKey='capture-run:12:1';f.docs.get('journal/'+p.runtimeRebind.key+':complete')[field]=value;await assert.rejects(f.admit());
 }
});
