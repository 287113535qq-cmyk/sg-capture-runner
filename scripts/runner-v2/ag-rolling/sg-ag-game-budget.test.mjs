import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameBudget,SG_AG_GAME_BUDGET_MS} from './sg-ag-game-budget.mjs';
import {createSgAgFullControlAdapter} from './sg-ag-full-control-adapter.mjs';
import {taskKey} from './sg-task-store.mjs';

function budgetFixture(options={}){
 let clock=1000;const state={games:[{gameId:'32442',phase:'ready'},{gameId:'32529',phase:'ready'}]},saved=[];
 const budget=createGameBudget({state,now:()=>clock,persist:(_file,value)=>{saved.push(value);return options.persist?.(value)??{fullReadback:true};},
  flush:async()=>{await options.flush?.(state);}});
 return {state,saved,budget,setTime:at=>clock=at};
}

test('only the first eligible prefix starts a durable 30 minute budget and subsequent phases cannot renew it',async()=>{
 const f=budgetFixture(),g=f.state.games[0];
 await f.budget.check('github-read');await f.budget.check('settle-ended-node',g);await f.budget.check('baseline',g);
 assert.equal(g.sgGameBudget,undefined);assert.equal(f.saved.length,0);
 await f.budget.check('full-prefix-validation',g);
 const deadline=g.sgGameBudget.deadlineAt;assert.equal(deadline,1000+SG_AG_GAME_BUDGET_MS);assert.equal(f.saved.length,1);
 f.setTime(deadline-1);await f.budget.check('source-full-independent-validation',g);await f.budget.check('full-prefix-validation',g);
 assert.equal(g.sgGameBudget.deadlineAt,deadline);assert.equal(f.saved.length,1);
 f.setTime(deadline);await assert.rejects(f.budget.check('business-single-insert',g),{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});
 assert.equal(g.phase,'blocked');assert.equal(f.saved.at(-1).games[0].phase,'blocked');assert.equal(f.saved.length,2);
 await assert.rejects(f.budget.check('full-prefix-validation',g),{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});
 assert.equal(f.saved.length,2);assert.equal(g.sgGameBudget.deadlineAt,deadline);
});

test('restored state keeps its deadline, completed cleanup does not restart it, and foreign games are refused',async()=>{
 const f=budgetFixture(),g=f.state.games[0];await f.budget.check('full-prefix-validation',g);
 const saved=structuredClone(f.state);let writes=0;
 const restored=createGameBudget({state:saved,now:()=>g.sgGameBudget.deadlineAt,persist:()=>{writes++;return {fullReadback:true};},flush:async()=>{}});
 await assert.rejects(restored.check('full-prefix-validation',saved.games[0]),{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});assert.equal(writes,1);
 saved.games[1].phase='complete';await restored.check('per-game-finalize',saved.games[1]);assert.equal(saved.games[1].sgGameBudget,undefined);
 await assert.rejects(restored.check('full-prefix-validation',{...saved.games[1],phase:'ready'}),/GAME_SCOPE/);
});

test('existing blocked games retain their reason and never acquire a fresh business budget',async()=>{
 const f=budgetFixture(),g=f.state.games[0];g.phase='blocked';g.reason='SG_AG_CONTROL_EXISTING_OPERATION_NO_REPLAY';
 await assert.rejects(f.budget.check('full-prefix-validation',g),{code:'SG_AG_GAME_ALREADY_BLOCKED'});
 assert.equal(g.reason,'SG_AG_CONTROL_EXISTING_OPERATION_NO_REPLAY');assert.equal(g.sgGameBudget,undefined);assert.equal(f.saved.length,0);
 await f.budget.check('settle-ended-node',g);
});

test('the durable exhausted marker distinguishes a read-only ready phase from merging and merged writes',async()=>{
 for(const stoppedGamePhase of ['ready','merging','merged']){
  const f=budgetFixture(),g=f.state.games[0];await f.budget.check('full-prefix-validation',g);
  g.phase=stoppedGamePhase;f.setTime(g.sgGameBudget.deadlineAt);
  await assert.rejects(f.budget.check('source-full-independent-validation',g),{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});
  assert.equal(g.phase,'blocked');assert.equal(g.sgGameBudget.schema,'sg-ag-game-budget-v1');
  assert.equal(g.sgGameBudget.stoppedGamePhase,stoppedGamePhase);
  assert.equal(f.saved.at(-1).games[0].sgGameBudget.stoppedGamePhase,stoppedGamePhase);
  assert.equal(g.sgGameBudget.stoppedPhase,'source-full-independent-validation');
 }
});

test('budget exhaustion waits for durable state flush without racing or starting another operation',async()=>{
 let release,waiting=false;const f=budgetFixture({flush:async state=>{if(state.games[0].phase==='blocked'){waiting=true;await new Promise(r=>release=r);}}}),g=f.state.games[0];
 await f.budget.check('full-prefix-validation',g);f.setTime(g.sgGameBudget.deadlineAt);
 let returned=false;const pending=f.budget.check('audit-before',g).catch(error=>{returned=true;throw error;});
 const rejected=assert.rejects(pending,{code:'SG_AG_GAME_BUDGET_EXHAUSTED'});
 await Promise.resolve();assert.equal(waiting,true);assert.equal(returned,false);release();await rejected;
});

test('failed local persistence or unknown durable flush poisons the budget and cannot report a successful stop',async()=>{
 for(const options of [{persist:()=>({fullReadback:false})},{flush:async()=>{throw Error('unknown-native-ack');}}]){
  const f=budgetFixture(options);await assert.rejects(f.budget.check('full-prefix-validation',f.state.games[0]),e=>e.code==='SG_AG_GAME_BUDGET_PERSIST_UNKNOWN'&&e.outcomeUnknown===true);
  const writes=f.saved.length;
  await assert.rejects(f.budget.check('full-prefix-validation',f.state.games[1]),{code:'SG_AG_GAME_BUDGET_PERSIST_UNKNOWN'});
  await assert.rejects(f.budget.check('github-read'),{code:'SG_AG_GAME_BUDGET_PERSIST_UNKNOWN'});
  assert.equal(f.saved.length,writes);assert(f.state.games.every(g=>g.phase!=='complete'));
 }
});

function controllerFixture({failBlockedFlush=false}={}){
 const queueId='budget-synthetic',cohortRun='123:1',commit='a'.repeat(40);let clock=1000;
 const games=['32442','32529'].map(gameId=>({gameId,dbName:'sg_'+gameId,campaignId:'sg_'+gameId+'-'+queueId,baseline:0,phase:'ready'}));
 const state={version:1,queueId,runId:123,phase:'running',games},docs=new Map(),events=[],intents=new Map(),receipts=new Map(),campaign=new Map();
 const persist=(file,value)=>{events.push({type:'persist',file,value:structuredClone(value)});return {fullReadback:true};};
 const budget=createGameBudget({state,persist,now:()=>clock,flush:async()=>{if(failBlockedFlush&&games.some(g=>g.phase==='blocked'))throw Error('native-flush-unknown');}});
 for(const g of games)for(const [kind,total] of [['canary',2],['worker',20]])for(let i=1;i<=total;i++)docs.set(taskKey(queueId,g,kind+':'+i),{version:0,value:{_id:kind+':'+i,queueId,campaignId:g.campaignId,status:'success',owner:'123-1:'+i+':'+kind+':'+i,
  proof:{fullReadback:true,independentlyVerified:true,count:kind==='worker'?15000:10,recordsHash:'b'.repeat(64)}}});
 const store={get:async(_c,key)=>structuredClone(docs.get(key)??null),getMany:async(_c,keys)=>keys.map(key=>structuredClone(docs.get(key)??null))};
 const io={
  guard:(phase,g)=>budget.check(phase,g),persist,
  readJobs:async()=>({run:cohortRun,commit,at:clock,total_count:20,jobs:Array.from({length:20},(_,i)=>({name:'AG rolling lane '+(i+1),status:'in_progress'}))}),
  readRun:async()=>({run:cohortRun,commit,at:clock,status:'in_progress'}),
  verifyPrefix:async(g,index)=>{events.push({type:'prefix',gameId:g.gameId});if(g===games[1]&&index===1){assert.equal(g.sgGameBudget.deadlineAt-clock,SG_AG_GAME_BUDGET_MS);clock+=SG_AG_GAME_BUDGET_MS-1;}
   return {queueId,gameId:g.gameId,campaignId:g.campaignId,taskId:'worker:'+index,count:15000,recordsHash:'b'.repeat(64),fullReadback:true,independentlyVerified:true,acceptedUnknownRequests:0};},
  inspectPriorOperation:async g=>({canStartOnce:!intents.has(g.gameId)}),
  ensureNative:async(_g,selection)=>({count:selection.total,selected:selection.selected,fullReadback:true,independentlyVerified:true}),
  deliverBusiness:async g=>{assert(!intents.has(g.gameId));intents.set(g.gameId,{durable:true,original:'retained'});events.push({type:'intent',gameId:g.gameId});
   if(g===games[0])clock+=SG_AG_GAME_BUDGET_MS;
   await io.guard('business-single-insert',g);events.push({type:'insert',gameId:g.gameId});
   const receipt={gameId:g.gameId,queueId,campaignCount:300000,originalCount:100,businessCount:300100,originalUnchanged:true,fullReadback:true,independentlyVerified:true};receipts.set(g.gameId,receipt);campaign.set(g.gameId,300000);return receipt;},
  countBusiness:async g=>({captureBaseline:0,campaignCount:campaign.get(g.gameId)??0}),
  inspectBusiness:async g=>({captureBaseline:0,campaignCount:campaign.get(g.gameId)??0,fullReadback:true,originalUnchanged:true,invalid:0}),
  readBusinessReceipt:async g=>receipts.get(g.gameId),finishGame:async()=>({fullReadback:true,originalEvidencePreserved:true}),close:async()=>{},
  assertResumeBoundary:async()=>{throw Error('unused');},resetEndedTask:async()=>{throw Error('unused');},dispatchRemaining:async()=>{throw Error('unused');},finishCohort:async()=>{},
  sealSettlement:async()=>{throw Error('unused');},ackSettlement:async()=>{throw Error('unused');},recordException:value=>events.push({type:'exception',...value}),
 };
 const api=createSgAgFullControlAdapter({state,cohortRun,commit,queueId,store,io,now:()=>clock});
 return {api,state,games,events,intents};
}

test('original AG catch isolates a slow game, preserves its durable intent, and gives the next game its entire budget',async()=>{
 const f=controllerFixture();await f.api.reconcile();
 assert.equal(f.games[0].phase,'blocked');assert.equal(f.games[0].reason,'SG_AG_GAME_BUDGET_EXHAUSTED');assert.equal(f.games[1].phase,'complete');
 assert.deepEqual(f.intents.get(f.games[0].gameId),{durable:true,original:'retained'});
 assert(!f.events.some(e=>e.type==='insert'&&e.gameId===f.games[0].gameId));
 const before=f.events.filter(e=>['prefix','intent','insert'].includes(e.type));await f.api.reconcile();
 assert.deepEqual(f.events.filter(e=>['prefix','intent','insert'].includes(e.type)),before);
});

test('a failed blocked-state flush never lets AG report completion or start the next game',async()=>{
 const f=controllerFixture({failBlockedFlush:true});await assert.rejects(f.api.reconcile(),/SG_AG_GAME_BUDGET_PERSIST_UNKNOWN/);
 assert(f.games.every(g=>g.phase!=='complete'));assert.equal(f.games[1].sgGameBudget,undefined);
 assert(!f.events.some(e=>e.type==='insert'));assert.equal(f.intents.size,1);
 assert(f.events.some(e=>e.type==='exception'&&e.error==='SG_AG_GAME_BUDGET_PERSIST_UNKNOWN'));
});
