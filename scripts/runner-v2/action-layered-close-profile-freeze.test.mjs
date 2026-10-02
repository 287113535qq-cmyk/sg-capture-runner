import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied layered closure stays immutable with its original zero-source scope',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-pyramids-evidence-20261002-layered.json','utf8'));
 assert.equal(hash(p),'c37a373fbf4ee1e38b63f1d8051ff4786b6cc13e20521c50ea175ef7062f8658');
 assert.equal(p.sourceRun,'36983664943:1');assert.equal(p.completePreserved,132846);assert.equal(p.abandonedAttempts,1);assert.equal(p.sourceAllowance,0);
});
