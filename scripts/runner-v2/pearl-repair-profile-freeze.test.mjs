import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Pearl repair permission retains its original count and feature scope',()=>{
 const p=JSON.parse(fs.readFileSync('config/formal-repair-pearl-20260930.json','utf8'));
 assert.equal(hash(p),'0da25be25599bb12118108c8a425aacddc54ef387822c355028e69c36954c1fc');
 assert.equal(p.completePreserved,961);assert.equal(p.featureProfile,'eight-free-retrigger-v1');
});
