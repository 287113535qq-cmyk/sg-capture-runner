import test from 'node:test';import assert from 'node:assert/strict';
import {workLineEvidencePump} from './work-line-evidence-pump.mjs';
test('GET pump holds one read in flight and backs off after success or failure',async()=>{
 let finish,calls=0,at=0;const logs=[];
 const pump=workLineEvidencePump({now:()=>at,read:()=>{calls++;return new Promise(r=>finish=r);},log:r=>logs.push(r)});
 const first=pump.tick();await Promise.resolve();assert.equal(calls,1);assert.equal(pump.tick(),first);
 finish({delivered:1,sourceRequests:0});await first;assert.equal(logs.length,1);
 await pump.tick();assert.equal(calls,1);at=60001;
 const second=pump.tick();await Promise.resolve();assert.equal(calls,2);finish({delivered:0});await second;
 assert.equal(logs.length,1);
 const bad=workLineEvidencePump({now:()=>at,read:async()=>{throw Error('GET_TIMEOUT');},log:r=>logs.push(r)});
 await bad.tick();assert.equal(logs.at(-1).reason,'GET_TIMEOUT');assert.equal(logs.at(-1).sourceRequests,0);
});
