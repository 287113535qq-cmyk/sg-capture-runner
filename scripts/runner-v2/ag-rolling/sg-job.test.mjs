import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {runRollingJob} from './sg-job.mjs';
function fixture(){
 const children=[];
 const spawnProcess=(exe,args,options)=>{
  const child=new EventEmitter();Object.assign(child,{exe,args,options,connected:args[1]==='controller',signals:[],messages:[]});
  child.kill=signal=>{child.signals.push(signal);child.connected=false;child.emit('exit',null,signal);};
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
 assert.equal(f.children.length,1);assert.equal(f.children[0].args[1],'lane');f.children[0].emit('exit',0,null);assert.equal(await done,0);
});
test('ordinary lanes use one child and forward the source result',async()=>{
 const f=fixture(),done=runRollingJob({lane:3,environment,spawnProcess:f.spawnProcess});
 assert.equal(f.children.length,1);assert.equal(f.children[0].options.env.SG_AG_LANE,'3');
 f.children[0].emit('exit',2,null);assert.equal(await done,2);
});
test('lane 20 shares its host with a zero-source controller and waits beyond its own source completion',async()=>{
 const f=fixture();let ended=false;
 const done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,log:()=>{}}).then(code=>{ended=true;return code;});
 const [controller,source]=f.children;
 assert.equal(f.children.length,2);assert.equal(controller.options.env.SG_AG_CONTROLLER_LANE,'20');
 assert.equal(controller.options.env.SG_TRIAL_DEMO_CONFIG,undefined);assert.equal(controller.options.env.SG_AG_LANE,undefined);
 assert.deepEqual(controller.options.stdio,['inherit','inherit','inherit','ipc']);
 source.emit('exit',0,null);await new Promise(r=>setImmediate(r));
 assert.deepEqual(controller.messages,[{type:'lane-source-ended',lane:20}]);assert.equal(ended,false);
 assert.deepEqual(controller.signals,[],'controller remains available for the other 19 lanes');
 controller.emit('exit',0,null);assert.equal(await done,0);
});
test('an early controller failure retains healthy source execution for final reconciliation',async()=>{
 const f=fixture(),reports=[],done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,log:r=>reports.push(JSON.parse(r))});
 const [controller,source]=f.children;controller.connected=false;controller.emit('exit',2,null);
 await new Promise(r=>setImmediate(r));assert.deepEqual(source.signals,[]);assert.equal(reports[0].sourceRequests,0);
 source.emit('exit',0,null);assert.equal(await done,0);assert.deepEqual(controller.messages,[]);
});
test('workflow cancellation terminates both independent processes',async()=>{
 const f=fixture(),stop=new AbortController(),done=runRollingJob({lane:20,environment,spawnProcess:f.spawnProcess,signal:stop.signal,log:()=>{}});
 stop.abort();assert.equal(await done,2);assert.ok(f.children.every(child=>child.signals.includes('SIGTERM')));
});
