import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {demoPilotProfilePath} from './demo-pilot-profile.mjs';import {protocolHash as hash} from './protocol-resume.mjs';
test('explicit profile routes only two reviewed names',()=>{
 assert.equal(demoPilotProfilePath({}),'config/demo-pilot-beaver-20260930.json');
 assert.equal(demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:'demo-pilot-replacement-20260930.json'}),'config/demo-pilot-replacement-20260930.json');
 for(const name of ['../other.json','arbitrary.json','/tmp/permit'])assert.throws(()=>demoPilotProfilePath({SG_DEMO_PILOT_PROFILE:name}),/DEMO_PROFILE_PATH/);
});
test('old dispatched profile stays frozen and cannot authorize changed runtime',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-pilot-beaver-20260930.json','utf8'));
 assert.equal(hash(p),'9a4d0db5fa18564d9cee14c1b6c7891217b23dd77027d5c656b9328831deee22');
 assert(Object.entries(p.files).some(([path,expected])=>createHash('sha256').update(fs.readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==expected));
});
