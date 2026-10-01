import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubCampaign,idleAtAssignedTail} from './campaign.mjs';

test('idle tail workers release runner capacity without taking a queued worker batch',()=>{
  const pool={nextSequence:301,confirmed:200,workers:{0:{activeBatch:null,leaseUntil:0},1:{activeBatch:{id:3},leaseUntil:0}}};
  assert.equal(idleAtAssignedTail(pool,0,300,1000),true);
  assert.equal(idleAtAssignedTail(pool,1,300,1000),false);
  assert.equal(!!idleAtAssignedTail(pool,2,300,1000),false);
  assert.equal(idleAtAssignedTail({...pool,confirmed:300},0,300,1000),false); // Keep final auditor.
  assert.equal(idleAtAssignedTail({...pool,nextSequence:201},0,300,1000),false);
});

function fixture(){
  const docs=new Map(),rows=[],calls=[];
  const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),writable:async()=>{},
    async create(c,k,value){const key=c+'/'+k;if(!docs.has(key))docs.set(key,{version:0,value:structuredClone(value)});return structuredClone(docs.get(key));},
    async update(c,k,fn){const key=c+'/'+k,before=docs.get(key),value=fn(structuredClone(before.value));if(value)docs.set(key,{version:before.version+1,value});return structuredClone(docs.get(key));}};
  const plans={32723:{gameId:32723,trialId:'sg_r1_20260928_32723',buy:0,phase:1,target:2},
    32726:{gameId:32726,trialId:'sg_r1_20260928_32726',buy:0,phase:1,target:2}};
  const holds=[];const control={allowed:async()=>{},halt:async reason=>holds.push(reason)};
  const transport={request:async(op,r)=>{calls.push(op);return op==='global_holds'?[{value:{active:false}},{value:{active:false}}]:rows.filter(x=>x.sequence>r.after);}};
  const c=new GithubCampaign({store,transport,control,analyzer:{call:async()=>({verified:true})},plans,
    group:'primary',owner:'audit-job',commit:'d'.repeat(40),now:()=>1000});
  return {c,store,rows,holds,plans,docs,calls};
}

test('run outcome distinguishes workflow success, parked game, pending audit and complete game without writes',async()=>{
 const f=fixture(),trial=f.plans[32723].trialId;
 await f.store.create('state','capture-run:11:1',{gameId:32723});
 await f.store.create('state','pool:'+trial,{enabled:false,failure:'PROTOCOL_VALIDATION_FAILED',confirmed:1,workers:{}});
 await f.store.create('state','campaign',{enabled:true,activeGame:null,games:[{game_id:32723,status:'parked-protocol',repairKey:'fixture'}]});
 let out=(await f.c.status({runKey:'capture-run:11:1'})).runOutcome;
 assert.equal(out.businessStatus,'parked-protocol');assert.equal(out.gameAuditedComplete,false);assert.equal(out.settledComplete,1);assert.equal(out.repairQueued,true);
 const pool=f.docs.get('state/pool:'+trial).value;pool.enabled=true;pool.failure=null;pool.confirmed=2;
 const campaign=f.docs.get('state/campaign').value;campaign.activeGame=32723;campaign.games[0].status='active';
 out=(await f.c.status({runKey:'capture-run:11:1'})).runOutcome;assert.equal(out.businessStatus,'awaiting-audit');assert.equal(out.gameAuditedComplete,false);
 campaign.games[0].status='complete';campaign.activeGame=null;
 out=(await f.c.status({runKey:'capture-run:11:1'})).runOutcome;assert.equal(out.businessStatus,'complete');assert.equal(out.gameAuditedComplete,true);
 assert.equal((await f.c.status({runKey:'capture-run:12:1'})).runOutcome.businessStatus,'unbound');
 assert.equal(f.docs.size,3);assert(f.calls.every(op=>op==='global_holds'));
});

test('ended-run finalizer waits for lease expiry then parks without selecting another ready game',async()=>{
 const f=fixture(),trial=f.plans[32723].trialId;let clock=1000,sleeps=0;f.c.now=()=>clock;
 await f.store.create('state','campaign',{enabled:true,activeGame:32723,games:[
  {game_id:32723,status:'parking-protocol'},{game_id:32726,status:'ready',baseline:299998}]});
 await f.store.create('state','capture-run:111:1',{gameId:32723});
 await f.store.create('state','pool:'+trial,{workers:{0:{leaseUntil:15000,activeBatch:null}},planHash:'a'});
 await f.c.finalizeStoppedRun('capture-run:111:1',{waitMs:300000,sleep:async ms=>{sleeps++;clock+=ms;}});
 const c=(await f.store.get('state','campaign')).value;
 assert.equal(sleeps,2);assert.equal(c.activeGame,null);assert.equal(c.games[0].status,'parked-protocol');
 assert.equal(c.games[1].status,'ready');assert(!(await f.store.get('state','pool:'+f.plans[32726].trialId)));
});

test('ended-run finalizer waits only within its bound and never steals a live lease',async()=>{
 const f=fixture(),trial=f.plans[32723].trialId;let clock=1000;f.c.now=()=>clock;
 await f.store.create('state','campaign',{enabled:true,activeGame:32723,games:[{game_id:32723,status:'parking-protocol'}]});
 await f.store.create('state','capture-run:111:1',{gameId:32723});
 await f.store.create('state','pool:'+trial,{workers:{0:{leaseUntil:999999,activeBatch:null}},planHash:'a'});
 const old=JSON.stringify([...f.docs]);
 assert.equal((await f.c.finalizeStoppedRun('capture-run:111:1',{waitMs:30000,sleep:async ms=>{clock+=ms;}})).action,'wait');
 assert.equal(clock,31000);assert.equal(JSON.stringify([...f.docs]),old);
});

test('a group only selects its owned ready games, preserving parked and completed targets',async()=>{
  const f=fixture();await f.store.create('state','campaign',{enabled:true,activeGame:null,games:[
    {game_id:32726,status:'parked-protocol',baseline:299998},{game_id:32723,status:'ready',baseline:299998}]});
  const next=await f.c.select();assert.equal(next.plan.gameId,32723);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'parked-protocol');
  assert.equal((await f.c.select()).plan.gameId,32723);
});

test('protocol short run has one persisted run binding; later runs stop and status cannot auto-continue',async()=>{
  const f=fixture(),plan=f.plans[32723];
  await f.store.create('state','campaign',{enabled:true,activeGame:32723,validationLimit:10,
    protocolValidation:{phase:'short',gameId:32723,commit:'d'.repeat(40),runKey:null},games:[{game_id:32723,status:'active'}]});
  await f.store.create('state','pool:'+plan.trialId,{enabled:true,confirmed:0,workers:{}});
  assert.equal((await f.c.selectForRun('capture-run:111:1')).action,'capture');
  assert.equal((await f.c.selectForRun('capture-run:111:1')).action,'capture');
  assert.equal((await f.c.selectForRun('capture-run:111:2')).reason,'PROTOCOL_SHORT_REVIEW_REQUIRED');
  assert.equal((await f.c.status()).status,'paused');
});

test('parking waits for source owners and refuses to bypass an unknown intent',async()=>{
  const f=fixture(),trial=f.plans[32723].trialId;
  await f.store.create('state','campaign',{enabled:true,activeGame:32723,games:[{game_id:32723,status:'parking-protocol'}]});
  await f.store.create('state','pool:'+trial,{workers:{0:{leaseUntil:2000,activeBatch:{id:1}}},planHash:'a'});
  await f.store.create('state',`batch:${trial}:1`,{id:1,pending:{awaiting:'MSGID=BET'}});
  assert.equal((await f.c.select()).action,'wait');assert.equal(f.holds.length,0);
  await f.store.update('state','pool:'+trial,v=>{v.workers[0].leaseUntil=0;return v;});
  assert.equal((await f.c.select()).action,'stop');assert.deepEqual(f.holds,['UNKNOWN_SOURCE_OUTCOME']);
  assert.equal((await f.store.get('state','campaign')).value.activeGame,32723);
});

test('full-game audit requires every actual record and marks completion only with history total',async()=>{
  const f=fixture(),plan=f.plans[32723];
  await f.store.create('state','campaign',{enabled:true,activeGame:32723,games:[{game_id:32723,status:'active',baseline:299998}]});
  await f.store.create('state','pool:'+plan.trialId,{confirmed:2,workers:{0:{leaseUntil:0,activeBatch:null,sessionHash:'fixed'}}});
  assert.equal((await f.c.select()).action,'audit');
  f.rows.push({_id:'id1',contentHash:'hash1',sequence:1,fixtureOnly:false,buy:0,shardId:0,sourceSessionHash:'fixed',
    normalized:{bonus:0},raw:{steps:[{msgId:'BET',responsePayload:'MSGID=BET&NFG=0&IFG=0'}]}});
  await assert.rejects(f.c.audit(plan),/AUDIT_COUNT_INCOMPLETE/);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'active');
  assert.equal([...f.docs.keys()].filter(k=>k.startsWith('journal/game-rules:')).length,0);
  f.rows.push({...f.rows[0],_id:'id2',contentHash:'hash2',sequence:2});
  f.calls.length=0;const unchanged=structuredClone(f.rows);
  assert.equal((await f.c.audit(plan)).fullReadback,2);
  assert.deepEqual(f.calls,['rounds_scan','rounds_scan']);
  assert.deepEqual(f.rows,unchanged);
  const archives=[...f.docs].filter(([k])=>k.startsWith('journal/game-rules:'));
  assert.equal(archives.length,1);assert.equal(archives[0][1].value.completeRounds,2);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'complete');
});

test('late and idle workers cannot continue the next game with a depleted matrix',async()=>{
  const f=fixture();await f.store.create('state','campaign',{enabled:true,activeGame:null,games:[
    {game_id:32723,status:'ready',baseline:299998},{game_id:32726,status:'ready',baseline:299998}]});
  const key='capture-run:123:1';assert.equal((await f.c.selectForRun(key)).plan.gameId,32723);
  await f.store.update('state','campaign',v=>{v.activeGame=null;v.games[0].status='complete';return v;});
  assert.equal((await f.c.selectForRun(key)).reason,'RUN_GAME_FINISHED');
  assert.equal((await f.store.get('state','campaign')).value.activeGame,null);
  assert.equal((await f.c.selectForRun('capture-run:124:1')).plan.gameId,32726);
  assert.equal((await f.c.selectForRun(key)).reason,'RUN_GAME_FINISHED');
});

test('failed record verification never produces a coverage archive or completes a game',async()=>{
  const f=fixture(),plan=f.plans[32723];
  await f.store.create('state','campaign',{enabled:true,activeGame:32723,
    games:[{game_id:32723,status:'active',baseline:299998}],audit:{owner:'audit-job',until:2000}});
  await f.store.create('state','pool:'+plan.trialId,{confirmed:2,workers:{0:{leaseUntil:0,activeBatch:null,sessionHash:'fixed'}}});
  f.rows.push({_id:'id1',contentHash:'hash1',sequence:1,fixtureOnly:false,buy:0,shardId:0,sourceSessionHash:'fixed',raw:{steps:[]}});
  f.c.analyzer.call=async()=>{throw new Error('INVALID_ROUND');};
  await assert.rejects(f.c.audit(plan),/INVALID_ROUND/);
  assert(![...f.docs.keys()].some(k=>k.startsWith('journal/')));
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'active');
});

test('page verification preserves session ownership and refuses partial receipts before completion',async()=>{
 for(const mode of ['valid','partial','invalid-tail','wrong-owner']){
  const f=fixture(),plan=f.plans[32723];
  await f.store.create('state','campaign',{enabled:true,activeGame:32723,
   games:[{game_id:32723,status:'active',baseline:299998}],audit:{owner:'audit-job',until:2000}});
  await f.store.create('state','pool:'+plan.trialId,{confirmed:2,workers:{0:{leaseUntil:0,activeBatch:null,sessionHash:'fixed'}}});
  for(let sequence=1;sequence<=2;sequence++)f.rows.push({_id:'id'+sequence,contentHash:'hash'+sequence,
   sequence,fixtureOnly:false,buy:0,shardId:0,sourceSessionHash:mode==='wrong-owner'?'other':'fixed',
   normalized:{bonus:0},raw:{steps:[{msgId:'BET',responsePayload:'MSGID=BET&NFG=0&IFG=0'}]}});
  let pages=0;f.c.analyzer.call=async()=>{throw new Error('PER_RECORD_PATH_USED');};
  f.c.analyzer.verifyPage=async(p,rows)=>{assert.equal(p,plan);assert.equal(rows.length,2);pages++;
   if(mode==='invalid-tail')throw new Error('INVALID_TAIL');
   return {verified:true,count:mode==='partial'?1:2};};
  if(mode==='valid'){assert.equal((await f.c.audit(plan)).fullReadback,2);
   assert.equal((await f.store.get('state','campaign')).value.games[0].status,'complete');}
  else{await assert.rejects(f.c.audit(plan));
   assert(![...f.docs.keys()].some(k=>k.startsWith('journal/')));
   assert.equal((await f.store.get('state','campaign')).value.games[0].status,'active');}
  assert.equal(pages,1);
 }
});

test('matrix finalizer cannot extend short scope, park another run or move past a live owner',async()=>{
  for(const mode of ['short','other-run','live']){
    const f=fixture(),trial=f.plans[32723].trialId;
    await f.store.create('state','campaign',{enabled:true,activeGame:32723,validationLimit:mode==='short'?5:0,
      games:[{game_id:32723,status:'parking-protocol'},{game_id:32726,status:'ready',baseline:299998}]});
    await f.store.create('state','capture-run:111:1',{gameId:mode==='other-run'?32726:32723});
    await f.store.create('state','pool:'+trial,{enabled:false,drainingProtocol:true,workers:{0:{leaseUntil:2000}}});
    await f.c.finalizeStoppedRun('capture-run:111:1');
    assert.equal((await f.store.get('state','campaign')).value.activeGame,32723);
    assert(![...f.docs.keys()].some(k=>k.startsWith('state/game-repair:')));
  }
});
