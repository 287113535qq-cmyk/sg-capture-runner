import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import path from 'node:path';
import {applyFormalCount} from '../runner-v2/formal-count-plan.mjs';
import {gameForShard} from './demo-sessions.mjs';import {createHash} from 'node:crypto';

test('real generic worker executable derives repaired Pyramids fresh identity before register and never requests source',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-coins-20261001.json','utf8'));
 const plan=applyFormalCount(JSON.parse(fs.readFileSync('config/round-one-plans.json','utf8')),profile)[32721];
 const base={id:32721,runtimeSlug:plan.runtimeSlug,mode:'demo',serverAddress:'ogs-gdm-usnj.nyxop.net/nextgen',sessionId:'Free:synthetic-only',operatorId:'synthetic'};
 const old=gameForShard(base,20,plan.trialId,plan),oldHash=createHash('sha256').update(old.sessionId+'@'+old.operatorId).digest('hex');
 const rpc=`import assert from 'node:assert/strict';export function connect(){return {metrics:({final=false}={})=>({resourceObservation:final?{windows:{schema:'sg-resource-windows-v1',buckets:[{startMs:60000,endMs:120000,coveredMs:60000}]}}:{windowsOmitted:true}}),close(){},async rpc(op,r){if(op==='status')return {status:'pending'};assert.equal(op,'register');assert.equal(r.shardId,20);assert.notEqual(r.sessionHash,${JSON.stringify(oldHash)});assert.match(r.owner,/^999:1:pyramids-formal-capture:/);console.log('FIXTURE_FRESH_REGISTER');throw Object.assign(new Error('FIXTURE_REGISTER_STOP'),{code:'FIXTURE_REGISTER_STOP'});}};}`;
 const code=`import fs from 'node:fs';import {registerHooks} from 'node:module';const read=fs.readFileSync;
 fs.readFileSync=function(p,...args){if(String(p).replaceAll('\\\\','/')==='config/round-one-active.json')return ${JSON.stringify(JSON.stringify(plan))};return read.call(this,p,...args);};
 globalThis.fetch=()=>{throw new Error('UNEXPECTED_SOURCE');};
 registerHooks({load(url,c,next){if(url.endsWith('/scripts/trial/rpc.mjs'))return {format:'module',source:${JSON.stringify(rpc)},shortCircuit:true};return next(url,c);}});
 await import(${JSON.stringify(pathToFileURL(path.resolve('scripts/trial/worker.mjs')).href)});`;
 const env={...process.env,SG_TRIAL_PLAN:'config/round-one-active.json',SG_TRIAL_DEMO_CONFIG:JSON.stringify(base),
  GITHUB_REPOSITORY:'287113535qq-cmyk/sg-capture-runner',GITHUB_RUN_ID:'999',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'pyramids-formal-capture',GITHUB_SHA:'b'.repeat(40),SG_TRIAL_SHARD:'0',SG_SESSION_LANE:'0',SG_POOL_RUN_LIMIT:'0'};
 delete env.GITHUB_OUTPUT;delete env.GITHUB_STEP_SUMMARY;
 const r=spawnSync(process.execPath,['--input-type=module','-e',code],{env,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 assert.ifError(r.error);assert.equal(r.status,2,r.stderr);assert.match(r.stdout,/FIXTURE_FRESH_REGISTER/);
 const evidence=r.stdout.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).find(x=>x.schema==='sg-work-pool-v1');
 assert.equal(evidence.sourceRequests,0);assert.equal(evidence.error,'FIXTURE_REGISTER_STOP');
 const final=r.stdout.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x)).find(x=>x.schema==='sg-capture-performance-v1'&&x.reason==='final');
 assert.deepEqual(final.rpcMetrics.resourceObservation.windows.buckets,[{startMs:60000,endMs:120000,coveredMs:60000}]);
 assert.equal(evidence.rpcMetrics.resourceObservation.windowsOmitted,true);
});
