import test from 'node:test';import assert from 'node:assert/strict';
import {closeDemoPilot,pilotCloseKey,pilotCloseScene,readClosedPilot} from './demo-pilot-close.mjs';
import {reviewSpentDemoGeneration} from './demo-spent-generation.mjs';import {checkDemoSourceEnded} from './demo-source-ended.mjs';
import {RunnerState,RunnerPool} from './state-store.mjs';import {DemoFresh} from './demo-fresh.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';

// Real state CAS/closure/admission, synthetic source records and parser.
async function fixture(){
 const basePlan={trialId:'close-fixture',gameId:32720,phase:1,buy:0},plan={...basePlan,demoGeneration:'a'.repeat(64)},docs=new Map(),mongo=new Map();
 const key=`demo-generation:${plan.trialId}:${plan.demoGeneration}`,top=`next-demo-game:${plan.trialId}:${plan.demoGeneration}`;
 const parent={schema:'sg-demo-generation-v1',trialId:plan.trialId,generation:plan.demoGeneration,gameId:plan.gameId,planHash:hash(plan),firstBatchId:1,workers:20,perWorker:5,newBetAllowance:100,commit:'b'.repeat(40),run:'1:1',activationStage:{key:top,profileHash:'c'.repeat(64)},createdAt:0,expiresAt:7200000,oldSessions:[]};
 const put=(c,k,v)=>docs.set(c+'/'+k,{_id:'primary/'+k,version:0,value:structuredClone(v)});
 put('journal',key,parent);put('journal',key+':complete',{schema:'sg-demo-generation-complete-v1',specHash:hash(parent),commit:parent.commit,run:parent.run});
 put('journal',top+':complete',{schema:'sg-next-demo-game-complete-v1',profileHash:parent.activationStage.profileHash,commit:parent.commit,run:parent.run,generation:plan.demoGeneration,newBetAllowance:100,sourceRequests:0});
 const pool={enabled:true,failure:null,nextBatchId:20,planHash:hash(plan),demoGeneration:{specHash:hash(parent)},workers:{}};
 let id=0;
 for(let w=0;w<20;w++)if(w!==18){
  id++;const start=(id-1)*100+1,b={id,worker:w,start,end:start+99,journaled:start+4,checkpoint:start+4,leaseUntil:0,sessionHash:hash('session'+w),pending:null};
  pool.workers[w]={sessionHash:b.sessionHash,leaseUntil:0,activeBatch:{id,worker:w,start,end:b.end},owner:'done'};put('state',`batch:${plan.trialId}:${id}`,b);
  for(let n=start;n<start+5;n++){const r={_id:hash('record'+n),trialId:plan.trialId,batchId:id,shardId:w,sequence:n,sourceSessionHash:b.sessionHash,raw:{steps:[{msgId:'BET'}],synthetic:true}};
   put('journal',receiptKey(plan.trialId,n),r);mongo.set(r._id,r);}
 }
 put('state','pool:'+plan.trialId,pool);put('state','campaign',{enabled:true,activeGame:plan.gameId,validationLimit:5,games:[{game_id:plan.gameId,status:'active'}],protocolValidation:{phase:'short',runKey:'capture-run:2:1',commit:parent.commit,generation:plan.demoGeneration,demoFresh:hash(parent)}});
 let failure=null,casConflict=false;
 const transport={request:async(op,p)=>{
  if(op==='resources')return {};if(op==='rounds_read')return p.ids.map(id=>structuredClone(mongo.get(id))).filter(Boolean);
  const k=p.collection+'/'+p.key,r=docs.get(k);
  if(op==='read')return structuredClone(r??null);
  if(op==='read_many')return p.keys.map(k=>docs.get(p.collection+'/'+k)).filter(Boolean).map(r=>structuredClone(r));
  if(op==='create'){assert(p.key!==failure,'INJECTED_WRITE_FAILURE');if(r)return {created:false};put(p.collection,p.key,p.value);return {created:true};}
  if(op==='cas'){if(casConflict||r.version!==p.version)return {replaced:false};docs.set(k,{...r,version:r.version+1,value:structuredClone(p.value)});return {replaced:true,version:r.version+1};}
  throw Error('FORBIDDEN_'+op);
 }};
 const store=new RunnerState({transport,gate:{observe(){},status:()=>({allowed:true})}}),parser={call:async({record})=>({verified:record.raw.synthetic===true})};
 const profile={schema:'sg-demo-pilot-close-v1',planHash:hash(plan),sourceSpecHash:hash(parent),sourceProfileHash:parent.activationStage.profileHash,sourceRunKey:'capture-run:2:1',sourceCommit:parent.commit,sourceConclusion:'failure',usedByWorker:Array.from({length:20},(_,w)=>w===18?0:5),completePreserved:95,newBetAllowance:0,createdAt:0,expiresAt:7200000};
 profile.sceneHash=hash(await pilotCloseScene(store,plan));
 const args={store,transport,parser,basePlan,plan,profile,boundary:async()=>{},commit:'d'.repeat(40),run:'3:1',now:()=>100};
 const source=async()=>{const s=await pilotCloseScene(store,plan),closed=(await store.get('journal',pilotCloseKey(plan)+':complete'))?.value;
  return {store,parser,basePlan,fromPlan:plan,profile:{...profile,sourceClosureHash:closed&&hash(closed)},scene:{campaign:s.campaign,fromPool:s.pool,sourceBatches:s.batches},now:args.now};};
 return {args,docs,mongo,key:pilotCloseKey(plan),source,fail:k=>failure=k,conflict:()=>casConflict=true,rebind:async()=>profile.sceneHash=hash(await pilotCloseScene(store,plan))};
}

test('real CAS closes95 used plus5 foregone, preserves batches/journal, and cannot source again',async()=>{
 const f=await fixture(),old=new Map([...f.docs].map(([k,v])=>[k,hash(v.value)])),r=await closeDemoPilot(f.args);
 assert.equal(r.used,95);assert.equal(r.foregone,5);assert.equal(r.newBetAllowance,0);
 for(const [k,h] of old)if(k!=='state/pool:'+f.args.plan.trialId)assert.equal(hash(f.docs.get(k).value),h);
 const review=await reviewSpentDemoGeneration(await f.source());assert.equal(review.spent,95);assert.equal(review.foregone,5);assert.equal(review.verified,95);
 await assert.rejects(new RunnerPool({store:f.args.store,plan:f.args.plan,group:'primary'}).register(18,{owner:'new',sessionHash:hash('new')}),/POOL_PAUSED/);
 await assert.rejects(new DemoFresh({store:f.args.store,plan:f.args.plan,stage:'fresh',runKey:'capture-run:2:1',now:f.args.now}).admit({shardId:18,sessionHash:hash('new'),commitSha:'b'.repeat(40)},18),/POOL_CHANGED/);
 await assert.rejects(closeDemoPilot(f.args),/ALREADY_STARTED/);
});
test('pending, missing, changed receipt, Mongo conflict, live lease or unused worker registration refuses before write',async()=>{
 for(const reason of ['pending','missing','receipt','mongo','lease','worker','budget']){
  const f=await fixture(),b=f.docs.get('state/batch:close-fixture:1').value;
  if(reason==='pending')b.pending={awaiting:null};if(reason==='missing')f.docs.delete('journal/'+receiptKey(f.args.plan.trialId,1));
  if(reason==='receipt')f.docs.get('journal/'+receiptKey(f.args.plan.trialId,1)).value.sourceSessionHash='bad';
  if(reason==='mongo')f.mongo.delete(hash('record1'));if(reason==='lease')b.leaseUntil=101;
  if(reason==='worker')f.docs.get('state/pool:close-fixture').value.workers[18]={leaseUntil:0};
  if(reason==='budget')f.args.profile.usedByWorker[18]=5;await f.rebind();
  const before=hash([...f.docs]);await assert.rejects(closeDemoPilot(f.args));assert.equal(hash([...f.docs]),before);
 }
});
test('archive failure, lost CAS and missing final close cannot authorize a next game',async()=>{
 for(const reason of ['before','cas','complete']){
  const f=await fixture();if(reason==='cas')f.conflict();else f.fail(f.key+':'+reason);
  await assert.rejects(closeDemoPilot(f.args));await assert.rejects(reviewSpentDemoGeneration(await f.source()));
  assert(!f.docs.has('journal/'+f.key+':complete'));
 }
});
test('late boundary change and expired profile cannot complete or release quota',async()=>{
 const f=await fixture();let calls=0;f.args.boundary=async()=>{if(++calls===2)f.docs.get('state/pool:close-fixture').value.workers[0].leaseUntil=1000;};
 await assert.rejects(closeDemoPilot(f.args),/SCENE_CHANGED/);assert(!f.docs.has('journal/'+f.key+':complete'));
 const g=await fixture();g.args.now=()=>7200000;await assert.rejects(closeDemoPilot(g.args),/SCOPE/);
});
test('completed close requires exact immutable snapshot, parent profile, runtime, run and counts',async()=>{
 for(const reason of ['pool','batch','campaign','before','runtime','run','quota','profile','closure']){
  const f=await fixture();await closeDemoPilot(f.args);const a=await f.source(),closed=f.docs.get('journal/'+f.key+':complete').value;
  if(reason==='pool')a.scene.fromPool.enabled=true;if(reason==='batch')a.scene.sourceBatches[0].checkpoint--;
  if(reason==='campaign')a.scene.campaign.activeGame=1;if(reason==='before')f.docs.get('journal/'+f.key+':before').value.commit='e'.repeat(40);
  if(reason==='runtime')a.profile.sourceCommit='f'.repeat(40);if(reason==='run')a.profile.sourceRunKey='capture-run:9:1';
  if(reason==='quota'){closed.usedByWorker[18]=5;a.profile.sourceClosureHash=hash(closed);}if(reason==='profile')a.profile.sourceProfileHash='0'.repeat(64);
  if(reason==='closure')delete a.profile.sourceClosureHash;
  await assert.rejects(readClosedPilot({...a,plan:a.fromPlan}),/CLOSURE/);
 }
});
test('authenticated completed run must include all20 exact jobs; a failed run alone is not spent evidence',async()=>{
 const f=await fixture(),profile=f.args.profile,ended={id:2,run_attempt:1,head_sha:profile.sourceCommit,status:'completed',conclusion:'failure',path:'.github/workflows/trial-300k.yml',repository:{full_name:'zyzuoyang/sg-capture-runner'}},jobs={total_count:20,jobs:profile.usedByWorker.map((n,w)=>({name:'fresh-capture-'+w,status:'completed',conclusion:n?'success':'failure'}))};
 checkDemoSourceEnded({ended,jobs,profile,closing:true});assert.throws(()=>checkDemoSourceEnded({ended,jobs,profile}));
 for(const reason of ['commit','attempt','job','live','duplicate','truncated']){
  const r=structuredClone(ended),j=structuredClone(jobs);if(reason==='commit')r.head_sha='0'.repeat(40);if(reason==='attempt')r.run_attempt=2;
  if(reason==='job')j.jobs[18].conclusion='success';if(reason==='live')j.jobs[0].status='in_progress';if(reason==='duplicate')j.jobs[1]=j.jobs[0];if(reason==='truncated')j.total_count=21;
  assert.throws(()=>checkDemoSourceEnded({ended:r,jobs:j,profile,closing:true}));
 }
});

test('partial fifth BET abandonment is a failed job despite five consumed allowances',async()=>{
 const f=await fixture(),profile={...f.args.profile,schema:'sg-demo-pilot-close-v2',completeByWorker:[...f.args.profile.usedByWorker]};
 profile.usedByWorker=[...profile.usedByWorker];profile.usedByWorker[18]=5;profile.completeByWorker[18]=4;
 const ended={id:2,run_attempt:1,head_sha:profile.sourceCommit,status:'completed',conclusion:'failure',path:'.github/workflows/trial-300k.yml',repository:{full_name:'zyzuoyang/sg-capture-runner'}};
 const jobs={total_count:20,jobs:profile.completeByWorker.map((n,w)=>({name:'fresh-capture-'+w,status:'completed',conclusion:n===5?'success':'failure'}))};
 checkDemoSourceEnded({ended,jobs,profile,closing:true});jobs.jobs[18].conclusion='success';assert.throws(()=>checkDemoSourceEnded({ended,jobs,profile,closing:true}));
});
