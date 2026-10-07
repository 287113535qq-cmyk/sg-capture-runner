import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {closeSealedSource,SEALED_CLEANUP_MS,UNSEALED_CLEANUP_MS} from './sg-sealed-cleanup.mjs';

function fixture(sourceSealed=true){
 const events=[];let timer,resolve,reject;
 const closing=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const args={sourceSealed,close:()=>{events.push('close');return closing;},
  writeSync:line=>{events.push(['sync-log',JSON.parse(line)]);},closeTransport:()=>events.push('transport-close'),exit:code=>events.push(['exit',code]),
  setTimer:(callback,ms)=>{timer=callback;events.push(['timer',ms]);return 7;},clearTimer:id=>events.push(['clear',id])};
 return {args,events,resolve,reject,fire:()=>timer?.()};
}

test('unsealed failure or live source never arms a success exit even when close stalls',async()=>{
 const f=fixture(false),pending=closeSealedSource(f.args);f.fire();
 assert.deepEqual(f.events.slice(0,2),[['timer',UNSEALED_CLEANUP_MS],'close']);
 assert.deepEqual(f.events[2],['sync-log',{code:'SG_AG_UNSEALED_CLEANUP_TIMEOUT',sourceSealed:false,businessCloseCompleted:false,outcomeUnknown:true,stateRetained:true,sourceRequests:0}]);
 assert.deepEqual(f.events.slice(3),['transport-close',['exit',2]]);
 f.reject(Error('close failed'));await assert.rejects(pending,/close failed/);assert.deepEqual(f.events.at(-1),['clear',7]);
});

test('unsealed successful and failed cleanup both cancel their finite watchdog',async()=>{
 for(const failed of [false,true]){const f=fixture(false),pending=closeSealedSource(f.args);
  if(failed)f.reject(Error('failed'));else f.resolve();
  if(failed)await assert.rejects(pending,/failed/);else await pending;
  assert.deepEqual(f.events,[['timer',UNSEALED_CLEANUP_MS],'close',['clear',7]]);
 }
});

test('unsealed close exits failed even when diagnostic or transport close throws',async()=>{
 for(const broken of ['writeSync','closeTransport']){const f=fixture(false);f.args[broken]=()=>{throw Error('cleanup fault');};
  const pending=closeSealedSource(f.args);assert.throws(()=>f.fire(),/cleanup fault/);
  assert.deepEqual(f.events.at(-1),['exit',2]);f.resolve();await pending;
 }
});

test('sealed source close gets ninety seconds, synchronously records incomplete cleanup and closes native before exiting',async()=>{
 const f=fixture(),pending=closeSealedSource(f.args);assert.deepEqual(f.events,[['timer',SEALED_CLEANUP_MS],'close']);
 f.fire();assert.equal(f.events[2][0],'sync-log');assert.equal(f.events[2][1].code,'SG_AG_SOURCE_SEALED_CLEANUP_TIMEOUT');
 assert.equal(f.events[2][1].businessCloseCompleted,false);assert.deepEqual(f.events.slice(3),['transport-close',['exit',0]]);
 f.resolve();await pending;assert.deepEqual(f.events.at(-1),['clear',7]);
});

test('successful or rejected close cancels the sealed cleanup watchdog without claiming it succeeded',async()=>{
 for(const failed of [false,true]){
  const f=fixture(),pending=closeSealedSource(f.args);if(failed)f.reject(Error('close failed'));else f.resolve();
  if(failed)await assert.rejects(pending,/close failed/);else await pending;
  assert.deepEqual(f.events,[['timer',SEALED_CLEANUP_MS],'close',['clear',7]]);
 }
});

test('runtime can enable sealed cleanup only after finalizer returns the native idle full-readback proof',()=>{
 const live=fs.readFileSync(new URL('./sg-live.mjs',import.meta.url),'utf8');
 const helper=fs.readFileSync(new URL('./sg-source-finalizer.mjs',import.meta.url),'utf8');
 const finalizer=live.slice(live.indexOf('  sourceJobsEnded=true;'));
 assert(finalizer.indexOf('await finalizeEndedSource(')<finalizer.indexOf('sourceSealed=true;'));
 assert(finalizer.indexOf('sourceSealed=true;')<finalizer.indexOf('await closeSealedSource('));
 assert.equal(live.match(/sourceSealed=true/g).length,1);
 assert(helper.indexOf('SG_AG_SOURCE_IDLE_FULL_READBACK')<helper.lastIndexOf('return result;'));
 assert(finalizer.includes('writeSync:line=>fs.writeSync(1,line)'));
});
