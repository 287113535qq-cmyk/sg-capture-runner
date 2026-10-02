import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {applyDemoPilot} from './demo-pilot-plan.mjs';
import {retireReviewedBootstrap,readBootstrapRetirement} from './bootstrap-retirement.mjs';
import {reviewVeryFruityBootstrapFailure} from './bootstrap-failure-review.mjs';
import {veryFruityPayload} from '../trial/veryfruity-session.mjs';
import {DemoFresh} from './demo-fresh.mjs';
import {interruptedBatchBoundary} from './interrupted-batch-boundary.mjs';
const original=JSON.parse(fs.readFileSync('config/demo-pilot-veryfruity-action-revision3-20261003.json'));
const plan=applyDemoPilot(JSON.parse(fs.readFileSync('config/round-one-plans.json')),original)[32812];
function fixture(){
 const now=()=>original.createdAt+1000,commit='a'.repeat(40),run='999:1';
 const spec={schema:'sg-demo-generation-v1',trialId:plan.trialId,gameId:32812,generation:plan.demoGeneration,
  group:'secondary',workerOffset:20,commit:'0258b2f75d643915e92f797df1d9b7c5ae9e3171',run:'37042250269:1',
  planHash:hash(plan),newBetAllowance:100,perWorker:5,workers:20,completePreserved:0,firstBatchId:1,
  createdAt:original.createdAt,expiresAt:original.expiresAt,oldSessions:[],activationStage:{key:`next-demo-game:${plan.trialId}:${plan.demoGeneration}`,profileHash:hash(original)}};
 const payload=veryFruityPayload(plan,'Init','offline-new');
 const xml='<GameResponse type="Init"><Header gameID="20206" versionID="1_0" ccyCode="" lang="en_US" isRecovering="N" sessionID="offline-next"/><Balances><Balance name="CASH_BALANCE" value="1000"/></Balances><Stakes>20|40</Stakes><AccountData/><Paylines><PaylineInfo>'+Array.from({length:20},(_,i)=>`<Payline index="${i}" selectable="${i===19?'Y':'N'}"/>`).join('')+'</PaylineInfo></Paylines></GameResponse>';
 const step={msgId:'Init',requestPayload:payload,responsePayload:xml,responseXml:xml,responseBalance:1000};
 const bootstrap={worker:28,step},bootstrapKey=`bootstrap:${plan.trialId}:1:${hash(step)}`;
 const campaign={group:'secondary',activeGame:32812,enabled:true,validationLimit:5,games:[{game_id:32812,status:'active'}],
  protocolValidation:{phase:'short',generation:plan.demoGeneration,runKey:'capture-run:37045282759:1',commit:spec.commit,demoFresh:hash(spec)}};
 const pool={enabled:true,failure:null,planHash:hash(plan),demoGeneration:{specHash:hash(spec)},confirmed:0,nextBatchId:2,nextSequence:101,
  workers:{28:{sessionHash:hash('old'),leaseUntil:0}}};
 const batch={id:1,worker:28,start:1,end:100,journaled:0,checkpoint:0,epoch:1,pending:null,leaseUntil:0,sessionHash:hash('old'),bootstrapAwaiting:{msgId:'Init',payload}};
 const hold={active:true,reason:'SOURCE_OR_STORAGE_REQUIRES_REVIEW',details:{code:'VERYFRUITY_INIT_STAKES',trialId:plan.trialId,batchId:1}};
 const ended={id:37045282759,run_attempt:1,status:'completed',conclusion:'failure',head_sha:spec.commit,path:'.github/workflows/trial-300k.yml'};
 const input={plan,campaign,pool,batches:[batch],hold,bootstrap,bootstrapKey,ended,now:now()};
 const proof=reviewVeryFruityBootstrapFailure(input);
 const profile={schema:'sg-bootstrap-retirement-profile-v1',planHash:hash(plan),sceneHash:proof.sceneHash,frameHash:proof.frameHash,
  originalCommit:spec.commit,generation:plan.demoGeneration,newBetAllowance:0,retainedBetAllowance:100,createdAt:original.createdAt,expiresAt:original.expiresAt};
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`;
 const docs=new Map([['state/campaign',campaign],['state/pool:'+plan.trialId,pool],['state/batch:'+plan.trialId+':1',batch],
  ['state/global-hold',hold],['journal/'+bootstrapKey,bootstrap],['journal/'+key,spec],
  ['journal/'+key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(spec),commit:spec.commit,run:spec.run}],
  ['journal/'+spec.activationStage.key+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:hash(original),generation:plan.demoGeneration,commit:spec.commit,run:spec.run,newBetAllowance:100,sourceRequests:0}]]);
 let failAt=null;
 const store={get:async(c,k)=>docs.has(c+'/'+k)?{value:structuredClone(docs.get(c+'/'+k))}:null,
  getMany:async(c,keys)=>Promise.all(keys.map(k=>store.get(c,k))),
  create:async(c,k,v)=>{if(k===failAt)throw Error('INJECTED');assert(!docs.has(c+'/'+k));docs.set(c+'/'+k,structuredClone(v));},
  update:async(c,k,fn)=>docs.set(c+'/'+k,fn(structuredClone(docs.get(c+'/'+k))))};
 return {store,docs,spec,input,profile,commit,run,now,transport:{request:async()=>[]},boundary:async()=>{},fail:k=>failAt=k};
}
test('retire full Init, preserve immutable spec and admit all original workers with fresh sessions',async()=>{
 const f=fixture(),originalHash=hash(f.spec),frameHash=hash(f.input.bootstrap),r=await retireReviewedBootstrap(f);
 const campaign=f.docs.get('state/campaign'),spec=f.spec;
 assert.equal(hash(spec),originalHash);assert.equal(hash(f.docs.get('journal/'+f.input.bootstrapKey)),frameHash);
 assert.equal(r.retainedBetAllowance,100);assert.equal(r.newBetAllowance,0);
 assert.equal(f.docs.get('state/global-hold').active,false);
 assert.equal((await readBootstrapRetirement({store:f.store,plan,spec,campaign})).done.firstBatchId,2);
 campaign.protocolValidation.runKey='capture-run:1000:1';
 for(let w=20;w<40;w++){
  const fresh=new DemoFresh({store:f.store,plan,stage:'fresh',runKey:campaign.protocolValidation.runKey,now:f.now});
  assert.deepEqual(await fresh.admit({shardId:w,commitSha:f.commit,sessionHash:hash(w)},w),{stage:'fresh',limit:5});
  assert.equal(fresh.firstBatchId,2);
 }
 const fresh=new DemoFresh({store:f.store,plan,stage:'fresh',runKey:campaign.protocolValidation.runKey,now:f.now});
 await assert.rejects(fresh.admit({shardId:28,commitSha:f.commit,sessionHash:hash('old')},28));
 await assert.rejects(retireReviewedBootstrap(f));
});
test('mismatched scene, expiry, paid records and partial writes cannot unblock source',async()=>{
 for(const mutate of [f=>f.docs.get('state/pool:'+plan.trialId).confirmed=1,
  f=>f.profile.retainedBetAllowance=101,f=>f.now=()=>original.expiresAt,
  f=>f.transport.request=async()=>[{}],
  f=>f.fail(`bootstrap-retirement:${plan.trialId}:${plan.demoGeneration}:complete`)]){
  const f=fixture();mutate(f);await assert.rejects(retireReviewedBootstrap(f));
  assert.equal(f.docs.get('state/global-hold').active,true);
  assert.equal(f.docs.get('journal/'+f.input.bootstrapKey).step.responseXml,f.input.bootstrap.step.responseXml);
 }
});

test('close boundary reuses retired Init proof without rewriting quota or generation',async()=>{
 const f=fixture();await retireReviewedBootstrap(f);
 const campaign=f.docs.get('state/campaign'),specHash=hash(f.spec),before=hash([...f.docs]);
 assert.equal(await interruptedBatchBoundary({store:f.store,plan,spec:f.spec,campaign}),2);
 assert.equal(hash(f.spec),specHash);assert.equal(hash([...f.docs]),before);
 f.docs.get('state/batch:'+plan.trialId+':1').bootstrapRetired.frameHash='0'.repeat(64);
 await assert.rejects(interruptedBatchBoundary({store:f.store,plan,spec:f.spec,campaign}));
 await assert.rejects(interruptedBatchBoundary({store:f.store,plan:{...plan,gameId:32811},spec:f.spec,campaign}));
});
