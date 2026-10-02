import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protocolHash} from './protocol-resume.mjs';

test('applied resource-budget activation remains immutable after successful live canary',()=>{
 const profile=JSON.parse(fs.readFileSync('config/formal-repair-pyramids-action-budget-20261002.json','utf8'));
 assert.equal(protocolHash(profile),'d9ecf7db02603aab784d125c5a1721f5e9d62534f337f3846ad6d773e7281527');
});
