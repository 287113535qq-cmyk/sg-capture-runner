import assert from 'node:assert/strict';
import test from 'node:test';
import {createHmac} from 'node:crypto';
import {globalShard} from './runner-group.mjs';
import {gameForShard} from './demo-sessions.mjs';

const plan={campaignId:'sg_round_one_20260928',phase:1,buy:0,schema:'sg-work-pool-v1',
  gameId:32651,runtimeSlug:'squidgameonemoregame'};
const base={id:32651,runtimeSlug:plan.runtimeSlug,mode:'demo',
  serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',operatorId:'offline-fixture',sessionId:'Free:offline-fixture'};
const trial='sg_r1_20260928_32651';

test('two repositories map forty distinct stable sessions and preserve original twenty',()=>{
  const shards=['zyzuoyang/sg-capture-runner','287113535qq-cmyk/sg-capture-runner']
    .flatMap(repo=>Array.from({length:20},(_,i)=>globalShard(i,plan,repo)));
  assert.deepEqual(shards,Array.from({length:40},(_,i)=>i));
  const sessions=shards.map(i=>gameForShard(base,i,trial,plan).sessionId);
  assert.equal(new Set(sessions).size,40);
  for(let i=0;i<20;i++)assert.equal(sessions[i],base.sessionId.slice(0,5)+
    createHmac('sha256',base.sessionId+'@'+base.operatorId)
      .update(`sg-real-trial-v1:${trial}:parallel-shard:${i}`).digest('hex').slice(0,32));
  assert.equal(gameForShard(base,39,trial,plan).sessionId,sessions[39]);
});

test('secondary repository cannot enter legacy trials or choose primary worker IDs',()=>{
  const secondary='287113535qq-cmyk/sg-capture-runner';
  assert.throws(()=>globalShard(0,{},secondary));
  assert.throws(()=>globalShard(0,{...plan,buy:1},secondary));
  assert.throws(()=>globalShard(0,plan,'unapproved/repository'));
  for(const shard of [-1,20,0.5,'0'])assert.throws(()=>globalShard(shard,plan,secondary));
  assert.throws(()=>gameForShard(base,40,trial,plan));
});
