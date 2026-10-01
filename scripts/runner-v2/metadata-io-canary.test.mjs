import test from 'node:test';
import assert from 'node:assert/strict';
import {metadataIoCanary} from './metadata-io-canary.mjs';

test('bounded diagnostic comparison preserves history, alternates order and never touches a game key',async()=>{
 let doc={version:0,value:{stage:1}},writes=0;const modes=[];
 const store={deltaCas:false,async get(collection,key){assert.equal(collection,'state');assert.equal(key,'validation:123:1:delta');return structuredClone(doc);},
  async cas(collection,key,before,value){assert.equal(collection,'state');assert.equal(key,'validation:123:1:delta');assert.equal(before.version,doc.version);
   writes++;modes.push(this.deltaCas);doc={version:doc.version+1,value:structuredClone(value)};return structuredClone(doc);}};
 const result=await metadataIoCanary(store,'validation:123:1:delta');assert.equal(writes,21);
 assert.deepEqual(modes.slice(1,5),[false,true,true,false]);assert.equal(result.samples.full.length,10);assert.equal(result.samples.delta.length,10);
 assert.equal(result.sourceRequests,0);assert.equal(result.gameThroughputVerified,false);assert(result.fullReadback);
});
test('invalid key and changed diagnostic stop before any subsequent write',async()=>{
 await assert.rejects(metadataIoCanary({},'pool:trial'),/IO_CANARY_KEY/);
 let reads=0,writes=0;const store={async get(){reads++;return reads===1?{version:0,value:{}}:{version:1,value:{lease:99}};},async cas(){writes++;return {version:1,value:{lease:0}};}};
 await assert.rejects(metadataIoCanary(store,'validation:123:1:delta'),/IO_CANARY_CHANGED/);assert.equal(writes,1);
});
