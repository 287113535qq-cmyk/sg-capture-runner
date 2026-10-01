import test from 'node:test';
import assert from 'node:assert/strict';
import {metadataCompressionCanary} from './metadata-compression-canary.mjs';
test('compression comparison reads exactly the same document, alternates order, and makes no write',async()=>{
 const order=[];let checks=0;const doc={version:1,value:{history:['retained'],lease:20}};
 const store=name=>({async get(collection,key){assert.equal(collection,'state');assert.equal(key,'validation:1:1:delta');order.push(name);return structuredClone(doc);}});
 const result=await metadataCompressionCanary(store('plain'),store('compressed'),'validation:1:1:delta',{checkResource:async()=>{checks++;}});
 assert.equal(checks,10);assert.equal(order.length,22);assert.deepEqual(order.slice(2,6),['plain','compressed','compressed','plain']);
 assert.equal(result.mongoWrites,0);assert.equal(result.gameThroughputVerified,false);assert.equal(result.samples.plain.length,10);
});
test('changed value or version stops the comparison without a fallback or write',async()=>{
 await assert.rejects(metadataCompressionCanary({}, {},'pool:trial'),/CANARY_KEY/);
 const plain={get:async()=>({version:1,value:{lease:20}})},changed={get:async()=>({version:2,value:{lease:20}})};
 await assert.rejects(metadataCompressionCanary(plain,changed,'validation:1:1:delta'),/CANARY_CHANGED/);
});
