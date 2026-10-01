import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import {PassThrough} from 'node:stream';
import {captureSessionLanes} from './session-lanes.mjs';
import {sessionWorker,sessionLayout} from './session-layout.mjs';
import {pearlSession} from '../trial/pearl-session.mjs';
import {rhinoSession} from '../trial/rhino-session.mjs';
import fs from 'node:fs';
const base=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32795'];
const plan={...base,countAllocation:'a'.repeat(64),sessionLayout:{schema:'sg-independent-sessions-v1',group:'primary',hosts:20,lanesPerHost:4}};
for(const canary of [true,false])for(const lanes of [2,4])test(`${canary?'canary':'normal'} launcher drains ${lanes} real children before returning complete logs`,async()=>{
 const childScript=`const fs=require('node:fs');const input=fs.createReadStream(null,{fd:3});let data='';input.on('data',x=>data+=x);input.on('end',()=>{
 if(!JSON.parse(data).fixture)process.exit(2);const row=JSON.stringify({lane:process.env.SG_SESSION_LANE,text:'x'.repeat(150000)});
 let offset=0;function send(){if(offset>=row.length){process.stdout.write('\\n');return;}process.stdout.write(row.slice(offset,offset+997));offset+=997;setImmediate(send);}send();});`;
 const script=`import {spawn} from 'node:child_process';
import {PassThrough} from 'node:stream';import {captureSessionLanes} from './scripts/runner-v2/session-lanes.mjs';
 const plan=${JSON.stringify({...plan,sessionLayout:{...plan.sessionLayout,lanesPerHost:lanes}})};
 const result=await captureSessionLanes({plan,host:0,group:'primary',env:{...process.env,...${JSON.stringify(canary?{SG_CANARY_SCHEDULE:'fixture'}:{})}},history:{fixture:true},
 spawnImpl:(exe,args,options)=>spawn(exe,['-e',${JSON.stringify(childScript)}],options)});process.exitCode=result;`;
 const output=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});let out='',err='';
  child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);
  child.on('close',code=>code===0?resolve(out):reject(new Error(`launcher exit ${code}: ${err}`)));
 });
 const rows=output.trim().split('\n').map(line=>JSON.parse(line));assert.equal(rows.length,lanes);
 assert.equal(new Set(rows.map(row=>row.lane)).size,lanes);assert(rows.every(row=>row.text==='x'.repeat(150000)));
});
test('Rhino opt-in yields forty independent sessions without expanding old single-session plans',()=>{
 const b=JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8'))['32799'],p={...b,countAllocation:'a'.repeat(64),sessionLayout:{...plan.sessionLayout,lanesPerHost:2}};
 const game={mode:'demo',sessionId:'Free:synthetic',operatorId:'fixture'},run='1:1:00000000-0000-0000-0000-000000000001',ids=new Set();
 for(let host=0;host<20;host++)for(let lane=0;lane<2;lane++)ids.add(rhinoSession(game,p,sessionWorker(p,host,'primary',lane),run));
 assert.equal(ids.size,40);assert.throws(()=>rhinoSession(game,{...b,countAllocation:p.countAllocation},40,run));
 for(const worker of [20,39,60,80,-1])assert.throws(()=>rhinoSession(game,p,worker,run));
 assert.throws(()=>rhinoSession(game,p,0,'old-run'));
});
test('80 unique session identities retain 20 host jobs and disjoint group/lane identifiers',()=>{
 const sessions=new Set(),workers=new Set(),game={mode:'demo',sessionId:'Free:synthetic',operatorId:'fixture'};
 for(let host=0;host<20;host++)for(let lane=0;lane<4;lane++){
  const worker=sessionWorker(plan,host,'primary',lane);workers.add(worker);
  sessions.add(pearlSession(game,plan,worker,'1:1:00000000-0000-0000-0000-000000000001'));
 }
 assert.equal(workers.size,80);assert.equal(sessions.size,80);
 assert.throws(()=>sessionWorker(plan,0,'secondary',0));
 assert.throws(()=>sessionWorker({...base,countAllocation:'a'.repeat(64)},0,'primary',1));
 assert.throws(()=>sessionLayout(plan,{sessionLayout:{...plan.sessionLayout,lanesPerHost:2}}));
});
test('each lane is a separate child with a private pipe; a failed lane is never replayed',async()=>{
 const children=[],options=[];
 const spawnImpl=(exe,args,option)=>{
  options.push(option);const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.exitCode=null;c.kill=()=>{};
  const p=new EventEmitter();p.end=data=>{assert.deepEqual(JSON.parse(data),{synthetic:true});};c.stdio=[null,null,null,p];
  children.push(c);queueMicrotask(()=>{c.exitCode=children.indexOf(c)===1?2:0;c.stdout.end();c.stderr.end();c.emit('exit',c.exitCode);});return c;
 };
 assert.equal(await captureSessionLanes({plan,host:3,group:'primary',env:{GITHUB_OUTPUT:'private',SG_TRIAL_SHARD:'3'},history:{synthetic:true},spawnImpl}),2);
 assert.equal(children.length,4);
 assert.deepEqual(options.map(o=>o.env.SG_SESSION_LANE),['0','1','2','3']);
 assert(options.every(o=>!o.env.GITHUB_OUTPUT&&o.env.SG_TRIAL_SHARD==='3'));
 assert.equal(new Set(children.map(c=>c.stdio[3])).size,4);
});
test('shutdown signals every child without restarting; pre-aborted work cannot start',async()=>{
 const controller=new AbortController();let started=0,signals=0;
 const spawnImpl=()=>{started++;const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.exitCode=null;c.kill=s=>{assert.equal(s,'SIGTERM');signals++;c.exitCode=0;c.stdout.end();c.stderr.end();c.emit('exit',0);};
  const pipe=new EventEmitter();pipe.end=()=>{};c.stdio=[null,null,null,pipe];return c;};
 const run=captureSessionLanes({plan,host:0,group:'primary',env:{},history:null,spawnImpl,signal:controller.signal});
 controller.abort();await run;assert.equal(started,4);assert.equal(signals,4);
 assert.equal(await captureSessionLanes({plan,host:0,group:'primary',env:{},history:null,spawnImpl,signal:controller.signal}),2);
 assert.equal(started,4);
});
test('four real offline child processes receive isolated identities and complete private handoff',async()=>{
 const outputs=[];
 const script=`const fs=require('node:fs');let data='';const input=fs.createReadStream(null,{fd:3});
 input.on('data',x=>data+=x);input.on('end',()=>{if(JSON.parse(data).fixture!==true)process.exit(2);
 console.log(JSON.stringify({pid:process.pid,lane:process.env.SG_SESSION_LANE,host:process.env.SG_TRIAL_SHARD}));});`;
 const spawnImpl=(exe,args,options)=>{
  const child=spawn(exe,['-e',script],{...options,stdio:['ignore','pipe','pipe','pipe']});
  let data='';child.stdout.on('data',x=>data+=x);child.on('exit',()=>outputs.push(JSON.parse(data)));return child;
 };
 assert.equal(await captureSessionLanes({plan,host:0,group:'primary',env:{...process.env,SG_TRIAL_SHARD:'0'},history:{fixture:true},spawnImpl}),0);
 assert.equal(outputs.length,4);assert.equal(new Set(outputs.map(o=>o.pid)).size,4);
 assert.deepEqual(outputs.map(o=>o.lane).sort(),['0','1','2','3']);assert(outputs.every(o=>o.host==='0'));
});
