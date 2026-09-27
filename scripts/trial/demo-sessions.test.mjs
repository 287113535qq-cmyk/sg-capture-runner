import assert from 'node:assert/strict';
import test from 'node:test';
import {gameForShard} from './demo-sessions.mjs';
const base={id:32471,runtimeSlug:'bookofsevens96',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',mode:'demo',
  operatorId:'explicit-offline-fixture',sessionId:'Free:explicit-offline-fixture',currency:'USD'};
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
