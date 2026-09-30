import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pearl observation runtime profile remains immutable and cannot mint quota',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-runtime-pearl-observation-20261001.json','utf8'));
 assert.equal(hash(p),'85b65dc117c2416b0e014625c654c4f512fed3d83f1b133255d3d3181f8999cb');
 assert.equal(p.completePreserved,166376);assert.equal(p.remainingComplete,133624);
 assert.equal(p.sourceRequests,0);assert.equal(p.newBetAllowance,0);assert.equal(Object.keys(p.protectedFiles).length,10);
 const original=JSON.parse(fs.readFileSync('config/formal-repair-pearl-awards-20261001.json','utf8'));
 assert.equal(p.profileHash,hash(original));assert.equal(p.activation,original.activation);
 for(const[k,v]of Object.entries(p.protectedFiles))assert.equal(v,original.files[k]);
});
