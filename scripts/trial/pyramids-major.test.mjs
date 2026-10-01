import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import path from 'node:path';
import {nextRequest,roundMapping} from './squid-protocol.mjs';
const require=createRequire(import.meta.url);
require('../../collector/node_modules/ts-node').register({project:path.resolve('collector/tsconfig.json')});
const {prepareNextgenRound}=require('../../collector/sg.ingest.ts');
const r=spawnSync(process.env.PYTHON??'python',['-c',"import sys,json;sys.path[:0]=['service','service/tests'];from test_pyramids_major_review import major_sample;from test_pyramids_free_review import PLAN;from pyramids_fields import PyramidsFields,SOURCE,EXTENSION;from pyramids_major_review import EXTENSION as MAJOR;from round_fields import type_profile;raw=major_sample();print(json.dumps({'raw':raw,'fields':PyramidsFields(PLAN).settled(raw),'base':type_profile(SOURCE)[1],'extensions':{'free':type_profile(EXTENSION)[1],'major':type_profile(MAJOR)[1]}}))"],{encoding:'utf8'});
assert.equal(r.status,0,r.stderr);const fixture=JSON.parse(r.stdout);
test('independent Python Runner collector major mapping agrees; all prefixes continue without mutating raw',()=>{
 const raw=structuredClone(fixture.raw),before=structuredClone(raw);
 const mapping=roundMapping(raw,fixture.base,fixture.extensions);
 assert.equal(mapping.bonus,3);assert.deepEqual(prepareNextgenRound(raw,mapping),fixture.fields);
 assert.equal(nextRequest(raw),null);
 for(let i=1;i<raw.steps.length;i++){const p={...raw,steps:raw.steps.slice(0,i)};assert.deepEqual(nextRequest(p),{MSGID:'FREE_GAME'});assert.throws(()=>roundMapping(p,fixture.base,fixture.extensions),/INCOMPLETE/);}
 assert.deepEqual(raw,before);
 assert.throws(()=>prepareNextgenRound(raw,{...mapping,bonus:2}),/UNREVIEWED_COIN/);
 assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions.free),/MAPPING_REQUIRED/);
});
test('major scope rejects wrong symbols malformed geometry alias counters forced exit and money independently',()=>{
 const mutations=['CL~3;0;-3;|','CL~0;5;-3;|','CL~0;0;-3;|0;0;20;|','CL~0;0;-3;|3;0;-4;|',
 'CL~0;0;-5;|','CL~0;0;-2;|','CL~0;0;-4;|','CL~0;0;-0;|','CL~0;0;-3;|#CLBN~0;0;20;|','BGCL~0;0;-3;|'];
 for(const gsd of mutations){const raw=structuredClone(fixture.raw);raw.steps[1].responsePayload=raw.steps[1].responsePayload.replace(/GSD=[^&]*/,'GSD='+gsd);
 assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions),gsd);assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:fixture.extensions.major}),gsd);}
 for(const [i,from,to]of[[1,'CFGG=1','CFGG=0'],[1,'IFG=1','IFG=1&GCT=1'],[10,'B=99980','B=99990']]){const raw=structuredClone(fixture.raw);raw.steps[i].responsePayload=raw.steps[i].responsePayload.replace(from,to);assert.throws(()=>roundMapping(raw,fixture.base,fixture.extensions));assert.throws(()=>prepareNextgenRound(raw,{buy:0,bonus:3,typeMappingHash:fixture.extensions.major}));}
});
