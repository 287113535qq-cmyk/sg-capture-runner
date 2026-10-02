import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied VeryFruity fault closure preserves original one paid attempt and foregoes99 without granting source',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-close-veryfruity-adapter-20261003.json'));
 assert.equal(hash(p),'622e070f1852255996e32c0b8c60c237579f743df9059e36410bebcd9c6b77b7');
 assert.equal(p.newBetAllowance,0);assert.equal(p.sourceRunKey,'capture-run:37053154321:1');
 assert.deepEqual(p.usedByWorker,Array.from({length:20},(_,i)=>i===3?1:0));
 assert.deepEqual(p.completeByWorker,Array(20).fill(0));assert.equal(p.completePreserved,0);
});
