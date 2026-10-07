import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {disconnectClosedController} from './sg-controller-ipc-close.mjs';
const moduleUrl=new URL('./sg-controller-ipc-close.mjs',import.meta.url).href;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function actualChild(body,check){
 const code=`import {disconnectClosedController} from ${JSON.stringify(moduleUrl)};
 process.on('message',()=>{});
 ${body}`;
 const child=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe','ipc']});
 let out='',err='',closed=false;const messages=[];
 child.stdout.on('data',v=>{out+=v;});child.stderr.on('data',v=>{err+=v;});
 child.on('message',m=>messages.push(m));
 const close=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>{closed=true;resolve({code,signal});});});
 let bound;
 const timeout=new Promise((_,reject)=>{bound=setTimeout(()=>{child.kill();reject(Error('actual IPC test deadline: '+JSON.stringify({closed,out,err,messages})));},4000);});
 try{await Promise.race([check({child,close,messages,isClosed:()=>closed,stdout:()=>out}),timeout]);const result=await Promise.race([close,timeout]);assert.deepEqual(result,{code:0,signal:null},err);return {out,messages};}
 finally{clearTimeout(bound);if(child.connected)child.disconnect();if(!closed)child.kill();}
}
async function messageSeen(messages){for(let n=0;n<100&&!messages.length;n++)await pause(10);assert(messages.length,'child reached cleanup boundary');}

test('real IPC subscription holds an otherwise cleaned-up controller open',async()=>{
 const result=await actualChild("process.on('message',m=>{if(m?.testHarnessCleanup===true)process.disconnect();});process.send({cleanupComplete:true});",async({child,messages,isClosed})=>{
  await messageSeen(messages);await pause(120);assert.equal(isClosed(),false);
  // Test-only child cleanup after the baseline stall is observed.
  child.send({testHarnessCleanup:true});
 });assert.deepEqual(result.messages,[{cleanupComplete:true}]);
});
test('real controller exits after cleanup and its own explicit IPC disconnect',async()=>{
 const result=await actualChild("process.send({cleanupComplete:true},()=>{disconnectClosedController({mode:'controller'});});",async({close})=>{await close;});
 assert.deepEqual(result.messages,[{cleanupComplete:true}]);
});
test('IPC disconnect cannot hide an outstanding asynchronous cleanup handle',async()=>{
 const result=await actualChild("process.send({cleanupComplete:true},()=>{setTimeout(()=>process.stdout.write('remaining-handle-finished'),200);disconnectClosedController({mode:'controller'});});",async({messages,isClosed,close})=>{
  await messageSeen(messages);await pause(60);assert.equal(isClosed(),false);await close;
 });assert.equal(result.out,'remaining-handle-finished');
});
test('source lanes and finalizers retain their existing process semantics',()=>{
 for(const mode of ['lane','admit','join','reconcile','preparation-close']){
  assert.deepEqual(disconnectClosedController({mode,actor:{connected:true,disconnect(){throw Error('unwanted disconnect');}}}),{disconnected:false});
 }
});
test('closed IPC is a no-op and disconnect failures are not disguised as success',()=>{
 assert.deepEqual(disconnectClosedController({mode:'controller',actor:{connected:false}}),{disconnected:false});
 assert.throws(()=>disconnectClosedController({mode:'controller',actor:{connected:true}}),/DISCONNECT_REQUIRED/);
 assert.throws(()=>disconnectClosedController({mode:'controller',actor:{connected:true,disconnect(){throw Error('known failure');}}}),/known failure/);
});
test('live callsite disconnects only after existing cleanup and transport metrics',()=>{
 const source=fs.readFileSync(new URL('./sg-live.mjs',import.meta.url),'utf8');
 assert(source.indexOf('await closeSealedSource(')<source.lastIndexOf('disconnectClosedController({mode})'));
 assert.match(source,/transport\.metrics\(\)\}\)\);transport\.close\(\);disconnectClosedController\(\{mode\}\);\}/);
});
