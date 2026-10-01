import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
test('retirement with a persisted before marker retains its original immutable profile',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-retire-pyramids-display-20261001.json','utf8'));
 assert.equal(hash(p),'70121cfdae107ad68f1b89bdce1ce62e6f41d2a0c477985c283d2e11a1348aa0');
 assert.equal(p.sourceAllowance,0);assert.equal(p.completePreserved,2127);assert.equal(p.sourceRun,'36791455132:1');
});
