import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';

test('applied coin close preserves actual records and does not grant source or abandon twice',()=>{
 const profile=JSON.parse(fs.readFileSync('config/count-close-pyramids-retrigger-coin-20261002.json','utf8'));
 assert.equal(hash(profile),'2d556dc5ffa052e8715d376fcee831e05b80eb97aa25227d0e2b98dfdbab11cb');
 assert.equal(profile.completePreserved,7503);
 assert.equal(profile.abandonedAlready,1);
 assert.equal(profile.sourceAllowance,0);
 assert.equal(profile.sourceRun,'36955443358:1');
 assert.equal(profile.recordsHash,'11f76cc6db83acfc439ddb4cea67ed1e842fc2312db2d3ee03c6a1fc38cbe5f6');
});
