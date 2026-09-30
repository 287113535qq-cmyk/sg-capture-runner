import test from 'node:test';import assert from 'node:assert/strict';
import {createCaptureTelemetry,businessOutcome,completedResponseTiming} from './capture-telemetry.mjs';
import http from 'node:http';import {once} from 'node:events';

test('real loopback transport phases persist only after the complete body and never expose endpoints',async()=>{
 const server=http.createServer((req,res)=>res.end('private-fixture'));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const t=createCaptureTelemetry({evidence:{completedThisRun:0,sourceRequests:1}});
 try{
  const response=await t.fetch(fetch,'BET','http://127.0.0.1:'+server.address().port);
  assert.equal(completedResponseTiming(response),null);assert.equal(await response.text(),'private-fixture');
  const value=completedResponseTiming(response);assert.equal(value.connection.correlated,true);assert.equal(value.connection.socketObserved,true);
  assert(value.connection.tcpConnectMs>=0);assert.equal(value.connection.tlsHandshakeMs,null);
  assert(!JSON.stringify(value).includes('127.0.0.1'));assert(!JSON.stringify(value).includes('private-fixture'));
  value.connection.tcpConnectMs=99999;assert.notEqual(completedResponseTiming(response).connection.tcpConnectMs,99999);
 }finally{t.stop();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('timing keeps one fetch, exact arguments, cookies and Response semantics',async()=>{
 let now=0,calls=0;const rows=[],options={body:'PRIVATE',signal:new AbortController().signal};
 const t=createCaptureTelemetry({gameId:32795,shardId:0,evidence:{completedThisRun:0,sourceRequests:1},now:()=>now,emit:x=>rows.push(x)});
 const r=await t.fetch(async(url,arg)=>{calls++;assert.equal(url,'PRIVATE');assert.equal(arg,options);now=4000;
  return new Response('PRIVATE_RESPONSE',{headers:{'set-cookie':'private-cookie'}});},'Logic','PRIVATE',options);
 assert.equal(r.headers.get('set-cookie'),'private-cookie');now=4050;assert.equal(await r.text(),'PRIVATE_RESPONSE');t.stop();
 assert.equal(calls,1);assert.equal(rows[0].totals['source.Logic.headers'].totalMs,4000);
 assert.equal(rows[0].totals['source.Logic.total'].totalMs,4050);assert(!JSON.stringify(rows).includes('PRIVATE'));
});
test('unknown outcomes propagate original errors without retries; metrics exclude messages',async()=>{
 for(const stage of ['headers','body']){let calls=0;const error=Error('PRIVATE_TOKEN');
  const t=createCaptureTelemetry({evidence:{completedThisRun:0,sourceRequests:1}});
  await assert.rejects(async()=>{const r=await t.fetch(async()=>{calls++;if(stage==='headers')throw error;
   return{ok:true,text:async()=>{throw error;}};},'PRIVATE_DYNAMIC_KEY');await r.text();},x=>x===error);
  assert.equal(calls,1);assert.equal(t.snapshot().sourceErrors,1);assert(!JSON.stringify(t.snapshot()).includes('PRIVATE'));
 }
});
test('bounded histogram, window reset, normalization error identity and broken sink isolation',async()=>{
 let now=0;const rows=[],evidence={completedThisRun:0,sourceRequests:0};
 const t=createCaptureTelemetry({evidence,now:()=>now,emit:r=>rows.push(r)});
 for(let i=0;i<10000;i++)t.observe('normalize',i%100);now=60000;evidence.completedThisRun=100;t.progress();
 assert.equal(rows.length,1);assert.equal(rows[0].roundsPerMinute,100);assert.equal(rows[0].totals.normalize.bucketCounts.length,16);
 assert.deepEqual(t.snapshot().window,{});assert.equal(t.snapshot().totals.normalize.count,10000);
 const error=Error('PRIVATE');assert.throws(t.sync('normalize',()=>{throw error;}),e=>e===error);
 const broken=createCaptureTelemetry({evidence,emit:()=>{throw error;},metrics:()=>{throw error;}});broken.stop();
});
test('timer reports during an idle source call and stop clears timer',async()=>{
 const rows=[];const t=createCaptureTelemetry({evidence:{completedThisRun:0,sourceRequests:1},intervalMs:5,emit:r=>rows.push(r)});
 t.start();await new Promise(r=>setTimeout(r,25));t.stop();assert(rows.some(r=>r.reason==='interval'));
 const length=rows.length;await new Promise(r=>setTimeout(r,15));assert.equal(rows.length,length);
});
test('business outcome cannot mistake graceful protocol isolation or partial run for completion',()=>{
 assert.equal(businessOutcome({status:'halted',reason:'PROTOCOL_VALIDATION_FAILED'}),'parked-protocol');
 assert.equal(businessOutcome({status:'pending',confirmed:1500}),'incomplete');
 assert.equal(businessOutcome({status:'complete'}),'complete');
 assert.equal(businessOutcome({status:'halted'},{category:'source_network'}),'source-paused');
 assert.equal(businessOutcome({status:'complete'},Error('failure')),'requires-review');
});
test('durable timing is response-local, complete-only and does not expose payload or cookies',async()=>{
 let now=0;const t=createCaptureTelemetry({evidence:{},now:()=>now});
 const response=await t.fetch(async()=>{now=40;return {ok:true,text:async()=>{now=75;return 'private';}};},'Logic');
 assert.equal(completedResponseTiming(response),null);now=50;assert.equal(await response.text(),'private');
 const timing=completedResponseTiming(response);
 assert.deepEqual(timing,{schema:'sg-source-timing-v1',headersMs:40,bodyMs:25,totalMs:75});
 timing.bodyMs=999;assert.equal(completedResponseTiming(response).bodyMs,25);
 assert.equal(completedResponseTiming(new Response('x')),null);
 const bad=await t.fetch(async()=>({ok:true,text:async()=>{throw Error('private');}}),'EndGame');
 await assert.rejects(bad.text());assert.equal(completedResponseTiming(bad),null);
 assert.equal(completedResponseTiming(response).totalMs,75);
});
