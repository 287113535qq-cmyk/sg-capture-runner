import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameResources} from './sg-ag-game-resources.mjs';
import {protectMongoOnce} from './sg-ag-once-mongo.mjs';

function fixture(options={}){
 const opened=[],closed=[],pools=[];
 const pool=createGameResources({gameIds:['32752','32759','32764'],open:async id=>{
  opened.push(id);if(options.open)await options.open(id);
  const once=protectMongoOnce({async write(){throw Error('lost write ACK');},async read(){return id;}});
  const value={...once,businessClient:once.client,close:async()=>{if(options.close)await options.close(id);closed.push(id);}};
  pools.push(value);return value;
 }});return {pool,opened,closed,pools};
}

test('a poisoned game closes its connection before another game proceeds and cannot be retried',async()=>{
 const f=fixture(),one=await f.pool.get('32752');await assert.rejects(one.businessClient.write(),/lost write ACK/);
 const two=await f.pool.get('32759');assert.deepEqual(f.closed,['32752']);assert.equal(await two.businessClient.read(),'32759');
 await assert.rejects(f.pool.get('32752'),/UNKNOWN_NO_REPLAY/);assert.deepEqual(f.opened,['32752','32759']);
 await f.pool.close();assert.equal(f.pool.status().closureConfirmed,true);
});
test('switching games waits for actual close and concurrent same-game opens share the one slot',{timeout:2000},async()=>{
 let release,started;const closing=new Promise(r=>{started=r;}),hold=new Promise(r=>{release=r;});
 const f=fixture({close:async id=>{if(id==='32752'){started();await hold;}}});await f.pool.get('32752');
 const a=f.pool.get('32759'),b=f.pool.get('32759');await closing;assert.deepEqual(f.opened,['32752']);
 release();assert.equal(await a,await b);assert.deepEqual(f.opened,['32752','32759']);await f.pool.close();
});
test('unconfirmed closure retains the entire slot; another game cannot open or cause a second close',async()=>{
 let calls=0;const f=fixture({close:async()=>{calls++;throw Error('still running');}});await f.pool.get('32752');
 await assert.rejects(f.pool.get('32759'),/CLOSE_UNCONFIRMED/);await assert.rejects(f.pool.get('32764'),/CLOSE_UNCONFIRMED/);
 await assert.rejects(f.pool.close(),/CLOSE_UNCONFIRMED/);assert.equal(calls,1);assert.deepEqual(f.opened,['32752']);
 assert.equal(f.pool.status().closureConfirmed,false);
});
test('failed initialization with confirmed cleanup isolates only its game and is never reopened',async()=>{
 const f=fixture({open:id=>{if(id==='32752')throw Error('own privilege mismatch');}});
 await assert.rejects(f.pool.get('32752'),/privilege/);await assert.rejects(f.pool.get('32752'),/privilege/);
 assert.equal(await (await f.pool.get('32759')).businessClient.read(),'32759');assert.deepEqual(f.opened,['32752','32759']);await f.pool.close();
});
test('failed initialization with an unknown child exit blocks reuse of that slot',async()=>{
 const f=fixture({open:()=>{throw Object.assign(Error('SG_AG_RESOURCE_CLOSE_UNCONFIRMED'),{code:'SG_AG_RESOURCE_CLOSE_UNCONFIRMED',outcomeUnknown:true});}});
 await assert.rejects(f.pool.get('32752'),/CLOSE_UNCONFIRMED/);await assert.rejects(f.pool.get('32759'),/CLOSE_UNCONFIRMED/);
 assert.deepEqual(f.opened,['32752']);assert.equal(f.pool.status().closeUnknown,true);
});
test('one cohort resource failure cannot poison the other cohort client',async()=>{
 const a=fixture(),b=fixture();await assert.rejects((await a.pool.get('32752')).businessClient.write());
 assert.equal(await(await b.pool.get('32752')).businessClient.read(),'32752');await Promise.all([a.pool.close(),b.pool.close()]);
});
test('foreign games, use after close and invalid scope do not allocate resources',async()=>{
 const f=fixture();assert.throws(()=>f.pool.get('32888'),/OWN_GAME/);await f.pool.close();
 await assert.rejects(f.pool.get('32752'),/CLOSED/);assert.deepEqual(f.opened,[]);
 assert.throws(()=>createGameResources({gameIds:['32752','32752'],open:()=>{}}),/SCOPE/);
});
