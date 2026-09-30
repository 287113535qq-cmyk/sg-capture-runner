import {AsyncLocalStorage} from 'node:async_hooks';
import {channel} from 'node:diagnostics_channel';

// Passive diagnostic subscriptions. No endpoint, headers, address, payload,
// socket identifier, credential, or certificate is returned or logged.
export function connectionObserver({now=()=>performance.now(),subscribe}={}){
 const context=new AsyncLocalStorage(),requests=new WeakMap(),sockets=new WeakMap(),live=new Set(),cleanup=[];
 let closed=false;
 const safe=fn=>(...args)=>{try{fn(...args);}catch{}};
 const on=(name,fn)=>{const listener=safe(fn);
  if(subscribe){cleanup.push(subscribe(name,listener));return;}
  const c=channel(name);c.subscribe(listener);cleanup.push(()=>c.unsubscribe(listener));};
 const stamp=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>=a?Math.round((b-a)*1000)/1000:null;
 on('undici:request:create',({request})=>{
  const s=context.getStore();if(!s||closed)return;s.requests++;s.created=now();requests.set(request,s);
 });
 on('net.client.socket',({socket})=>{
  if(!context.getStore()||closed||sockets.has(socket))return;
  const d={start:now(),uses:0,listeners:[]};sockets.set(socket,d);live.add(socket);
  const once=(event,fn)=>{const cb=safe(fn);socket.once(event,cb);d.listeners.push([event,cb]);};
  once('lookup',()=>{d.lookup=now();});once('connect',()=>{d.tcp=now();});
  once('secureConnect',()=>{d.tls=now();d.tlsSessionReused=Boolean(socket.isSessionReused?.());});
  once('close',()=>{live.delete(socket);for(const[e,cb]of d.listeners)socket.removeListener(e,cb);});
 });
 on('undici:client:sendHeaders',({request,socket})=>{
  const s=requests.get(request);if(!s||closed)return;
  s.sent=now();const d=sockets.get(socket);s.connection=d;
  // An unobserved pre-existing socket is unknown, never reported as new.
  if(d){s.reused=d.uses>0;d.uses++;}
 });
 on('undici:request:headers',({request})=>{const s=requests.get(request);if(s&&!closed)s.headers=now();});
 return {
  async trace(call,...args){
   const s={start:now(),requests:0};const response=await context.run(s,()=>call(...args));
   return {response,summary(){
    const d=s.connection,one=s.requests===1;
    return {schema:'sg-connection-observation-v1',requestsObserved:s.requests,
     correlated:one&&Number.isFinite(s.sent)&&Number.isFinite(s.headers),
     socketObserved:one&&Boolean(d),reusedSocket:one&&d?Boolean(s.reused):null,
     beforeRequestMs:one?stamp(s.start,s.created):null,
     beforeHeadersWriteMs:one?stamp(s.created,s.sent):null,
     afterHeadersWriteMs:one?stamp(s.sent,s.headers):null,
     lookupWaitMs:one&&d&&!s.reused?stamp(d.start,d.lookup):null,
     tcpConnectMs:one&&d&&!s.reused?stamp(d.lookup??d.start,d.tcp):null,
     tlsHandshakeMs:one&&d&&!s.reused?stamp(d.tcp,d.tls):null,
     tlsSessionReused:one&&d&&!s.reused&&Number.isFinite(d.tls)?d.tlsSessionReused:null};
   }};
  },
  close(){closed=true;for(const fn of cleanup)fn?.();for(const socket of live){const d=sockets.get(socket);for(const[e,cb]of d.listeners)socket.removeListener(e,cb);}live.clear();context.disable();},
 };
}
