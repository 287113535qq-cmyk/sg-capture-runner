import test from 'node:test';
import assert from 'node:assert/strict';
import {GithubCampaign} from './campaign.mjs';

function fixture(){
  const docs=new Map(),rows=[];
  const store={get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),writable:async()=>{},
    async create(c,k,value){const key=c+'/'+k;if(!docs.has(key))docs.set(key,{version:0,value:structuredClone(value)});return structuredClone(docs.get(key));},
    async update(c,k,fn){const key=c+'/'+k,before=docs.get(key),value=fn(structuredClone(before.value));if(value)docs.set(key,{version:before.version+1,value});return structuredClone(docs.get(key));}};
  const plans={32723:{gameId:32723,trialId:'sg_r1_20260928_32723',buy:0,phase:1,target:2},
    32726:{gameId:32726,trialId:'sg_r1_20260928_32726',buy:0,phase:1,target:2}};
  const holds=[];const control={allowed:async()=>{},halt:async reason=>holds.push(reason)};
  const transport={request:async(op,r)=>op==='global_holds'?[{value:{active:false}},{value:{active:false}}]:rows.filter(x=>x.sequence>r.after)};
  const c=new GithubCampaign({store,transport,control,analyzer:{call:async()=>({verified:true})},plans,
    group:'primary',owner:'audit-job',now:()=>1000});
  return {c,store,rows,holds,plans};
}

test('a group only selects its owned ready games, preserving parked and completed targets',async()=>{
  const f=fixture();await f.store.create('state','campaign',{enabled:true,activeGame:null,games:[
    {game_id:32726,status:'parked-protocol',baseline:299998},{game_id:32723,status:'ready',baseline:299998}]});
  const next=await f.c.select();assert.equal(next.plan.gameId,32723);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'parked-protocol');
  assert.equal((await f.c.select()).plan.gameId,32723);
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
  f.rows.push({_id:'id1',contentHash:'hash1',sequence:1,fixtureOnly:false,buy:0,shardId:0,sourceSessionHash:'fixed',raw:{}});
  await assert.rejects(f.c.audit(plan),/AUDIT_COUNT_INCOMPLETE/);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'active');
  f.rows.push({...f.rows[0],_id:'id2',contentHash:'hash2',sequence:2});
  assert.equal((await f.c.audit(plan)).fullReadback,2);
  assert.equal((await f.store.get('state','campaign')).value.games[0].status,'complete');
});
