// Portable synthetic source and parser; real retirement, rollover and admission.
import test from 'node:test';import assert from 'node:assert/strict';
import {nextDemoGame,nextDemoScene} from './demo-next-game.mjs';import {DemoFresh} from './demo-fresh.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';import {receiptKey} from './durable-queue.mjs';
function retirementFixture(){
 const plan={trialId:'synthetic-demo',gameId:32820,phase:1,buy:0},pool={enabled:false,nextBatchId:2,workers:{7:{leaseUntil:0}}},pending={sequence:3,attempt:'unfinished',awaiting:null,raw:{steps:[{msgId:'BET'}]}};
 pool.planHash=hash(plan);
 const batch={id:1,worker:7,start:1,end:100,epoch:0,leaseUntil:0,checkpoint:0,journaled:2,sessionHash:'session',pending,failure:'PROTOCOL_VALIDATION_FAILED'};
 const docs=new Map([['state/pool:'+plan.trialId,{value:pool}],['state/batch:'+plan.trialId+':1',{value:batch}],['state/write-permits',{value:{limit:1,slots:{}}}]]),mongo=new Map();let failAt=null,corrupt=false,busy=false;
 for(let n=1;n<=2;n++){const r={_id:hash('r'+n),contentHash:hash('content'+n),trialId:plan.trialId,batchId:1,shardId:7,sequence:n,sourceSessionHash:'session',fixtureOnly:false,buy:0,raw:{synthetic:true}};docs.set('journal/'+receiptKey(plan.trialId,n),{value:r});}
 const get=(c,k)=>structuredClone(docs.get(c+'/'+k));const store={get:async(c,k)=>get(c,k),getMany:async(c,keys)=>keys.map(k=>get(c,k)),writable:async()=>{},create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));assert(k!==failAt,'INJECTED_FAILURE');docs.set(c+'/'+k,{value:structuredClone(v)});},update:async(c,k,fn)=>{const v=fn(get(c,k).value);if(v!==null)docs.set(c+'/'+k,{value:v});return get(c,k);}};
 const transport={request:async(op,p)=>{if(op==='rounds_insert'){for(const r of p.records)mongo.set(r._id,structuredClone(r));return {};}assert.equal(op,'rounds_read');const a=[...mongo.values()].filter(r=>p.ids.includes(r._id)).map(x=>structuredClone(x));if(corrupt&&a.length)a[0].sequence=999;return a;}};
 const args={store,transport,plan,parser:{call:async({record})=>({verified:record.raw.synthetic===true})},gate:{status:()=>({allowed:true,maxBatchSize:100}),hold(){}},boundary:async()=>assert(!busy,'BUSY'),owner:'test',now:()=>100,expectedPoolHash:hash(pool)};
 return {args,docs,mongo,get,fail:k=>failAt=k,corrupt:()=>corrupt=true,busy:()=>busy=true,batch};
}

async function fixture(regular=false){
 const f=retirementFixture(),oldPlan=f.args.plan;oldPlan.gameId=32835;oldPlan.target=300000;
 const generation='a'.repeat(64),sourceGeneration='b'.repeat(64),fromBase={gameId:32820,trialId:'synthetic-source',buy:0,phase:1},fromPlan={...fromBase,demoGeneration:sourceGeneration};
 const plan={...oldPlan,demoGeneration:generation},plans={32835:oldPlan,32820:fromBase};
 const pool=f.docs.get('state/pool:'+oldPlan.trialId).value;pool.planHash=hash(oldPlan);pool.nextSequence=101;
 const parent={schema:'sg-demo-generation-residual-v1',trialId:fromPlan.trialId,generation:sourceGeneration,planHash:hash(fromPlan),firstBatchId:1,budgets:[2,...Array(19).fill(0)],commit:'d'.repeat(40),run:'9:1'};
 const parentKey=`demo-generation:${fromPlan.trialId}:${sourceGeneration}`;
 f.docs.set('journal/'+parentKey,{value:parent});f.docs.set('journal/'+parentKey+':complete',{value:{schema:'sg-demo-generation-complete-v1',specHash:hash(parent),commit:parent.commit,run:parent.run}});
 f.docs.set('state/pool:'+fromPlan.trialId,{value:{enabled:true,workers:{},nextBatchId:2,planHash:hash(fromPlan),demoGeneration:{specHash:hash(parent)},confirmed:2}});
 f.docs.set('state/batch:'+fromPlan.trialId+':1',{value:{id:1,worker:0,start:1,end:100,journaled:2,checkpoint:2,leaseUntil:0,pending:null}});
 if(regular){
  Object.assign(parent,{schema:'sg-demo-generation-v1',workers:20,perWorker:5,newBetAllowance:100});delete parent.budgets;
  const source=f.docs.get('state/pool:'+fromPlan.trialId).value;source.nextBatchId=21;source.confirmed=100;source.demoGeneration.specHash=hash(parent);
  f.docs.set('journal/'+parentKey,{value:parent});f.docs.get('journal/'+parentKey+':complete').value.specHash=hash(parent);
  for(let w=0;w<20;w++){const start=w*100+1,b={id:w+1,worker:w,start,end:start+99,journaled:start+4,checkpoint:start+4,leaseUntil:0,pending:null,sessionHash:'source-'+w};f.docs.set('state/batch:'+fromPlan.trialId+':'+b.id,{value:b});
   for(let n=start;n<start+5;n++)f.docs.set('journal/'+receiptKey(fromPlan.trialId,n),{value:{trialId:fromPlan.trialId,batchId:b.id,shardId:w,sequence:n,sourceSessionHash:b.sessionHash,raw:{synthetic:true,steps:[{msgId:'BET'}]}}});
  }
 }
 f.docs.set('state/campaign',{value:{enabled:true,activeGame:32820,games:[{game_id:32820,status:'active'},{game_id:32835,status:'parked-protocol'}],protocolValidation:{runKey:'capture-run:10:1'}}});
 const profile={schema:'sg-demo-next-game-v1',gameId:32835,fromGameId:32820,generation,sourceGeneration,sourcePlanHash:hash(fromPlan),sourceSpecHash:hash(parent),sourceRunKey:'capture-run:10:1',oldPlanHash:hash(oldPlan),planHash:hash(plan),workers:20,perWorker:5,newBetAllowance:100,completePreserved:2,abandonedAttempts:1,createdAt:0,expiresAt:7200000};
 profile.sceneHash=hash(await nextDemoScene(f.args.store,oldPlan,fromPlan));
 const args={...f.args,plans,profile,commit:'c'.repeat(40),run:'11:1'};const key=`next-demo-game:${plan.trialId}:${generation}`;
 const admit=async()=>{f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:12:1';return new DemoFresh({store:args.store,plan,stage:'fresh',runKey:'capture-run:12:1',now:args.now}).admit({shardId:0,sessionHash:'new-session',commitSha:args.commit},0);};
 return {...f,args,plan,key,admit,parentKey};
}
test('next game flushes old complete, abandons partial, preserves spent source and grants only20x5',async()=>{
 const f=await fixture(),source=hash(f.get('state','batch:synthetic-source:1').value),r=await nextDemoGame(f.args);
 assert.equal(r.completePreserved,2);assert.equal(r.abandonedAttempts,1);assert.equal(r.sourceRequests,0);assert.equal(f.mongo.size,2);
 assert.equal(f.get('state','pool:synthetic-source').value.enabled,false);assert.equal(hash(f.get('state','batch:synthetic-source:1').value),source);
 assert.equal(f.get('state','batch:synthetic-demo:1').value.pending,null);assert.equal((await f.admit()).limit,5);
 await assert.rejects(nextDemoGame(f.args));
});
test('partial top completion refuses source even after generation and campaign writes',async()=>{
 const f=await fixture();f.fail(f.key+':complete');await assert.rejects(nextDemoGame(f.args),/INJECTED/);
 assert(f.get('journal',`demo-generation:${f.plan.trialId}:${f.plan.demoGeneration}:complete`));await assert.rejects(f.admit(),/NEXT_GAME_NOT_COMPLETE/);
});
test('source unspent budget, changed proof, stale profile and new lease refuse before any write',async()=>{
 for(const cause of ['budget','proof','stale','lease']){const f=await fixture();
  if(cause==='budget')f.docs.get('state/batch:synthetic-source:1').value.journaled=1;
  if(cause==='proof')f.docs.get('journal/'+f.parentKey+':complete').value.commit='e'.repeat(40);
  if(cause==='stale')f.args.now=()=>7200001;
  if(cause==='lease')f.docs.get('state/batch:synthetic-source:1').value.leaseUntil=1000;
  f.args.profile.sceneHash=hash(await nextDemoScene(f.args.store,f.args.plans[32835],f.args.plans[32820]));
  const before=hash([...f.docs]);await assert.rejects(nextDemoGame(f.args));assert.equal(hash([...f.docs]),before);
 }
});
test('Mongo or archive failure never creates a fresh generation or clears the old partial',async()=>{
 for(const cause of ['mongo','archive']){const f=await fixture();if(cause==='mongo')f.corrupt();else f.fail('retired-demo:synthetic-demo:'+hash(f.get('state','pool:synthetic-demo').value).slice(0,16)+':analysis');
  await assert.rejects(nextDemoGame(f.args));assert(f.get('state','batch:synthetic-demo:1').value.pending);assert(!f.get('journal',f.key+':complete'));await assert.rejects(f.admit());
 }
});

test('completed v1 pilot takes actual nextGame retirement, rollover and fresh admission path',async()=>{
 const f=await fixture(true),sourceBefore=hash([...f.docs].filter(([k])=>k.startsWith('state/batch:synthetic-source:')));
 const result=await nextDemoGame(f.args);assert.equal(result.newBetAllowance,100);assert.equal(result.sourceRequests,0);assert.equal((await f.admit()).limit,5);
 assert.equal(hash([...f.docs].filter(([k])=>k.startsWith('state/batch:synthetic-source:'))),sourceBefore);assert.equal(f.get('state','pool:synthetic-source').value.enabled,false);
});
