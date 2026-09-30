import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {protocolHash as hash} from './protocol-resume.mjs';
test('applied Jinzita close preserves95 spent and5 foregone without granting source permission',()=>{
 const p=JSON.parse(fs.readFileSync('config/demo-close-jinzita-20260930.json','utf8'));
 assert.equal(hash(p),'66b3127c8caa6b214aab3b9b06ae7f41fb78747c1f87038661ec518ada30c372');
 assert.equal(p.sourceRunKey,'capture-run:36650768164:1');assert.equal(p.completePreserved,415);assert.equal(p.newBetAllowance,0);
 assert.deepEqual(p.usedByWorker,Array.from({length:20},(_,w)=>w===18?0:5));
 assert.equal(hash(JSON.parse(fs.readFileSync('config/demo-pilot-jinzita-20260930.json','utf8'))),p.sourceProfileHash);
});
