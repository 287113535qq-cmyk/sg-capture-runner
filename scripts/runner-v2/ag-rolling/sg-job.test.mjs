import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {runRollingJob} from './sg-job.mjs';
function fixture(){
 const children=[];
 const spawnProcess=(exe,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{exe,args,options,connected:args[1]==='controller',signals:[],messages:[]});
  child.kill=signal=>{child.signals.push(signal);child.connected=false;child.emit('close',null,signal);};
  child.send=(message,callback)=>{child.messages.push(message);callback?.();};
  children.push(child);return child;
 };
 return {children,spawnProcess};
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
 f.children[0].emit('error',Error('synthetic-spawn-error'));await new Promise(r=>setImmediate(r));assert.equal(finished,false);
 f.children[0].emit('close',null,null);assert.equal(await done,2);
});
test('business credentials stay in the controller and never enter a source child',async()=>{
 const f=fixture(),done=runRollingJob({lane:20,environment:{...environment,SG_BUSINESS_MONGO_PASSWORD:'synthetic-only',SG_BUSINESS_SSH_KEY_FILE:'synthetic-only'},spawnProcess:f.spawnProcess,log:()=>{}});
 const [controller,source]=f.children;assert.equal(controller.options.env.SG_BUSINESS_MONGO_PASSWORD,'synthetic-only');
 assert.equal(source.options.env.SG_BUSINESS_MONGO_PASSWORD,undefined);assert.equal(source.options.env.SG_BUSINESS_SSH_KEY_FILE,undefined);
 source.emit('close',0,null);controller.emit('close',0,null);assert.equal(await done,0);
});
