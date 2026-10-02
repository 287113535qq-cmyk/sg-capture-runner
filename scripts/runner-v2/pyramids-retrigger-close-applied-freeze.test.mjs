import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied retrigger closure keeps source zero and immutable accounting',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-pyramids-retrigger-20261002.json','utf8'));
 assert.equal(hash(p),'d490121298afb03d52d211812d249d991c1359c02e47e49345f8475efd5a0bad');
 assert.equal(p.completePreserved,5787);assert.equal(p.abandonedAttempts,2);
 assert.equal(p.sourceAllowance,0);assert.equal(p.sourceRun,'36951574835:1');
});
