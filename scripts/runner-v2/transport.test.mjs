import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {connectGateway,gatewayDocumentKind} from './transport.mjs';

Object.assign(process.env,{GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',
 GITHUB_REPOSITORY:'zyzuoyang/sg-capture-runner',SG_SSH_KEY_FILE:'key',SG_SSH_HOSTS_FILE:'hosts',SG_SSH_HOST:'fixed-host'});
function fixture(actions,options={}){
 const children=[],writes=[],argumentsSeen=[];
  const spawnProcess=(_cmd,args)=>{
  argumentsSeen.push(args);
  assert(args.includes('StrictHostKeyChecking=yes'));assert(args.includes('IdentitiesOnly=yes'));
  const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.stdin=new EventEmitter();
  const action=actions[children.length];children.push(c);
  c.kill=()=>queueMicrotask(()=>c.emit('close'));c.stdin.end=()=>{};
  c.stdin.write=input=>{writes.push(JSON.parse(input));queueMicrotask(()=>{
   if(action==='disconnect')c.emit('close');
   else if(action==='reject')c.stdout.emit('data',Buffer.from('{"ok":false,"error":"DENIED"}\n'));
   else if(action!=='timeout')c.stdout.emit('data',Buffer.from('{"ok":true,"result":{"saved":true}}\n'));
  });};return c;
 };
 return {gateway:connectGateway({spawnProcess,pause:async()=>{},ackTimeoutMs:20,...options}),children,writes,argumentsSeen};
}

test('SSH compression changes only transport codec and preserves the exact request and reconnect protections',async()=>{
 const plain=fixture(['ok']),compressed=fixture(['disconnect','ok'],{compression:true});
 const request={collection:'state',key:'validation:1:1:delta'};
 await plain.gateway.request('read',request);await compressed.gateway.request('read',request);
 assert(!plain.argumentsSeen[0].includes('-C'));assert(compressed.argumentsSeen.every(a=>a.includes('-C')));
 assert.deepEqual(compressed.writes[0],plain.writes[0]);assert.deepEqual(compressed.writes[1],plain.writes[0]);
 assert.equal(compressed.gateway.metrics().initialReadReconnects,1);
 plain.gateway.close();compressed.gateway.close();assert.throws(()=>connectGateway({compression:'true'}),/COMPRESSION_MODE/);
});
test('initial pure read reconnects at most twice, retaining request identity',async()=>{
 const f=fixture(['disconnect','disconnect','ok']);
 assert.deepEqual(await f.gateway.request('read',{key:'fixed'}),{saved:true});
 assert.equal(f.children.length,3);assert(f.writes.every(x=>JSON.stringify(x)===JSON.stringify(f.writes[0])));
 assert.equal(f.gateway.metrics().initialReadReconnects,2);f.gateway.close();
});
test('three failed initial reads terminate without further attempts',async()=>{
 const f=fixture(['disconnect','disconnect','disconnect']);await assert.rejects(f.gateway.request('read'),{code:'GATEWAY_DISCONNECTED'});
 assert.equal(f.children.length,3);f.gateway.close();
});
test('mutations and later reads never reconnect',async()=>{
 for(const op of ['create','cas','rounds_insert','resources']){
  const f=fixture(['disconnect','ok']);await assert.rejects(f.gateway.request(op),{code:'GATEWAY_DISCONNECTED'});
  assert.equal(f.children.length,1);f.gateway.close();
 }
 const f=fixture(['ok','ok']);await f.gateway.request('read');f.children[0].emit('close');
 await assert.rejects(f.gateway.request('read'),{code:'GATEWAY_DISCONNECTED'});assert.equal(f.children.length,1);f.gateway.close();
});
test('unknown ACK and explicit rejection cannot trigger recovery',async()=>{
 for(const [action,code] of [['timeout','GATEWAY_ACK_UNKNOWN'],['reject','DENIED']]){
  const f=fixture([action,'ok']);await assert.rejects(f.gateway.request('read'),{code});assert.equal(f.children.length,1);f.gateway.close();
 }
});
test('serial request guard remains active throughout reconnect backoff',async()=>{
 let release,entered;const waiting=new Promise(r=>entered=r);
 const f=fixture(['disconnect','ok'],{pause:()=>{entered();return new Promise(r=>release=r);}});
 const first=f.gateway.request('read');await waiting;
 await assert.rejects(f.gateway.request('cas'),/Concurrent gateway/);release();await first;assert.equal(f.writes.length,2);f.gateway.close();
});
test('closing during reconnect prevents reopening and rejects the initial read',async()=>{
 let release,entered;const waiting=new Promise(r=>entered=r);
 const f=fixture(['disconnect','ok'],{pause:()=>{entered();return new Promise(r=>release=r);}});
 const first=f.gateway.request('read');await waiting;f.gateway.close();release();
 await assert.rejects(first,{code:'GATEWAY_CLOSED'});assert.equal(f.children.length,1);
});
test('old session events cannot resolve or reject the replacement request',async()=>{
 const f=fixture(['disconnect','ok']);await f.gateway.request('read');
 f.children[0].emit('close');f.children[0].stdout.emit('data',Buffer.from('{"ok":true,"result":"stale"}\n'));
 assert.deepEqual(await f.gateway.request('read'),{saved:true});f.gateway.close();
});
test('request fields cannot turn a recoverable read into a mutation',async()=>{
 const f=fixture(['ok']);await assert.rejects(f.gateway.request('read',{op:'cas'}),/override/);
 assert.equal(f.writes.length,0);f.gateway.close();
});
test('document cost labels cannot expose any key or value',async()=>{
 const f=fixture(['ok']);
 for(const [collection,key,label]of [['state','pool:private-trial','statePool'],['state','batch:private-session:7','stateBatch'],['state','private-session','stateOther'],['journal','private-source-key','journal']]){
  assert.equal(gatewayDocumentKind('read',{collection,key}),label);
  await f.gateway.request('read',{collection,key,value:'PRIVATE_SECRET'});
 }
 const metrics=f.gateway.metrics();assert.equal(metrics.documentKindsNestedWithinOperations,true);
 assert.equal(Object.values(metrics.byDocumentKind).reduce((sum,m)=>sum+m.requests,0),4);
 assert.equal(Object.values(metrics.byDocumentKind).reduce((sum,m)=>sum+m.responseBytes,0),metrics.byOperation.read.responseBytes);
 assert.equal(Object.values(metrics.byDocumentKind).reduce((sum,m)=>sum+m.requestBytes,0),metrics.byOperation.read.requestBytes);
 assert(!JSON.stringify(metrics).includes('private'));assert(!JSON.stringify(metrics).includes('PRIVATE_SECRET'));
 assert.equal(gatewayDocumentKind('resources',{}),null);f.gateway.close();
 assert.equal(gatewayDocumentKind('cas_delta',{collection:'state',key:'pool:private-trial'}),'statePool');
});
