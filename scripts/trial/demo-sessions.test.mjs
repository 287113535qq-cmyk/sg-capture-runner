import assert from 'node:assert/strict';
import test from 'node:test';
import {gameForShard} from './demo-sessions.mjs';
import fs from 'node:fs';
const base={id:32471,runtimeSlug:'bookofsevens96',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',mode:'demo',
  operatorId:'explicit-offline-fixture',sessionId:'Free:explicit-offline-fixture',currency:'USD'};

test('actual zero-history Piggies plan derives twenty sessions with exact new trial scope',()=>{
 const p=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32636'];
 const profile=JSON.parse(fs.readFileSync('config/demo-pilot-piggies-20260930.json','utf8')),plan={...p,demoGeneration:profile.generation},b={...base,id:p.gameId,runtimeSlug:p.runtimeSlug};
 const sessions=Array.from({length:20},(_,i)=>gameForShard(b,i,p.trialId,plan).sessionId);assert.equal(new Set(sessions).size,20);
 assert.deepEqual(sessions,Array.from({length:20},(_,i)=>gameForShard(b,i,p.trialId,plan).sessionId));
 for(const bad of [{...plan,demoGeneration:undefined},{...plan,runtimeGameId:33114},{...plan,trialId:'sg_r1_20260930_32714'}])assert.throws(()=>gameForShard(b,0,p.trialId,bad),/DEMO_TRIAL_SCOPE/);
 assert.throws(()=>gameForShard(b,0,'sg_r1_20261001_32636',plan),/DEMO_TRIAL_SCOPE/);
});

test('reviewed generation creates twenty new stable sessions while legacy derivation stays unchanged',()=>{
 const plan={campaignId:'sg_round_one_20260928',phase:1,gameId:32471,runtimeSlug:base.runtimeSlug};
 const old=Array.from({length:20},(_,i)=>gameForShard(base,i,'sg_r1_20260928_32471',plan).sessionId);
 const next={...plan,demoGeneration:'a'.repeat(64)};
 const fresh=Array.from({length:20},(_,i)=>gameForShard(base,i,'sg_r1_20260928_32471',next).sessionId);
 assert.equal(new Set(fresh).size,20);assert(fresh.every(x=>!old.includes(x)));
 assert.deepEqual(fresh,Array.from({length:20},(_,i)=>gameForShard(base,i,'sg_r1_20260928_32471',next).sessionId));
 assert.notEqual(gameForShard(base,0,'sg_r1_20260928_32471',{...next,demoGeneration:'b'.repeat(64)}).sessionId,fresh[0]);
 for(const demoGeneration of ['',null,'../random',1])assert.throws(()=>gameForShard(base,0,'sg_r1_20260928_32471',{...plan,demoGeneration}));
});
test('twenty independent stable demo identifiers preserve other configuration',()=>{
  const games=Array.from({length:20},(_,i)=>gameForShard(base,i));
  assert.equal(new Set(games.map(g=>g.sessionId)).size,20);
  for(let i=0;i<20;i++){
    assert.deepEqual(gameForShard(base,i),games[i]);
    assert.deepEqual({...games[i],sessionId:base.sessionId},base);
    assert.notEqual(games[i].sessionId,base.sessionId);
  }
});
test('real-money or authenticated session identifiers cannot enter anonymous path',()=>{
  assert.throws(()=>gameForShard({...base,mode:'real'},0));
  assert.throws(()=>gameForShard({...base,sessionId:'authenticated-offline-fixture'},0));
});
test('game and shard scope cannot change',()=>{
  for(const shard of [-1,20,0.5,'0'])assert.throws(()=>gameForShard(base,shard));
  assert.throws(()=>gameForShard({...base,id:1},0));
});
test('a new trial has distinct stable sessions without changing legacy identifiers',()=>{
  assert.equal(gameForShard(base,0).sessionId,gameForShard(base,0,'bookofsevens_300k_20260927').sessionId);
  const next=gameForShard(base,0,'bookofsevens_next_fixture');
  assert.notEqual(next.sessionId,gameForShard(base,0).sessionId);
  assert.equal(next.sessionId,gameForShard(base,0,'bookofsevens_next_fixture').sessionId);
  assert.throws(()=>gameForShard(base,0,'../unscoped'));
});
