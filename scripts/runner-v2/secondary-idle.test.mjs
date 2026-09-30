import test from 'node:test';import assert from 'node:assert/strict';
import {fixture as baseFixture} from './fixtures/demo-next-game.mjs';
import {activateSecondaryIdle,secondaryIdleScene} from './secondary-idle.mjs';
import {closeInterruptedPilot,interruptedScene} from './demo-interrupted-close.mjs';
import {DemoFresh} from './demo-fresh.mjs';
import {protocolHash as hash} from './protocol-resume.mjs';
import {receiptKey} from './durable-queue.mjs';
export async function fixture(){
 const f=await baseFixture(),oldPlan={gameId:32719,runtimeGameId:33119,trialId:'sg_r1_20260928_32719',phase:1,buy:0,target:299900},trial=oldPlan.trialId;
 f.docs.clear();f.mongo.clear();
 const campaign={schema:'sg-github-campaign-v2',group:'secondary',enabled:true,activeGame:null,audit:null,protocolValidation:null,validationLimit:0,games:[{game_id:32719,status:'parked-protocol'},{game_id:32836,status:'complete'}]};
 const b={id:1,worker:27,start:1,end:100,epoch:0,leaseUntil:0,checkpoint:60,journaled:67,sessionHash:'old-session',pending:{sequence:68,attempt:'old',awaiting:null,raw:{steps:[{msgId:'BET'}]}},failure:'PROTOCOL_VALIDATION_FAILED'};
 const pool={enabled:false,nextBatchId:2,nextSequence:101,workers:{27:{sessionHash:'old-session',leaseUntil:0}},planHash:hash(oldPlan)};
 f.docs.set('state/campaign',{value:campaign});f.docs.set('state/pool:'+trial,{value:pool});f.docs.set('state/batch:'+trial+':1',{value:b});f.docs.set('state/write-permits',{value:{limit:1,slots:{}}});
 for(let n=1;n<=67;n++){const r={_id:hash('inca'+n),contentHash:hash('c'+n),trialId:trial,batchId:1,shardId:27,sequence:n,sourceSessionHash:'old-session',fixtureOnly:false,buy:0,raw:{synthetic:true,steps:[{msgId:'BET'}]}};f.docs.set('journal/'+receiptKey(trial,n),{value:r});if(n<=60)f.mongo.set(r._id,structuredClone(r));}
 const generation='a'.repeat(64),plan={...oldPlan,demoGeneration:generation};
 const profile={schema:'sg-demo-secondary-idle-pilot-v1',group:'secondary',workerOffset:20,gameId:32719,fromGameId:null,generation,oldPlanHash:hash(oldPlan),planHash:hash(plan),workers:20,perWorker:5,newBetAllowance:100,completePreserved:67,abandonedAttempts:1,createdAt:0,expiresAt:7200000,
 legacyImport:{schema:'sg-parked-import-v1',mongoCount:60,complete:67,pending:1,campaignHash:hash(campaign),archiveHash:'2d815dffe1185deb4b13d180744f8eec69364956297efc122cd1858f9b6c01f2',bytes:74009}};
 pool.legacyImport={key:'import-fixture',specHash:hash(profile.legacyImport)};
 profile.sceneHash=hash(await secondaryIdleScene(f.args.store,oldPlan));
 f.docs.set('journal/import-fixture:complete',{value:{schema:'sg-parked-import-complete-v1',specHash:hash(profile.legacyImport),profileHash:hash(profile),commit:f.args.commit,run:f.args.run,newBetAllowance:0,sourceRequests:0}});
 const args={...f.args,plan:oldPlan,plans:{32719:oldPlan},profile},key=`next-demo-game:${trial}:${generation}`;
 const admit=async(worker=20,sessionHash='fresh-session')=>{f.docs.get('state/campaign').value.protocolValidation.runKey='capture-run:12:1';return new DemoFresh({store:args.store,plan,stage:'fresh',runKey:'capture-run:12:1',now:args.now}).admit({shardId:worker,sessionHash,commitSha:args.commit},worker);};
 return {...f,args,key,plan,oldPlan,admit};
}
test('idle secondary flushes seven, abandons one and admits only fresh workers20..39',async()=>{
 const f=await fixture(),r=await activateSecondaryIdle(f.args);assert.equal(r.completePreserved,67);assert.equal(r.abandonedAttempts,1);assert.equal(r.sourceRequests,0);assert.equal(f.mongo.size,67);
 for(const w of [20,39])assert.equal((await f.admit(w)).limit,5);
 for(const w of [0,19,40])await assert.rejects(f.admit(w),/RUN_CHANGED/);
 await assert.rejects(f.admit(20,'old-session'),/OLD_SESSION/);
 assert.equal(f.docs.get('state/campaign').value.games.find(g=>g.game_id===32836).status,'complete');
 await assert.rejects(activateSecondaryIdle(f.args));
});
test('idle secondary refuses active campaign wrong group unbound import or expired permission before writes',async()=>{
 for(const reason of ['active','group','worker','profile','lease','import','expired']){const f=await fixture(),c=f.docs.get('state/campaign').value;
  if(reason==='active')c.activeGame=32717;if(reason==='group')c.group='primary';if(reason==='worker')f.docs.get('state/batch:'+f.plan.trialId+':1').value.worker=0;
  if(reason==='profile')f.args.profile.workerOffset=0;if(reason==='lease')f.docs.get('state/pool:'+f.plan.trialId).value.workers[27].leaseUntil=1000;
  if(reason==='import')f.docs.delete('journal/import-fixture:complete');if(reason==='expired')f.args.now=()=>7200001;
  const before=hash([...f.docs]);await assert.rejects(activateSecondaryIdle(f.args));assert.equal(hash([...f.docs]),before,reason);
 }
});
test('partial activation or conflicting Mongo never grants source through fresh admission',async()=>{
 const f=await fixture();f.fail(f.key+':complete');await assert.rejects(activateSecondaryIdle(f.args),/INJECTED/);await assert.rejects(f.admit(),/NOT_COMPLETE/);
 const broken=await fixture();broken.corrupt();await assert.rejects(activateSecondaryIdle(broken.args));assert(!broken.docs.has('journal/'+broken.key+':complete'));
});

test('secondary AG close counts worker20..39 separately and grants repair zero source',async()=>{
 const f=await fixture();await activateSecondaryIdle(f.args);const trial=f.plan.trialId;
 const pool=f.docs.get('state/pool:'+trial).value,c=f.docs.get('state/campaign').value;
 const spec=f.docs.get('journal/'+`demo-generation:${trial}:${f.plan.demoGeneration}`).value;
 Object.assign(pool,{enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',drainingProtocol:true,nextBatchId:4,workers:{20:{leaseUntil:0,sessionHash:'new20',activeBatch:{id:2}},21:{leaseUntil:0,sessionHash:'new21',activeBatch:{id:3}}}});
 c.games[0].status='parking-protocol';c.protocolValidation.runKey='capture-run:12:1';
 const b1={id:2,worker:20,start:101,end:200,journaled:101,checkpoint:101,leaseUntil:0,sessionHash:'new20',pending:null};
 const b2={id:3,worker:21,start:201,end:300,journaled:200,checkpoint:200,leaseUntil:0,sessionHash:'new21',pending:null};
 const r={_id:hash('new101'),contentHash:hash('new101c'),trialId:trial,batchId:2,shardId:20,sequence:101,sourceSessionHash:'new20',buy:0,fixtureOnly:false,raw:{synthetic:true,steps:[{msgId:'BET'}]}};
 f.docs.set('journal/'+receiptKey(trial,101),{value:r});f.mongo.set(r._id,structuredClone(r));
 const pending={sequence:201,awaiting:null,raw:{steps:[{msgId:'BET',responseXml:'<synthetic/>',responsePayload:'FID=1'}]}};
 b2.abandonedDemo=`abandoned-demo:${trial}:3:${hash(pending)}`;
 f.docs.set('journal/'+b2.abandonedDemo,{value:{schema:'sg-abandoned-demo-v1',trialId:trial,batchId:3,disposition:'interrupted-abandoned-without-replay',sourceRequests:0,pending,pendingOriginal:null}});
 f.docs.set('state/batch:'+trial+':2',{value:b1});f.docs.set('state/batch:'+trial+':3',{value:b2});
 f.args.store.cas=async(col,k,doc,value)=>{assert.equal(hash(f.get(col,k).value),hash(doc.value));f.docs.set(col+'/'+k,{value:structuredClone(value)});return true;};
 const close={schema:'sg-demo-pilot-close-v2',planHash:hash(f.plan),sourceSpecHash:hash(spec),sourceProfileHash:hash(f.args.profile),sourceRunKey:'capture-run:12:1',sourceCommit:f.args.commit,usedByWorker:[1,1,...Array(18).fill(0)],completeByWorker:[1,...Array(19).fill(0)],completePreserved:68,newBetAllowance:0,createdAt:0,expiresAt:7200000,sceneHash:hash(await interruptedScene(f.args.store,f.plan))};
 const result=await closeInterruptedPilot({...f.args,basePlan:f.oldPlan,plan:f.plan,profile:close});
 assert.equal(result.used,2);assert.equal(result.foregone,98);assert.equal(result.abandoned,1);assert.equal(result.completePreserved,68);
 assert.equal(f.get('state',result.repairKey).value.sourceAllowance,0);await assert.rejects(f.admit());
});
