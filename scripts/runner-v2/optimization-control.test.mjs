import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {optimize} from './optimization-control.mjs';
import {stable} from './mongo-writer.mjs';
import {receiptKey} from './durable-queue.mjs';
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
function fixture(){
  const old={gameId:1,trialId:'old',target:100},next={gameId:2,trialId:'next',target:1000};
  const docs=new Map(),writes=[],rows=[];let verified=0;
  const put=(c,k,value)=>docs.set(c+'/'+k,{value:structuredClone(value)});
  put('state','campaign',{activeGame:null,games:[{game_id:1,status:'complete'},{game_id:2,status:'operator-wait'}],
    operatorBoundary:{reason:'USER_REQUESTED_OPTIMIZATION_AFTER_CURRENT_GAME',activeGame:1,readyGames:[2]}});
  put('state','pool:old',{planHash:hash(old),confirmed:100,workers:{0:{activeBatch:null,leaseUntil:0}}});
  put('journal','game-audit:old',{planHash:hash(old),fullReadback:100});
  const f={group:'primary',stage:'short',plans:{1:old,2:next},now:()=>100000,commit:'tested',
    gate:{status:()=>({metrics:{diskFreeBytes:50*1024**3}})},
    parser:{call:async()=>{verified++;}},
    transport:{request:async(op,r)=>{if(op==='global_holds')return [{value:{active:false}},{value:{active:false}}];
      assert.equal(op,'rounds_scan');return rows.filter(x=>x.sequence>r.after).slice(0,100);}},
    store:{get:async(c,k)=>structuredClone(docs.get(c+'/'+k)),writable:async()=>{},
      create:async(c,k,v)=>{assert(!docs.has(c+'/'+k));put(c,k,v);writes.push(k);},
      update:async(c,k,change)=>{put(c,k,change(structuredClone(docs.get(c+'/'+k).value)));writes.push(k);},
      getMany:async(c,keys)=>keys.map(k=>structuredClone(docs.get(c+'/'+k)))},
    docs,writes,rows,put,verified:()=>verified};
  return f;
}
async function shortFixture(){
  const f=fixture();await optimize(f);f.writes.length=0;
  const campaign=f.docs.get('state/campaign').value;campaign.activeGame=2;campaign.games[1].status='active';
  const workers={};for(let worker=0;worker<20;worker++){
    workers[worker]={sessionHash:'session-'+worker,leaseUntil:0};
    const start=worker*10+1,end=start+9,id=worker+1;
    f.put('state','batch:next:'+id,{id,worker,start,end,journaled:end,checkpoint:end,pending:null,failure:null});
    for(let sequence=start;sequence<=end;sequence++){
      const r={sequence,shardId:worker,sourceSessionHash:workers[worker].sessionHash,batchId:id,raw:{fixture:true}};
      f.rows.push(r);f.put('journal',receiptKey('next',sequence),r);
    }
  }
  f.put('state','pool:next',{workers,nextBatchId:21,failure:null});f.stage='validate';return f;
}
test('activation requires previous full audit, no old leases and exact held queue',async()=>{
  for(const change of [f=>f.docs.get('journal/game-audit:old').value.fullReadback--,
    f=>f.docs.get('state/pool:old').value.workers[0].leaseUntil=100001,
    f=>f.docs.get('state/campaign').value.operatorBoundary.readyGames=[3]]){
    const f=fixture();change(f);await assert.rejects(optimize(f));assert.equal(f.writes.length,0);
  }
  const f=fixture();assert.equal((await optimize(f)).validationLimit,10);
  assert.equal(f.docs.get('state/campaign').value.games[1].status,'ready');
  assert.equal(f.docs.get('state/campaign').value.games[0].status,'complete');
});
test('validation compares every complete Mongo row to durable journal and parser',async()=>{
  const f=await shortFixture(),r=await optimize(f);assert.equal(r.fullReadback,200);assert.equal(f.verified(),200);
  assert.equal(r.workersVerified,20);
  f.stage='formal';assert.equal((await optimize(f)).validationLimit,0);
});
test('unsettled, missing or altered short records cannot authorize promotion',async()=>{
  for(const change of [f=>f.docs.get('state/batch:next:1').value.pending={awaiting:'unknown'},
    f=>f.rows.pop(),f=>f.rows[0].raw.changed=true]){
    const f=await shortFixture();change(f);await assert.rejects(optimize(f));assert.equal(f.writes.length,0);
  }
});
test('formal promotion refuses stale proof or a changed pool',async()=>{
  for(const change of [f=>f.now=()=>100000+900001,
    f=>f.docs.get('state/pool:next').value.workers[0].leaseUntil=1]){
    const f=await shortFixture();await optimize(f);f.writes.length=0;f.stage='formal';change(f);
    await assert.rejects(optimize(f),/SHORT_PROOF_STALE_OR_CHANGED/);assert.equal(f.writes.length,0);
  }
});
