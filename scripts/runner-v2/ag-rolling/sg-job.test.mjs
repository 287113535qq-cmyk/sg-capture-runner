import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {runRollingJob} from './sg-job.mjs';
import {LANE_BUDGET_MS} from './ag-core.mjs';
function fixture(){
 const children=[];
 const spawnProcess=(exe,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{pid:1000+children.length,exe,args,options,connected:args[1]==='controller',signals:[],messages:[]});
  child.kill=signal=>{child.signals.push(signal);child.connected=false;child.emit('close',null,signal);};
  child.send=(message,callback)=>{child.messages.push(message);callback?.();};
  children.push(child);return child;
 };
 return {children,spawnProcess};
}
function fakeClock(){
 let now=0;const active=new Set();
 return {
  setTimer(fn,ms){const token={at:now+ms,fn};active.add(token);return token;},
  clearTimer(token){active.delete(token);},
  advance(ms){const end=now+ms;let next;
   while((next=[...active].filter(t=>t.at<=end).sort((a,b)=>a.at-b.at)[0])){now=next.at;active.delete(next);next.fn();}
   now=end;
  },
  pending:()=>active.size
 };
}
const environment={SG_TRIAL_DEMO_CONFIG:'offline-placeholder',SG_AG_LANE:'20',GH_TOKEN:'offline-gh-placeholder'};
test('every AG workflow entry point installs locked module dependencies and has no extra concurrent controller job',()=>{
 const require=createRequire(import.meta.url),yaml=require('../../../collector/node_modules/js-yaml');
 const workflow=yaml.load(fs.readFileSync('.github/workflows/trial-300k.yml','utf8'));
 for(const id of ['ag-rolling-admit','ag-rolling-capture','ag-rolling-finalize','ag-rolling-join','ag-rolling-companion-capture','ag-rolling-preparation-close']){
  const steps=workflow.jobs[id].steps,install=steps.findIndex(s=>s['working-directory']==='collector'&&s.run==='npm ci --ignore-scripts --no-audit --no-fund');
  const entry=steps.findIndex(s=>s.run?.startsWith('node scripts/runner-v2/ag-rolling/'));
  assert.ok(install>=0&&install<entry,id+' must install before module evaluation');
 }
 assert.equal(workflow.jobs['ag-rolling-controller'],undefined);
 assert.equal(workflow.jobs['ag-rolling-capture'].strategy['max-parallel'],20);
 assert.equal(workflow.jobs['ag-rolling-capture'].strategy.matrix.lane.length,20);
 assert.deepEqual(workflow.jobs['ag-rolling-companion-capture'].strategy,workflow.jobs['ag-rolling-capture'].strategy);
 assert.ok(workflow.jobs.verify.if.includes("!startsWith(inputs.role, 'ag-rolling')"));
});
test('secondary lane twenty uses one source child, leaving exactly forty source jobs and one primary controller process',async()=>{
 const f=fixture(),done=runRollingJob({lane:20,environment:{...environment,GITHUB_REPOSITORY:'287113535qq-cmyk/sg-capture-runner'},spawnProcess:f.spawnProcess});
 assert.equal(f.children.length,1);assert.equal(f.children[0].args[1],'lane');f.children[0].emit('close',0,null);assert.equal(await done,0);
});
test('ordinary lanes use one child and forward the source result',async()=>{
 const f=fixture(),done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess});
 assert.equal(f.children.length,1);assert.equal(f.children[0].options.env.SG_AG_LANE,'3');
 f.children[0].emit('close',2,null);assert.equal(await done,2);
});
test('lane 20 shares its host with a zero-source controller and waits beyond its own source completion',async()=>{
 const f=fixture();let ended=false;
 const done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,log:()=>{}}).then(code=>{ended=true;return code;});
 const [controller,source]=f.children;
 assert.equal(f.children.length,2);assert.equal(controller.options.env.SG_AG_CONTROLLER_LANE,'20');
 assert.equal(controller.options.env.SG_TRIAL_DEMO_CONFIG,undefined);assert.equal(controller.options.env.SG_AG_LANE,undefined);
 assert.deepEqual(controller.options.stdio,['inherit','inherit','inherit','ipc']);
 source.emit('exit',0,null);await new Promise(r=>setImmediate(r));
 assert.deepEqual(controller.messages,[]);assert.equal(ended,false);
 source.emit('close',0,null);await new Promise(r=>setImmediate(r));
 assert.equal(controller.messages.length,1);assert.equal(controller.messages[0].type,'lane-source-ended');assert.equal(controller.messages[0].sourceClosed,true);assert.equal(ended,false);
 assert.deepEqual(controller.signals,[],'controller remains available for the other 19 lanes');
 controller.emit('close',0,null);assert.equal(await done,0);
});
test('an early controller failure retains healthy source execution for final reconciliation',async()=>{
 const f=fixture(),reports=[],done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,log:r=>reports.push(JSON.parse(r))});
 const [controller,source]=f.children;controller.connected=false;controller.emit('close',2,null);
 await new Promise(r=>setImmediate(r));assert.deepEqual(source.signals,[]);assert.equal(reports[0].sourceRequests,0);
 source.emit('close',0,null);assert.equal(await done,0);assert.deepEqual(controller.messages,[]);
});
test('workflow cancellation terminates both independent processes',async()=>{
 const f=fixture(),stop=new AbortController(),done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,signal:stop.signal,log:()=>{}});
 stop.abort();assert.equal(await done,2);assert.ok(f.children.every(child=>child.signals.includes('SIGTERM')));
});
test('a real exited source remains active until its inherited output pipe closes',async()=>{
 let child,finished=false;
 const done=runRollingJob({lane:3,environment,spawnProcess:(exe)=>{
  child=spawn(exe,['-e',"require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},350)'],{stdio:['ignore',1,2]});process.exit(0)"],{stdio:['ignore','pipe','pipe']});return child;
 }}).then(code=>{finished=true;return code;});
 await new Promise(resolve=>child.once('exit',resolve));
 assert.equal(finished,false);assert.equal(await done,0);
});
test('spawn errors without a PID wait for close and cannot announce an ended source',async()=>{
 const f=fixture();let finished=false;
 const done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess}).then(code=>{finished=true;return code;});
 f.children[0].pid=undefined;f.children[0].emit('error',Error('synthetic-spawn-error'));await new Promise(r=>setImmediate(r));assert.equal(finished,false);
 assert.deepEqual(f.children[0].signals,[]);
 f.children[0].emit('close',null,null);assert.equal(await done,2);
});

test('fixed AG process budget terminates both hung children and escalates after exactly five seconds',async()=>{
 const f=fixture(),clock=fakeClock();let finished=false;
 const done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,...clock,log:()=>{}}).then(code=>{finished=true;return code;});
 assert.equal(LANE_BUDGET_MS,340*60000);
 for(const child of f.children)child.kill=signal=>{child.signals.push(signal);return true;};
 clock.advance(LANE_BUDGET_MS-1);assert.ok(f.children.every(c=>c.signals.length===0));
 clock.advance(1);assert.ok(f.children.every(c=>c.signals.join(',')==='SIGTERM'));
 clock.advance(4999);assert.equal(finished,false);assert.deepEqual(f.children[0].messages,[]);
 clock.advance(1);assert.ok(f.children.every(c=>c.signals.join(',')==='SIGTERM,SIGKILL'));
 assert.equal(finished,false,'a successful kill call is not proof of close');
 for(const child of f.children)child.emit('close',null,'SIGKILL');
 assert.equal(await done,2);assert.equal(clock.pending(),0);
});

test('a completed lane cannot restart the fixed budget for its still-running controller',async()=>{
 const f=fixture(),clock=fakeClock(),done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,...clock,log:()=>{}});
 const [controller,source]=f.children;
 clock.advance(LANE_BUDGET_MS-10);source.emit('close',0,null);await new Promise(r=>setImmediate(r));
 assert.equal(controller.messages.length,1);clock.advance(10);
 assert.equal(await done,2);assert.deepEqual(source.signals,[]);assert.deepEqual(controller.signals,['SIGTERM']);assert.equal(clock.pending(),0);
});

test('cancellation racing the budget sends one TERM and keeps the first five-second escalation',async()=>{
 const f=fixture(),clock=fakeClock(),stop=new AbortController();
 const done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess,signal:stop.signal,...clock});
 const source=f.children[0];source.kill=signal=>{source.signals.push(signal);return true;};
 clock.advance(LANE_BUDGET_MS-1);stop.abort();clock.advance(1);assert.deepEqual(source.signals,['SIGTERM']);
 clock.advance(4999);assert.deepEqual(source.signals,['SIGTERM','SIGKILL']);
 source.emit('close',0,null);assert.equal(await done,2,'even a graceful close after cancellation remains a failed job');
 assert.equal(clock.pending(),0);
});

test('kill errors and missing close fail boundedly without sending a fabricated source-ending message',async()=>{
 const f=fixture(),clock=fakeClock(),reports=[];
 const done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,...clock,log:r=>reports.push(JSON.parse(r))});
 const [controller,source]=f.children;
 for(const child of f.children)child.kill=signal=>{child.signals.push(signal);child.emit('error',Error('synthetic-kill-error'));throw Error('synthetic-kill-throw');};
 const rejected=assert.rejects(done,error=>error.message==='SG_AG_JOB_CLOSE_UNKNOWN_RETAINED'&&error.outcomeUnknown===true&&error.sourceClosed===false);
 clock.advance(LANE_BUDGET_MS);clock.advance(5000);assert.deepEqual(controller.messages,[]);assert.deepEqual(reports,[]);
 clock.advance(5000);await rejected;assert.equal(clock.pending(),0);
 assert.deepEqual(source.signals,['SIGTERM','SIGKILL']);assert.deepEqual(controller.messages,[]);
});

test('failed kill return and an exit event alone never become a closed source',async()=>{
 const f=fixture(),clock=fakeClock(),stop=new AbortController();
 const done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess,signal:stop.signal,...clock});
 const source=f.children[0];source.kill=signal=>{source.signals.push(signal);return false;};
 source.emit('exit',0,null);stop.abort();
 const rejected=assert.rejects(done,/SG_AG_JOB_CLOSE_UNKNOWN_RETAINED/);
 clock.advance(10000);await rejected;assert.equal(clock.pending(),0);
});

test('controller error terminates only that controller and leaves healthy source available to final reconciliation',async()=>{
 const f=fixture(),clock=fakeClock(),done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,...clock,log:()=>{}});
 const [controller,source]=f.children;controller.emit('error',Error('synthetic-controller-error'));
 await new Promise(r=>setImmediate(r));assert.deepEqual(source.signals,[]);assert.deepEqual(controller.signals,['SIGTERM']);
 source.emit('close',0,null);assert.equal(await done,0);assert.equal(clock.pending(),0);
});

test('normal close clears the process watchdog before its later deadline',async()=>{
 const f=fixture(),clock=fakeClock(),done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess,...clock});
 f.children[0].emit('close',0,null);assert.equal(await done,0);assert.equal(clock.pending(),0);
 clock.advance(LANE_BUDGET_MS+10000);assert.deepEqual(f.children[0].signals,[]);
});

test('the independent watchdog ends an actual unresponsive subprocess',async t=>{
 const clock=fakeClock();let child;
 const done=runRollingJob({lane:3,environment,...clock,spawnProcess:exe=>{
  child=spawn(exe,['-e',"process.stdout.write('ready\\n');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','pipe']});return child;
 }});
 t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL');});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
 clock.advance(LANE_BUDGET_MS);assert.equal(await done,2);assert.equal(clock.pending(),0);
 assert.notEqual(child.signalCode,null);
});

test('a real child with failed kill remains unknown until host cleanup, without delaying owner failure',async t=>{
 const clock=fakeClock();let child,actualKill;
 const done=runRollingJob({lane:3,environment,...clock,spawnProcess:exe=>{
  child=spawn(exe,['-e',"process.stdout.write('ready\\n');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','pipe']});
  actualKill=child.kill.bind(child);child.kill=()=>{throw Error('synthetic-OS-kill-refusal');};return child;
 }});
 t.after(async()=>{if(child.exitCode===null){const closed=new Promise(resolve=>child.once('close',resolve));actualKill('SIGKILL');await closed;}});
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);});
 const rejected=assert.rejects(done,error=>error.outcomeUnknown===true&&error.sourceClosed===false);
 clock.advance(LANE_BUDGET_MS+10000);await rejected;
 assert.equal(child.exitCode,null);assert.equal(child.signalCode,null);assert.equal(clock.pending(),0);
});
test('business credentials stay in the controller and never enter a source child',async()=>{
 const f=fixture(),done=runRollingJob({lane:20,environment:{...environment,SG_BUSINESS_MONGO_PASSWORD:'synthetic-only',SG_BUSINESS_SSH_KEY_FILE:'synthetic-only'},spawnProcess:f.spawnProcess,log:()=>{}});
 const [controller,source]=f.children;assert.equal(controller.options.env.SG_BUSINESS_MONGO_PASSWORD,'synthetic-only');
 assert.equal(source.options.env.SG_BUSINESS_MONGO_PASSWORD,undefined);assert.equal(source.options.env.SG_BUSINESS_SSH_KEY_FILE,undefined);
 source.emit('close',0,null);controller.emit('close',0,null);assert.equal(await done,0);
});
