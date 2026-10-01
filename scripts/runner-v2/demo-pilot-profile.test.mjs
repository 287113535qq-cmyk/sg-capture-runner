import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {demoPilotProfilePath} from './demo-pilot-profile.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
test('explicit profile routes reviewed names and rejects arbitrary paths',()=>{
 assert.equal(demoPilotProfilePath({}),'config/demo-pilot-beaver-20260930.json');
 assert.equal(demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:'demo-pilot-replacement-20260930.json'}),'config/demo-pilot-replacement-20260930.json');
 for(const name of ['../other.json','arbitrary.json','/tmp/permit'])assert.throws(()=>demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:name}),/DEMO_PROFILE_PATH/);
});
test('old dispatched profile stays frozen and cannot authorize changed runtime',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8'));
 assert.equal(hash(p),'9a4d0db5fa18564d9cee14c1b6c7891217b23dd77027d5c656b9328831deee22');
 assert(Object.entries(p.files).some(([path,expected])=>createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==expected));
});

import {checkRhinoCandidateSource} from './demo-pilot-profile.mjs';
test('every offered workflow pilot profile reaches the common entry point',()=>{
 for(const path of ['.github/workflows/demo-maintenance.yml','.github/workflows/trial-300k.yml']){
  const yaml=fs.readFileSync(path,'utf8'),section=yaml.split('      pilot_profile:')[1]?.split(/\n      [a-z_]+:/)[0];
  assert(section,'PILOT_INPUT_REQUIRED');const names=section.match(/demo-[a-z0-9-]+\.json/g);assert(names?.length);
  for(const name of names)assert.equal(demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:name}),'config/'+name);
 }
});
test('Rhino repaired reentry uses closed pilot proof while first entry requires completed formal source',()=>{
 const p={gameId:32799,repairedCandidate:{},sourceClosureHash:'a'.repeat(64)};
 assert.doesNotThrow(()=>checkRhinoCandidateSource(p,{repair:true}));
 assert.throws(()=>checkRhinoCandidateSource(p),/RHINO_SOURCE_BOUNDARY_REQUIRED/);
 for(const change of [{sourceClosureHash:null},{emptyCandidate:{}},{sourceFormal:{}}])assert.throws(()=>checkRhinoCandidateSource({...p,...change},{repair:true}),/RHINO_REPAIR_BOUNDARY_REQUIRED/);
 const first={gameId:32799,emptyCandidate:{},sourceFormal:{schema:'sg-formal-source-boundary-v1'}};
 assert.doesNotThrow(()=>checkRhinoCandidateSource(first));
 assert.throws(()=>checkRhinoCandidateSource(first,{repair:true}),/RHINO_REPAIR_BOUNDARY_REQUIRED/);
});

import {formalCountProfilePath} from './formal-count-plan.mjs';
test('every offered formal profile reaches the common permission path',()=>{
 for(const path of ['.github/workflows/demo-maintenance.yml','.github/workflows/trial-300k.yml']){
  const section=fs.readFileSync(path,'utf8').split('      formal_profile:')[1]?.split(/\n      [a-z_]+:/)[0];assert(section);
  for(const name of section.match(/formal-[a-z0-9-]+\.json/g))assert.equal(formalCountProfilePath({SG_FORMAL_COUNT_PROFILE:name}),'config/'+name);
 }
});
