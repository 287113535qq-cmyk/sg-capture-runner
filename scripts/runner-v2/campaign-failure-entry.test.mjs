import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';import path from 'node:path';

test('actual campaign process exits after one failed capture instead of retrying a pending pool',()=>{
 const replacements={
  'transport.mjs':`export const connectGateway=()=>({close(){}});`,
  'analyzer.mjs':`export const analyzer=()=>({close(){}});`,
  'resource-gate.mjs':`export class ResourceGate{}`,
  'resource-handoff.mjs':`export const exportResourceHistory=()=>null;`,
  'state-store.mjs':`export class RunnerState{async get(){return {value:{validationLimit:0}};}}`,
  'control.mjs':`export class SourceControl{}`,
  'campaign.mjs':`export class GithubCampaign{async selectForRun(){console.log('FIXTURE_SELECT');return {action:'capture',plan:{}};}async status(){return {globalPaused:false};}}`,
  'session-lanes.mjs':`export async function captureSessionLanes(){console.log('FIXTURE_CAPTURE');return 2;}`,
 };
 // Stub transport and file writes before loading the real executable; no source,
 // SSH, or local production config mutation is possible in this fixture.
 const entry=pathToFileURL(path.resolve('scripts/runner-v2/campaign-worker.mjs')).href;
 const code=`import {registerHooks} from 'node:module';import fs from 'node:fs';
 fs.writeFileSync=()=>{};const replacements=${JSON.stringify(replacements)};
 registerHooks({load(url,context,next){const name=url.split('/').at(-1);if(url.includes('/runner-v2/')&&name in replacements)return {format:'module',source:replacements[name],shortCircuit:true};return next(url,context);}});
 await import(${JSON.stringify(entry)});`;
 const env={...process.env,GITHUB_REPOSITORY:'287113535qq-cmyk/sg-capture-runner',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',SG_TRIAL_SHARD:'0',SG_TRIAL_MINUTES:'2'};
 delete env.SG_FORMAL_COUNT_PROFILE;delete env.SG_DEMO_PILOT;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{env,encoding:'utf8',timeout:4000});
 assert.ifError(result.error);assert.equal(result.status,2,result.stderr);
 assert.equal(result.stdout.split('FIXTURE_CAPTURE').length-1,1);assert.equal(result.stdout.split('FIXTURE_SELECT').length-1,1);
});
