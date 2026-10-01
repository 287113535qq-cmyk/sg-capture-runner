import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Mansion repaired generation cannot refresh or reset its 100 BET allowance',()=>{
 assert.equal(hash(JSON.parse(fs.readFileSync('config/demo-repair-mansion-20261001.json'))),'6699d2d0130eda69e64e3e3ca8ecbc8edc7e9847ef9325f387dff04f0b9e7352');
});
