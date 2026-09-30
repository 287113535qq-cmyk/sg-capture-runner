import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import http from 'node:http';import {once} from 'node:events';import {connectionObserver} from './connection-observer.mjs';

test('connection phases are correlated without leaking protocol data; reused socket has no fabricated DNS/TLS cost',async()=>{
 const listeners=new Map();let time=0;const probe=connectionObserver({now:()=>time,subscribe:(n,f)=>{listeners.set(n,f);return ()=>listeners.delete(n);}});
 const emit=(n,v)=>listeners.get(n)?.(v),socket=new EventEmitter();socket.isSessionReused=()=>true;
 async function request(first){const req={secret:'never-persist'};emit('undici:request:create',{request:req});
  if(first){time=1;emit('net.client.socket',{socket});time=3;socket.emit('lookup');time=8;socket.emit('connect');time=12;socket.emit('secureConnect');}
  time=15;emit('undici:client:sendHeaders',{request:req,socket,headers:'private'});time=25;emit('undici:request:headers',{request:req});return 'response';}
 const a=await probe.trace(()=>request(true)),x=a.summary();assert.equal(a.response,'response');
 assert.equal(x.lookupWaitMs,2);assert.equal(x.tcpConnectMs,5);assert.equal(x.tlsHandshakeMs,4);assert.equal(x.afterHeadersWriteMs,10);assert.equal(x.reusedSocket,false);
 const b=await probe.trace(()=>request(false)),y=b.summary();assert.equal(y.reusedSocket,true);assert.equal(y.lookupWaitMs,null);assert.equal(y.tlsHandshakeMs,null);
 assert(!JSON.stringify(x).includes('private'));assert(!JSON.stringify(x).includes('secret'));probe.close();assert.equal(listeners.size,0);assert.equal(socket.eventNames().length,0);
});
test('native fetch loopback fixture observes actual TCP and response headers without SG or external network',async()=>{
 const server=http.createServer((req,res)=>{res.writeHead(200);res.end('fixture');});server.listen(0,'127.0.0.1');await once(server,'listening');
 const probe=connectionObserver();try{
  const r=await probe.trace(fetch,'http://127.0.0.1:'+server.address().port,{redirect:'manual'});assert.equal(await r.response.text(),'fixture');
  const s=r.summary();assert.equal(s.requestsObserved,1);assert.equal(s.correlated,true);assert.equal(s.socketObserved,true);
  assert(s.tcpConnectMs>=0);assert.equal(s.tlsHandshakeMs,null);assert.equal(s.lookupWaitMs,null);
 }finally{probe.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('unobserved request and transport errors remain unknown or propagate unchanged',async()=>{
 const probe=connectionObserver({subscribe:()=>()=>{}});const response={fixture:true};assert.equal((await probe.trace(async()=>response)).response,response);
 const s=(await probe.trace(async()=>response)).summary();assert.equal(s.correlated,false);assert.equal(s.reusedSocket,null);assert.equal(s.tcpConnectMs,null);
 const error=new Error('synthetic');await assert.rejects(probe.trace(async()=>{throw error;}),e=>e===error);probe.close();
});

test('overlapping requests remain isolated and closed observers detach socket listeners',async()=>{
 const listeners=new Map();let time=0;const probe=connectionObserver({now:()=>time,subscribe:(n,f)=>{listeners.set(n,f);return()=>listeners.delete(n);}});
 const emit=(n,v)=>listeners.get(n)?.(v),a={},b={},sa=new EventEmitter(),sb=new EventEmitter();
 let finishA,finishB;
 const pending=(request,socket,setFinish)=>probe.trace(async()=>{
  emit('undici:request:create',{request});emit('net.client.socket',{socket});socket.emit('connect');
  emit('undici:client:sendHeaders',{request,socket});await new Promise(resolve=>setFinish(resolve));
  emit('undici:request:headers',{request});return request;
 });
 const pa=pending(a,sa,f=>{finishA=f;});time=10;const pb=pending(b,sb,f=>{finishB=f;});
 time=30;finishB();const rb=await pb;time=70;finishA();const ra=await pa;
 assert.equal(ra.summary().afterHeadersWriteMs,70);assert.equal(rb.summary().afterHeadersWriteMs,20);
 assert.equal(ra.summary().requestsObserved,1);assert.equal(rb.summary().requestsObserved,1);
 probe.close();probe.close();assert.equal(listeners.size,0);assert.equal(sa.eventNames().length,0);assert.equal(sb.eventNames().length,0);
});
