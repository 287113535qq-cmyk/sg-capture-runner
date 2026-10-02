import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied cash-coin repair admission keeps the original remaining target and closed parent',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-cash-coins-20261002.json','utf8'));
 assert.equal(hash(profile),'8f387e5caf6a563cb10cab7fc62f657ed4af3eaae280844f3cf1a8297ff90f0d');
 assert.equal(profile.completePreserved,7503);
 assert.equal(profile.remainingComplete,292347);
 assert.equal(profile.sourceRun,'36955443358:1');
 assert.equal(profile.recordsHash,'11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6');
});
