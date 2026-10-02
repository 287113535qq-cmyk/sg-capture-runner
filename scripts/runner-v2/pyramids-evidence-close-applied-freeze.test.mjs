import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied evidence closure stays immutable with no source allowance',()=>{
 const p=JSON.parse(fs.readFileSync('config/count-close-pyramids-evidence-20261002.json','utf8'));
 assert.equal(hash(p),'1e369e480738586185d205f1d10ef2df68aeb2b20069617154cf46126a233dfc');
 assert.equal(p.completePreserved,16913);assert.equal(p.abandonedAttempts,3);
 assert.equal(p.sourceAllowance,0);assert.equal(p.sourceRun,'36963756989:1');
 assert.equal(p.disposition,'interrupted-abandoned-without-replay');
});
